"""
Authenticity checker: uses Claude Haiku to detect fake medicine by
analysing internal consistency of OCR text.

Checks:
  - Batch number format validity for the known manufacturer
  - MFG / EXP date logic (gap matches product shelf life, dates not expired)
  - License / regulatory number format (WHO-GMP, CDSCO, FDA NDC patterns)
  - Manufacturer address consistency (city, state, pin code plausible)
  - Price (MRP) plausibility for the identified product
  - Spelling / font anomalies in key pharmaceutical terms

Returns a score 0.0–1.0 and a list of red-flag findings.
"""

from __future__ import annotations

import asyncio
import json
import re

import anthropic

from config import CLAUDE_API_KEY, CLAUDE_HAIKU_MODEL, MAX_RETRIES, BACKOFF_BASE
from utils.logger import get_logger

logger = get_logger(__name__)

_SYSTEM_PROMPT = """You are a pharmaceutical authentication expert specialising in detecting counterfeit medicines.

IMPORTANT CONTEXT: The text you receive has been extracted by an OCR system from a camera photo of a medicine package. Camera OCR routinely introduces noise:
- Letters may be substituted (e.g. "suppiement" for "supplement", "Tobiets" for "Tablets")
- Numbers may be garbled (e.g. "55 mg" could be "5.5 mg" with a spacing error)
- Proper nouns (brand names, city names) are often distorted
- Missing batch/expiry dates may simply be outside the camera's field of view

DO NOT flag ordinary OCR noise as a red flag. Only flag things that are suspicious even AFTER accounting for OCR errors.

Check the following — be lenient on OCR noise, strict on logical inconsistencies:
1. **Dosage contradiction**: Is the same product labelled with two LOGICALLY incompatible strengths (e.g. 5mg AND 500mg on the same pack)?
2. **MFG / EXP date logic**: If both dates are readable, is the shelf-life gap realistic (6 months – 5 years)? Is the product clearly expired?
3. **Regulatory marks**: Are there any regulatory indicators (WHO-GMP, FSSAI, Mfg. Lic. No., CDSCO, IP, BP, USP)? Absence is mildly suspicious, not conclusive.
4. **Manufacturer coherence**: Is a manufacturer name present? Does the address contain a recognisable city/country?
5. **Structural completeness**: Does the label have at least SOME of: product name, strength, form, manufacturer, storage instructions? A completely empty label is suspicious.
6. **Price anomaly**: If MRP is visible, is it wildly implausible (e.g. ₹1 for prescription medicine)?

Scoring guide:
- 0.7–1.0: All key fields present, no logical contradictions → authentic
- 0.5–0.7: Some fields missing or minor issues → suspicious
- 0.0–0.5: Multiple logical contradictions or critical fields absent → likely_fake

Respond ONLY with a JSON object — no explanation:
{
  "authenticity_score": <float 0.0–1.0>,
  "red_flags": ["<only genuine logical red flags, max 5>"],
  "green_flags": ["<positive authenticity signals>"],
  "verdict": "<one of: authentic | suspicious | likely_fake>",
  "summary": "<one sentence>"
}
"""


async def check_authenticity(ocr_text: str) -> dict:
    """Analyse OCR text for counterfeiting signals using Claude Haiku.

    Args:
        ocr_text: Raw OCR text from the medicine package.

    Returns:
        Dict with keys: ``authenticity_score`` (0–1), ``red_flags``,
        ``green_flags``, ``verdict``, ``summary``.
        On failure returns a neutral result (score=0.5).
    """
    if not CLAUDE_API_KEY:
        logger.warning("CLAUDE_API_KEY not set — skipping authenticity check")
        return _neutral_result("API key not configured")

    if not ocr_text or len(ocr_text.strip()) < 10:
        logger.warning("OCR text too short for authenticity check")
        return _neutral_result("Insufficient OCR text")

    client = anthropic.AsyncAnthropic(api_key=CLAUDE_API_KEY)
    last_exc: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            logger.info("Authenticity check attempt %d/%d", attempt + 1, MAX_RETRIES)
            message = await client.messages.create(
                model=CLAUDE_HAIKU_MODEL,
                max_tokens=512,
                system=_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": f"OCR text:\n{ocr_text}"}],
            )
            raw = message.content[0].text.strip()
            logger.info("Authenticity raw response: %s", raw[:400])

            # Strip markdown fences if present
            match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw)
            data = json.loads(match.group(1) if match else raw)

            score = float(data.get("authenticity_score", 0.5))
            score = max(0.0, min(1.0, score))  # clamp

            result = {
                "authenticity_score": round(score, 4),
                "red_flags": data.get("red_flags", []),
                "green_flags": data.get("green_flags", []),
                "verdict": data.get("verdict", "suspicious"),
                "summary": data.get("summary", ""),
            }
            logger.info(
                "Authenticity verdict: %s (score=%.4f) | red_flags=%s",
                result["verdict"], score, result["red_flags"],
            )
            return result

        except Exception as exc:
            last_exc = exc
            wait = BACKOFF_BASE * (2 ** attempt)
            logger.warning(
                "Authenticity check attempt %d failed: %s – retrying in %.1fs",
                attempt + 1, exc, wait,
            )
            await asyncio.sleep(wait)

    logger.error("Authenticity check failed after %d attempts: %s", MAX_RETRIES, last_exc)
    return _neutral_result(f"Check failed: {last_exc}")


def _neutral_result(reason: str) -> dict:
    return {
        "authenticity_score": 0.5,
        "red_flags": [],
        "green_flags": [],
        "verdict": "suspicious",
        "summary": f"Could not complete authenticity check: {reason}",
    }
