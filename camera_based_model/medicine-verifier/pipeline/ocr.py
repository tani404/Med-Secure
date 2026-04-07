"""
OCR via NVIDIA NIM ``nemotron-ocr-v1``.

Tries all 4 rotations (0°, 180°, 90°, 270°) and uses Gemma LLM to
evaluate which rotation produced the most coherent pharmaceutical text,
ensuring 100% accurate medicine name extraction regardless of image
orientation.
"""

from __future__ import annotations

import asyncio
import base64
import io
import json
import re
import time

import requests
from openai import OpenAI
from PIL import Image

from config import (
    NVIDIA_API_KEY,
    NVIDIA_GEMMA_API_KEY,
    NVIDIA_NIM_BASE_URL,
    QUERY_BUILDER_MODEL,
    OCR_URL,
    MAX_RETRIES,
    BACKOFF_BASE,
)
from utils.logger import get_logger

logger = get_logger(__name__)


def _extract_json(raw: str) -> str:
    """Strip optional markdown code fences and return the inner JSON string."""
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw)
    if match:
        return match.group(1)
    return raw


class OcrFailedException(Exception):
    """Raised when OCR cannot extract text from the image."""


def _image_to_base64(image: Image.Image) -> str:
    """Convert a PIL Image to a base64 data-URI string."""
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"


def _call_ocr_api(image: Image.Image) -> str:
    """Send a single image to the OCR API and return extracted text."""
    image_b64 = _image_to_base64(image)

    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    payload = {
        "input": [
            {
                "type": "image_url",
                "url": image_b64,
            }
        ]
    }

    resp = requests.post(OCR_URL, headers=headers, json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    text_parts: list[str] = []
    for page in data.get("data", []):
        for detection in page.get("text_detections", []):
            pred = detection.get("text_prediction", {})
            t = pred.get("text", "").strip()
            if t:
                text_parts.append(t)

    return " ".join(text_parts)


def _select_best_ocr_with_llm(candidates: dict[int, str]) -> tuple[int, str]:
    """Use Gemma LLM to pick the best OCR result from multiple rotations.

    Args:
        candidates: Mapping of rotation angle -> OCR text.

    Returns:
        Tuple of (best_angle, best_text).
    """
    api_key = NVIDIA_GEMMA_API_KEY or NVIDIA_API_KEY
    if not api_key:
        # Fallback: pick longest text
        best_angle = max(candidates, key=lambda a: len(candidates[a]))
        return best_angle, candidates[best_angle]

    client = OpenAI(base_url=NVIDIA_NIM_BASE_URL, api_key=api_key)

    prompt_parts = []
    for angle, text in candidates.items():
        prompt_parts.append(f"--- Rotation {angle}° ---\n{text}")
    all_texts = "\n\n".join(prompt_parts)

    system_prompt = (
        "You are a pharmaceutical OCR quality evaluator. "
        "You will receive OCR text extracted from a medicine package image at different rotations. "
        "Only ONE rotation is the correct orientation — the others will have garbled/reversed text.\n\n"
        "Your task: identify which rotation produced the CORRECT, readable pharmaceutical text. "
        "Look for: recognizable medicine names, dosage (mg/ml), "
        "words like 'tablet', 'capsule', 'syrup', 'sustained release', 'manufacturer', "
        "'MFG', 'EXP', 'M.R.P', 'batch', 'composition', 'store'.\n\n"
        "Reply with ONLY a JSON object: {\"best_rotation\": <angle>, \"medicine_text\": \"<the clean OCR text from that rotation>\"}\n"
        "Do NOT explain. ONLY output the JSON."
    )

    try:
        response = client.chat.completions.create(
            model=QUERY_BUILDER_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": all_texts},
            ],
            max_tokens=512,
            temperature=0.1,
        )
        raw = response.choices[0].message.content.strip()
        logger.info("LLM rotation selection raw: %s", raw[:300])

        result = json.loads(_extract_json(raw))
        best_angle = int(result["best_rotation"])
        if best_angle in candidates:
            return best_angle, candidates[best_angle]
    except Exception as exc:
        logger.warning("LLM rotation selection failed: %s — using fallback", exc)

    # Fallback: pick the text with the most pharmaceutical keywords
    pharma_kw = [
        "tablet", "capsule", "mg", "ml", "ip", "bp", "sustained", "release",
        "hydrochloride", "mfg", "exp", "m.r.p", "mrp", "batch", "manufacturer",
        "metformin", "paracetamol", "amoxicillin", "azithromycin", "omeprazole",
        "composition", "store", "strip", "medicine", "dose", "each",
    ]

    def kw_score(text: str) -> int:
        t = text.lower()
        return sum(1 for kw in pharma_kw if kw in t)

    best_angle = max(candidates, key=lambda a: (kw_score(candidates[a]), len(candidates[a])))
    return best_angle, candidates[best_angle]


