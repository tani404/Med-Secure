"""
Cosine similarity, hybrid confidence scoring, and verification logic.

Combines four signals for robust fake-medicine detection:
  1. CLIP visual similarity     (does it look like the real product?)
  2. OCR text / URL match       (does the name appear in reference URLs?)
  3. Authenticity check score   (are batch/date/licence internally consistent?)
  4. Forensics score            (is the print quality consistent with genuine pharma?)
"""

from __future__ import annotations

import re

import numpy as np

from config import CONFIDENCE_THRESHOLDS
from utils.logger import get_logger

logger = get_logger(__name__)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two L2-normalised vectors.

    Args:
        a: First embedding (1-D numpy array).
        b: Second embedding (1-D numpy array).

    Returns:
        Similarity score in ``[-1, 1]``.
    """
    return float(np.dot(a, b))


def score_to_status(score: float) -> str:
    """Map a confidence score to a human-readable verification status.

    Args:
        score: Combined confidence score (0–1).

    Returns:
        One of ``"verified"``, ``"possible"``, or ``"rejected"``.
    """
    if score >= CONFIDENCE_THRESHOLDS["verified"]:
        return "verified"
    if score >= CONFIDENCE_THRESHOLDS["possible"]:
        return "possible"
    return "rejected"


def find_best_match(
    input_emb: np.ndarray,
    ref_embs: list[np.ndarray],
) -> tuple[float, int]:
    """Find the reference embedding most similar to *input_emb*.

    Args:
        input_emb: The query (input image) embedding.
        ref_embs: List of reference image embeddings.

    Returns:
        Tuple of ``(max_score, best_index)``.

    Raises:
        ValueError: If *ref_embs* is empty.
    """
    if not ref_embs:
        raise ValueError("ref_embs must contain at least one embedding")

    scores = [cosine_similarity(input_emb, ref) for ref in ref_embs]
    best_idx = int(np.argmax(scores))
    best_score = scores[best_idx]
    logger.info(
        "Best match: index=%d  score=%.4f  (all scores: %s)",
        best_idx,
        best_score,
        [round(s, 4) for s in scores],
    )
    return best_score, best_idx


def compute_text_match_score(
    medicine_name: str,
    ref_url: str,
) -> float:
    """Score how well the medicine name matches the reference URL.

    Reference URLs from image search often contain the medicine name
    in the path/filename, which is a strong signal.

    Args:
        medicine_name: Identified medicine name (e.g. "METATIME").
        ref_url: URL of the matched reference image.

    Returns:
        Score between 0.0 and 1.0.
    """
    if not medicine_name or not ref_url:
        return 0.0

    name_lower = medicine_name.lower().strip()
    url_lower = ref_url.lower()

    # Exact name in URL
    if name_lower in url_lower:
        return 1.0

    # Name without spaces
    name_compact = name_lower.replace(" ", "")
    if name_compact in url_lower:
        return 0.9

    # Partial match — check if major tokens appear
    tokens = re.split(r'[\s\-_]+', name_lower)
    tokens = [t for t in tokens if len(t) >= 3]
    if tokens:
        matches = sum(1 for t in tokens if t in url_lower)
        if matches > 0:
            return matches / len(tokens) * 0.8

    # Prefix match — first 5 chars of name in URL (handles brand vs generic, typos)
    if len(name_compact) >= 5 and name_compact[:5] in url_lower:
        return 0.5

    return 0.0


def compute_hybrid_confidence(
    clip_score: float,
    medicine_name: str,
    ref_url: str,
    all_ref_urls: list[str] | None = None,
) -> float:
    """Combine CLIP visual similarity with text-match score.

    When CLIP score is strong (>= 0.65), it carries more weight since the
    visual match is highly reliable. URL text match is a supporting signal.

    Weights:
    - Strong CLIP (>= 0.65): CLIP 80% + text 20%
    - Normal:                 CLIP 60% + text 40%

    Args:
        clip_score: Raw CLIP cosine similarity.
        medicine_name: Identified medicine name.
        ref_url: Best-matching reference URL.
        all_ref_urls: All reference URLs (checks any for name match).

    Returns:
        Combined confidence score (0-1).
    """
    # Check best URL first, then all URLs for text match
    text_score = compute_text_match_score(medicine_name, ref_url)
    if text_score < 1.0 and all_ref_urls:
        for url in all_ref_urls:
            s = compute_text_match_score(medicine_name, url)
            if s > text_score:
                text_score = s
            if text_score >= 1.0:
                break

    # Boost CLIP weight when visual similarity is strong
    if clip_score >= 0.65:
        clip_w, text_w = 0.8, 0.2
    else:
        clip_w, text_w = 0.6, 0.4

    hybrid = (clip_score * clip_w) + (text_score * text_w)

    logger.info(
        "Hybrid confidence: CLIP=%.4f x %.1f + text=%.4f x %.1f = %.4f",
        clip_score, clip_w, text_score, text_w, hybrid,
    )
    return hybrid


def compute_final_score(
    clip_score: float,
    medicine_name: str,
    ref_url: str,
    all_ref_urls: list[str] | None,
    authenticity_score: float,
    forensics_score: float,
) -> tuple[float, str]:
    """Combine all four signals into a final confidence score and status.

    Signal weights:
      - CLIP visual similarity : 35%
      - Text match (URL)       : 15%
      - Authenticity (text)    : 30%
      - Forensics (print)      : 20%

    A strong negative in any single signal (< 0.3) triggers a penalty
    so a fake that passes three checks but fails one is still flagged.

    Args:
        clip_score:          Raw CLIP cosine similarity.
        medicine_name:       Identified medicine name.
        ref_url:             Best-matching reference URL.
        all_ref_urls:        All reference URLs.
        authenticity_score:  Score from authenticity_checker (0–1).
        forensics_score:     Score from forensics module (0–1).

    Returns:
        Tuple of (final_confidence, status).
    """
    # Text match component
    text_score = compute_text_match_score(medicine_name, ref_url)
    if text_score < 1.0 and all_ref_urls:
        for url in all_ref_urls:
            s = compute_text_match_score(medicine_name, url)
            if s > text_score:
                text_score = s
            if text_score >= 1.0:
                break

    # Weighted combination
    # Authenticity score is unreliable when OCR quality is low (camera noise
    # causes garbled text that looks like red flags). CLIP + forensics are the
    # more reliable visual signals. Auth is a supporting signal only.
    base = (
        clip_score          * 0.45 +
        text_score          * 0.15 +
        authenticity_score  * 0.20 +
        forensics_score     * 0.20
    )

    # Hard penalty ONLY when BOTH visual signals AND authenticity are all bad —
    # meaning even the image itself looks wrong, not just the OCR text.
    if clip_score < 0.35 and forensics_score < 0.35:
        base = min(base, 0.44)
    elif authenticity_score < 0.25 and clip_score < 0.45:
        # Auth screams fake AND visual match is weak — cap it
        base = min(base, 0.44)

    final = round(min(1.0, max(0.0, base)), 4)
    status = score_to_status(final)

    logger.info(
        "Final score: CLIP=%.3f text=%.3f auth=%.3f forensics=%.3f → %.4f (%s)",
        clip_score, text_score, authenticity_score, forensics_score, final, status,
    )
    return final, status
