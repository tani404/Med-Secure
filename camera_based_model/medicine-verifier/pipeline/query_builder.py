"""
Query builder: normalises messy OCR text into a clean Google image
search query using Gemma 4 31B IT via NVIDIA NIM.

Returns both a primary query and alternative queries for robust searching.
"""

from __future__ import annotations

import json
import time

from openai import OpenAI

from config import (
    NVIDIA_API_KEY,
    NVIDIA_GEMMA_API_KEY,
    NVIDIA_NIM_BASE_URL,
    QUERY_BUILDER_MODEL,
    MAX_RETRIES,
    BACKOFF_BASE,
)
from utils.logger import get_logger

logger = get_logger(__name__)

SYSTEM_PROMPT = (
    "You are a pharmaceutical expert and text normalizer.\n"
    "Given messy OCR text from a medicine package, you must:\n"
    "1. Identify the EXACT medicine brand name (e.g. Metatime, Dolo, Crocin, Augmentin)\n"
    "2. Identify the dosage (e.g. 500mg, 250mg, 650mg)\n"
    "3. Identify the form (tablet, capsule, syrup, XR, SR, sustained release)\n"
    "4. Identify the manufacturer if visible\n\n"
    "Output ONLY a JSON object with these fields:\n"
    "{\n"
    '  "medicine_name": "<brand name>",\n'
    '  "dosage": "<dosage with unit>",\n'
    '  "form": "<form>",\n'
    '  "manufacturer": "<manufacturer or null>",\n'
    '  "primary_query": "<medicine_name dosage form — max 6 words for Google Image search>",\n'
    '  "alt_queries": ["<alternative query 1>", "<alternative query 2>"]\n'
    "}\n\n"
    "IMPORTANT:\n"
    "- The OCR text may have spaces in the middle of words (e.g. 'META TIME' = 'METATIME')\n"
    "- The OCR text may have garbled characters — use pharmaceutical knowledge to correct them\n"
    "- 'XR' or 'SR' means extended/sustained release\n"
    "- 'IP' means Indian Pharmacopoeia\n"
    "- alt_queries should include the generic drug name (e.g. metformin for Metatime)\n"
    "- Do NOT include any explanation — ONLY the JSON object"
)


def build_query(ocr_text: str) -> str:
    """Convert raw OCR text into a clean image-search query.

    Args:
        ocr_text: Raw text returned by the OCR step.

    Returns:
        A concise search query (typically 3–6 words).

    Raises:
        RuntimeError: If the API call fails after retries.
    """
    api_key = NVIDIA_GEMMA_API_KEY or NVIDIA_API_KEY
    if not api_key:
        raise RuntimeError("NVIDIA_GEMMA_API_KEY (or NVIDIA_API_KEY) is not set")

    client = OpenAI(base_url=NVIDIA_NIM_BASE_URL, api_key=api_key)

    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            logger.info("Query-builder attempt %d/%d", attempt + 1, MAX_RETRIES)
            response = client.chat.completions.create(
                model=QUERY_BUILDER_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"OCR text: {ocr_text}"},
                ],
                max_tokens=256,
                temperature=0.1,
            )
            raw = response.choices[0].message.content.strip()
            logger.info("Query-builder raw response: %s", raw[:300])

            # Parse JSON response
            if "```" in raw:
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()

            data = json.loads(raw)
            query = data.get("primary_query", "").strip().strip('"').strip("'")
            alt_queries = data.get("alt_queries", [])

            if not query:
                raise RuntimeError("Query builder returned empty primary_query")

            logger.info("Primary query: '%s'", query)
            logger.info("Alt queries: %s", alt_queries)
            logger.info("Medicine identified: %s %s %s",
                        data.get("medicine_name", "?"),
                        data.get("dosage", "?"),
                        data.get("form", "?"))

            # Store alt queries as an attribute for the orchestrator to use
            build_query._last_alt_queries = alt_queries
            build_query._last_medicine_info = data

            return query

        except Exception as exc:
            last_exc = exc
            wait = BACKOFF_BASE * (2 ** attempt)
            logger.warning(
                "Query-builder attempt %d failed: %s – retrying in %.1fs",
                attempt + 1, exc, wait,
            )
            time.sleep(wait)

    raise RuntimeError(
        f"Query builder failed after {MAX_RETRIES} attempts"
    ) from last_exc


# Initialise attributes
build_query._last_alt_queries = []
build_query._last_medicine_info = {}
