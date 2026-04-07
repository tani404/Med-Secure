"""
Packaging forensics: detects visual anomalies in medicine packaging images
that are characteristic of counterfeits.

Checks (all CPU-only, no extra model required):
  1. Text edge sharpness  — real pharma printing has crisp edges;
                            fakes printed on inkjet have blurry/jagged edges.
  2. Color histogram consistency — measures color uniformity / banding
                                   typical of photocopied or low-quality printing.
  3. Noise level          — excessive JPEG/compression noise suggests
                            a scanned or re-photographed fake label.
  4. Contrast uniformity  — real labels have consistent contrast zones;
                            fakes often have uneven contrast from reprinting.

Returns a forensics_score 0.0–1.0 (1.0 = looks authentic) and findings list.
"""

from __future__ import annotations

import numpy as np
from PIL import Image, ImageFilter

from utils.logger import get_logger

logger = get_logger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _to_gray_array(image: Image.Image) -> np.ndarray:
    return np.array(image.convert("L"), dtype=np.float32)


def _text_edge_sharpness(image: Image.Image) -> float:
    """Laplacian variance — higher = sharper text edges.

    Real pharmaceutical printing: typically > 300.
    Photocopied / inkjet fake: typically < 100.

    Returns a normalised score 0–1.
    """
    pil_gray = image.convert("L")
    # Use PIL's FIND_EDGES (equivalent to Laplacian edge detection)
    edges = pil_gray.filter(ImageFilter.FIND_EDGES)
    lap_arr = np.array(edges, dtype=np.float32)
    variance = float(np.var(lap_arr))

    # Calibrated thresholds (empirical for pharma packaging photos)
    # < 50  → very blurry / fake print
    # 50–200 → acceptable (camera blur, low light)
    # > 200  → sharp / genuine print quality
    score = min(variance / 200.0, 1.0)
    logger.info("Edge sharpness variance=%.1f  score=%.3f", variance, score)
    return score


def _color_histogram_uniformity(image: Image.Image) -> float:
    """Measure how 'clean' the color distribution is.

    Real packaging: distinct color bands (background, text, logo).
    Photocopied fake: compressed histogram — many mid-grey pixels, few pure colours.

    Returns a score 0–1 where 1 = healthy colour spread.
    """
    rgb = image.convert("RGB")
    arr = np.array(rgb)

    scores = []
    for ch in range(3):
        channel = arr[:, :, ch].flatten()
        hist, _ = np.histogram(channel, bins=32, range=(0, 256))
        hist = hist / (hist.sum() + 1e-9)
        # Entropy of the histogram
        entropy = -np.sum(hist * np.log2(hist + 1e-9))
        # Max entropy for 32 bins = log2(32) = 5.0
        scores.append(entropy / 5.0)

    score = float(np.mean(scores))
    logger.info("Color histogram uniformity score=%.3f", score)
    return score


def _noise_level(image: Image.Image) -> float:
    """Estimate image noise via high-frequency residual.

    Excessive noise (> threshold) = re-photographed / scanned label.
    Returns a score where 1.0 = low noise (good), 0.0 = high noise (suspicious).
    """
    # Blur and take residual
    gray = _to_gray_array(image)
    blurred = np.array(image.convert("L").filter(ImageFilter.GaussianBlur(radius=1)),
                       dtype=np.float32)
    residual = gray - blurred
    noise_std = float(np.std(residual))

    # < 5   → very clean image
    # 5–15  → normal camera noise
    # > 20  → excessive noise / compression artefacts
    score = max(0.0, 1.0 - (noise_std - 5.0) / 20.0)
    score = min(1.0, score)
    logger.info("Noise level std=%.2f  score=%.3f", noise_std, score)
    return score


def _contrast_uniformity(image: Image.Image) -> float:
    """Check local contrast consistency across the image.

    Real labels: consistent contrast in text regions.
    Reprinted fakes: highly variable local contrast from uneven toner/ink.

    Returns score 0–1 where 1 = consistent contrast.
    """
    gray = _to_gray_array(image)
    h, w = gray.shape
    block = 32
    local_stds = []
    for y in range(0, h - block, block):
        for x in range(0, w - block, block):
            patch = gray[y:y+block, x:x+block]
            local_stds.append(float(np.std(patch)))

    if not local_stds:
        return 0.5

    # Coefficient of variation of local stds: low = uniform contrast
    mean_std = np.mean(local_stds)
    cv = np.std(local_stds) / (mean_std + 1e-9)

    # cv < 0.5 → uniform (good), cv > 1.5 → very uneven (suspicious)
    score = max(0.0, 1.0 - (cv - 0.5) / 1.0)
    score = min(1.0, score)
    logger.info("Contrast uniformity cv=%.3f  score=%.3f", cv, score)
    return score


# ── Public API ───────────────────────────────────────────────────────────────

def run_forensics(image: Image.Image) -> dict:
    """Run all forensic checks on *image*.

    Args:
        image: Preprocessed PIL Image (RGB).

    Returns:
        Dict with keys: ``forensics_score`` (0–1), ``findings``,
        ``sharpness``, ``color_uniformity``, ``noise``, ``contrast``.
    """
    try:
        sharpness   = _text_edge_sharpness(image)
        color_unif  = _color_histogram_uniformity(image)
        noise       = _noise_level(image)
        contrast    = _contrast_uniformity(image)
    except Exception as exc:
        logger.error("Forensics failed: %s", exc)
        return {
            "forensics_score": 0.5,
            "findings": [f"Forensics error: {exc}"],
            "sharpness": 0.5,
            "color_uniformity": 0.5,
            "noise": 0.5,
            "contrast": 0.5,
        }

    # Weighted combination
    # Sharpness is the strongest signal (fake prints are blurry)
    forensics_score = (
        sharpness   * 0.40 +
        color_unif  * 0.25 +
        noise       * 0.20 +
        contrast    * 0.15
    )
    forensics_score = round(forensics_score, 4)

    findings: list[str] = []
    if sharpness < 0.35:
        findings.append("Text edges are blurry — possible low-quality print or photocopy")
    if color_unif < 0.40:
        findings.append("Compressed colour histogram — may indicate photocopied label")
    if noise < 0.40:
        findings.append("High image noise — label may have been re-photographed or scanned")
    if contrast < 0.35:
        findings.append("Uneven local contrast — inconsistent printing quality")

    logger.info(
        "Forensics score=%.4f | sharpness=%.3f color=%.3f noise=%.3f contrast=%.3f | findings=%s",
        forensics_score, sharpness, color_unif, noise, contrast, findings,
    )

    return {
        "forensics_score": forensics_score,
        "findings": findings,
        "sharpness": round(sharpness, 4),
        "color_uniformity": round(color_unif, 4),
        "noise": round(noise, 4),
        "contrast": round(contrast, 4),
    }
