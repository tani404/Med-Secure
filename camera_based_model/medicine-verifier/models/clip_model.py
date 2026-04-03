"""
CLIP model loader.

Loads ``openai/clip-vit-base-patch32`` from HuggingFace and exposes a
singleton so the heavy model is only instantiated once per process.
"""

from __future__ import annotations

import torch
from transformers import CLIPModel, CLIPProcessor

from config import CLIP_MODEL
from utils.logger import get_logger

logger = get_logger(__name__)

_model: CLIPModel | None = None
_processor: CLIPProcessor | None = None
_device: torch.device | None = None


def get_device() -> torch.device:
    """Return the best available device (CUDA > CPU)."""
    global _device
    if _device is None:
        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info("CLIP device: %s", _device)
    return _device


def get_clip_model() -> CLIPModel:
    """Return the singleton CLIP model, loading it on first call.

    Returns:
        A :class:`CLIPModel` on the appropriate device.
    """
    global _model
    if _model is None:
        logger.info("Loading CLIP model: %s", CLIP_MODEL)
        _model = CLIPModel.from_pretrained(CLIP_MODEL).to(get_device())
        _model.eval()
        logger.info("CLIP model loaded successfully")
    return _model


def get_clip_processor() -> CLIPProcessor:
    """Return the singleton CLIP processor, loading it on first call.

    Returns:
        A :class:`CLIPProcessor` for the configured CLIP model.
    """
    global _processor
    if _processor is None:
        logger.info("Loading CLIP processor: %s", CLIP_MODEL)
        _processor = CLIPProcessor.from_pretrained(CLIP_MODEL)
        logger.info("CLIP processor loaded successfully")
    return _processor
