"""
Query builder: normalises messy OCR text into a clean Google image
search query using LLM via the Anthropic SDK.

Returns both a primary query and alternative queries for robust searching.
"""

from __future__ import annotations

import asyncio
import json

import anthropic

from config import (
    CLAUDE_API_KEY,
    CLAUDE_HAIKU_MODEL,
    MAX_RETRIES,
    BACKOFF_BASE,
)
from utils.logger import get_logger
from utils.text import extract_json as _extract_json

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


async def build_query(ocr_text: str) -> dict:
    """Convert raw OCR text into a clean image-search query using LLM.

    Args:
        ocr_text: Raw text returned by the OCR step.

    Returns:
        A dict with keys: ``primary_query``, ``alt_queries``,
        ``medicine_name``, ``dosage``, ``form``, ``manufacturer``.

    Raises:
        RuntimeError: If the API call fails after retries.
    """
    if not CLAUDE_API_KEY:
        raise RuntimeError("CLAUDE_API_KEY is not set")

    client = anthropic.AsyncAnthropic(api_key=CLAUDE_API_KEY)

    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            logger.info("Query-builder attempt %d/%d (LLM)", attempt + 1, MAX_RETRIES)

            message = await client.messages.create(
                model=CLAUDE_HAIKU_MODEL,
                max_tokens=256,
                system=SYSTEM_PROMPT,
                messages=[
                    {"role": "user", "content": f"OCR text: {ocr_text}"}
                ],
            )

            raw = message.content[0].text.strip()
            logger.info("Query-builder raw response: %s", raw[:300])

            data = json.loads(_extract_json(raw))
            query = data.get("primary_query", "").strip().strip('"').strip("'")
            alt_queries = data.get("alt_queries", [])

            if not query:
                raise RuntimeError("Query builder returned empty primary_query")

            logger.info("Primary query: '%s'", query)
            logger.info("Alt queries: %s", alt_queries)
            logger.info(
                "Medicine identified: %s %s %s",
                data.get("medicine_name", "?"),
                data.get("dosage", "?"),
                data.get("form", "?"),
            )

            return {
                "primary_query": query,
                "alt_queries": alt_queries,
                "medicine_name": data.get("medicine_name", query),
                "dosage": data.get("dosage", ""),
                "form": data.get("form", ""),
                "manufacturer": data.get("manufacturer"),
            }

        except Exception as exc:
            last_exc = exc
            wait = BACKOFF_BASE * (2 ** attempt)
            logger.warning(
                "Query-builder attempt %d failed: %s – retrying in %.1fs",
                attempt + 1, exc, wait,
            )
            await asyncio.sleep(wait)

    raise RuntimeError(
        f"Query builder failed after {MAX_RETRIES} attempts"
    ) from last_exc
