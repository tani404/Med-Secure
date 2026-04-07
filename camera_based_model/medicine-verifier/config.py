"""
Configuration for the Medicine Verification System.

All sensitive keys are loaded from environment variables.
Thresholds, model names, and cache settings are defined here.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ── API Keys ────────────────────────────────────────────────────────────────
NVIDIA_API_KEY: str | None = os.getenv("NVIDIA_API_KEY")            # OCR model key
NVIDIA_GEMMA_API_KEY: str | None = os.getenv("NVIDIA_GEMMA_API_KEY")  # unused, kept for compat
GOOGLE_API_KEY: str | None = os.getenv("GOOGLE_API_KEY")
GOOGLE_CSE_ID: str | None = os.getenv("GOOGLE_CSE_ID")
SERPAPI_KEY: str | None = os.getenv("SERPAPI_KEY")

# ── NVIDIA NIM endpoints (OCR only) ────────────────────────────────────────
NVIDIA_NIM_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
OCR_URL: str = "https://ai.api.nvidia.com/v1/cv/nvidia/nemotron-ocr-v1"

# ── OCR rotation selector model (NVIDIA NIM) ───────────────────────────────
QUERY_BUILDER_MODEL: str = "google/gemma-4-31b-it"

# ── Claude query builder ────────────────────────────────────────────────────
CLAUDE_API_KEY: str | None = os.getenv("CLAUDE_API_KEY")
CLAUDE_HAIKU_MODEL: str = "claude-haiku-4-5-20251001"

# ── CLIP ────────────────────────────────────────────────────────────────────
CLIP_MODEL: str = "openai/clip-vit-base-patch32"

# ── Image search ────────────────────────────────────────────────────────────
TOP_K_IMAGES: int = 5

# ── Confidence thresholds ───────────────────────────────────────────────────
# Camera photos vs clean product images score lower on CLIP similarity.
# These thresholds are calibrated for real-world camera captures:
CONFIDENCE_THRESHOLDS: dict[str, float] = {
    "verified": 0.60,
    "possible": 0.45,
}

# ── Cache ───────────────────────────────────────────────────────────────────
CACHE_DIR: str = str(Path(__file__).parent / ".cache" / "medicine_verifier")
CACHE_TTL: int = 86400  # 24 hours

# ── Image preprocessing ────────────────────────────────────────────────────
MAX_IMAGE_DIMENSION: int = 1024

# ── Retry / back-off ───────────────────────────────────────────────────────
MAX_RETRIES: int = 3
BACKOFF_BASE: float = 1.0  # seconds; actual wait = base * 2^attempt

# ── Debug ───────────────────────────────────────────────────────────────────
DEBUG_OUTPUT_DIR: str = str(Path(__file__).parent / ".debug_output")