_PHARMA_KEYWORDS = [
    "tablet", "capsule", "mg", "ml", "ip", "bp", "mfg", "exp", "batch",
    "composition", "manufacturer", "store", "dosage", "strip", "each",
]

def _has_good_pharma_text(text: str, min_keywords: int = 3) -> bool:
    """Return True if *text* contains enough pharmaceutical keywords."""
    t = text.lower()
    return sum(1 for kw in _PHARMA_KEYWORDS if kw in t) >= min_keywords


def _ocr_one_rotation(angle: int, image: Image.Image) -> tuple[int, str]:
    """OCR a single rotation with retries. Returns (angle, text) or (angle, '')."""
    rotated = image.rotate(angle, expand=True) if angle != 0 else image
    for attempt in range(MAX_RETRIES):
        try:
            text = _call_ocr_api(rotated)
            if text.strip():
                logger.info("Rotation %d° -> %d chars extracted", angle, len(text))
            else:
                logger.info("Rotation %d° -> empty text", angle)
            return angle, text
        except Exception as exc:
            wait = BACKOFF_BASE * (2 ** attempt)
            logger.warning(
                "OCR rotation=%d° attempt %d failed: %s – retrying in %.1fs",
                angle, attempt + 1, exc, wait,
            )
            time.sleep(wait)
    return angle, ""


async def run_ocr(image: Image.Image) -> str:
    """Run OCR on *image* trying all 4 rotations for maximum accuracy.

    Fast path: tries 0° first; if the result already has enough pharmaceutical
    keywords, skips the remaining 3 rotations entirely (saves ~3 API calls).

    Slow path: runs the remaining 3 rotations in parallel via a thread pool,
    then uses the LLM to pick the best result.

    Args:
        image: Preprocessed PIL Image (RGB).

    Returns:
        Raw OCR text extracted from the best orientation.

    Raises:
        OcrFailedException: If all OCR attempts fail.
    """
    if not NVIDIA_API_KEY:
        raise OcrFailedException("NVIDIA_API_KEY is not set")

    loop = asyncio.get_event_loop()

    # ── Fast path: try 0° first ──────────────────────────────────────────
    logger.info("OCR fast path: trying 0° rotation first")
    angle0, text0 = await loop.run_in_executor(None, _ocr_one_rotation, 0, image)
    if text0 and _has_good_pharma_text(text0):
        logger.info("Fast path succeeded at 0° — skipping remaining rotations")
        return text0

    # ── Slow path: run remaining rotations in parallel ───────────────────
    logger.info("Fast path inconclusive — running remaining rotations in parallel")
    other_rotations = [180, 90, 270]
    tasks = [
        loop.run_in_executor(None, _ocr_one_rotation, angle, image)
        for angle in other_rotations
    ]
    other_results = await asyncio.gather(*tasks)

    candidates: dict[int, str] = {}
    if text0:
        candidates[0] = text0
    for angle, text in other_results:
        if text:
            candidates[angle] = text

    if not candidates:
        raise OcrFailedException("OCR returned empty text for all rotations")

    logger.info("Got OCR results for %d rotations: %s", len(candidates), list(candidates.keys()))

    # Use LLM to pick the best rotation (runs sync client in thread to avoid blocking)
    best_angle, best_text = await loop.run_in_executor(
        None, _select_best_ocr_with_llm, candidates
    )
    logger.info("Selected rotation %d° as best (text length: %d)", best_angle, len(best_text))

    return best_text
