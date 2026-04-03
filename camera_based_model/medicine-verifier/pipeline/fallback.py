"""
Direct CLIP fallback when OCR fails.

If OCR cannot extract text, we skip the search-based pipeline and
compare the input image directly against a local database of known
medicine embeddings (if one exists).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

from pipeline.clip_embedder import CLIPEmbedder
from pipeline.similarity import cosine_similarity, score_to_status
from utils.logger import get_logger

logger = get_logger(__name__)

# Path to an optional local embedding database (JSON).
# Format: [{"name": "...", "embedding": [float, ...]}]
LOCAL_DB_PATH = Path(__file__).parent.parent / "data" / "known_medicines.json"


def _load_local_db() -> list[dict]:
    """Load the local known-medicines database if it exists."""
    if not LOCAL_DB_PATH.exists():
        logger.warning("No local medicine DB found at %s", LOCAL_DB_PATH)
        return []
    with open(LOCAL_DB_PATH) as fh:
        entries = json.load(fh)
    logger.info("Loaded %d entries from local medicine DB", len(entries))
    return entries


def fallback_clip_match(image: Image.Image) -> dict:
    """Attempt to identify a medicine using only CLIP embeddings.

    Compares the input image against a local database of pre-computed
    embeddings.  If no database exists, returns a *rejected* result.

    Args:
        image: Preprocessed PIL Image (RGB).

    Returns:
        Verification result dict with keys ``medicine``, ``confidence``,
        ``status``, ``matched_reference``, and ``ocr_raw``.
    """
    logger.info("Running CLIP fallback (OCR unavailable)")

    embedder = CLIPEmbedder()
    input_emb = embedder.embed_image(image)

    db = _load_local_db()
    if not db:
        return {
            "medicine": "unknown",
            "confidence": 0.0,
            "status": "rejected",
            "matched_reference": None,
            "ocr_raw": None,
            "note": "OCR failed and no local medicine database is available",
        }

    best_score = -1.0
    best_name = "unknown"
    for entry in db:
        ref_emb = np.array(entry["embedding"], dtype=np.float32)
        score = cosine_similarity(input_emb, ref_emb)
        if score > best_score:
            best_score = score
            best_name = entry["name"]

    status = score_to_status(best_score)
    logger.info("Fallback result: %s (%.4f) -> %s", best_name, best_score, status)

    return {
        "medicine": best_name,
        "confidence": round(best_score, 4),
        "status": status,
        "matched_reference": "local_db",
        "ocr_raw": None,
        "note": "Result from CLIP fallback (OCR was unavailable)",
    }
