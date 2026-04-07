"""
Image preprocessing: load, auto-orient, resize, sharpen, and enhance.
"""

from __future__ import annotations

import os

from PIL import Image, ImageEnhance, ImageFilter, ExifTags

from config import MAX_IMAGE_DIMENSION
from utils.image_utils import resize_image
from utils.logger import get_logger

logger = get_logger(__name__)

MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB


def _auto_orient(image: Image.Image) -> Image.Image:
    """Apply EXIF orientation tag so the image is right-side-up."""
    try:
        exif = image.getexif()
        orientation_key = None
        for k, v in ExifTags.TAGS.items():
            if v == "Orientation":
                orientation_key = k
                break
        if orientation_key and orientation_key in exif:
            orient = exif[orientation_key]
            if orient == 3:
                image = image.rotate(180, expand=True)
            elif orient == 6:
                image = image.rotate(270, expand=True)
            elif orient == 8:
                image = image.rotate(90, expand=True)
            logger.info("Applied EXIF orientation: %d", orient)
    except Exception:
        pass
    return image


def preprocess(image_path: str) -> Image.Image:
    """Load and preprocess a medicine package image for OCR and CLIP.

    Steps:
        1. Load from disk and auto-orient via EXIF.
        2. Convert to RGB.
        3. Resize so the longest side is at most ``MAX_IMAGE_DIMENSION``.
        4. Sharpen to improve text clarity.
        5. Enhance contrast by a factor of 1.4.
        6. Enhance brightness slightly (factor 1.1) to lift dark images.

    Args:
        image_path: Path to the source image file.

    Returns:
        Preprocessed PIL Image (RGB).
    """
    logger.info("Preprocessing image: %s", image_path)

    file_size = os.path.getsize(image_path)
    if file_size > MAX_FILE_BYTES:
        raise ValueError(
            f"Image file too large ({file_size / 1_048_576:.1f} MB). "
            f"Maximum allowed size is {MAX_FILE_BYTES // 1_048_576} MB."
        )

    image = Image.open(image_path)
    image = _auto_orient(image)
    image = image.convert("RGB")
    logger.info("Original size: %s", image.size)

    image = resize_image(image, MAX_IMAGE_DIMENSION)
    logger.info("Resized to: %s", image.size)

    # Sharpen for better OCR on blurry camera shots
    image = image.filter(ImageFilter.SHARPEN)
    logger.info("Sharpened")

    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(1.4)

    enhancer = ImageEnhance.Brightness(image)
    image = enhancer.enhance(1.1)
    logger.info("Contrast and brightness enhanced")

    return image
