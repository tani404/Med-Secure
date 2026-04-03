"""
Image utility functions: downloading, resizing, and normalising images.
"""

from __future__ import annotations

import asyncio
import io
from typing import TYPE_CHECKING

import aiohttp
import requests
from PIL import Image

from config import MAX_RETRIES, BACKOFF_BASE
from utils.logger import get_logger

if TYPE_CHECKING:
    pass

logger = get_logger(__name__)


def download_image(url: str) -> Image.Image:
    """Download an image from *url* and return it as a PIL Image.

    Implements exponential back-off on transient failures (up to
    ``MAX_RETRIES`` attempts).

    Args:
        url: Publicly accessible image URL.

    Returns:
        PIL Image in RGB mode.

    Raises:
        RuntimeError: If all retry attempts are exhausted.
    """
    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(url, timeout=15)
            resp.raise_for_status()
            img = Image.open(io.BytesIO(resp.content)).convert("RGB")
            return img
        except Exception as exc:
            last_exc = exc
            wait = BACKOFF_BASE * (2 ** attempt)
            logger.warning(
                "Download attempt %d/%d failed for %s – retrying in %.1fs: %s",
                attempt + 1, MAX_RETRIES, url, wait, exc,
            )
            import time
            time.sleep(wait)
    raise RuntimeError(f"Failed to download image from {url} after {MAX_RETRIES} attempts") from last_exc


async def download_image_async(session: aiohttp.ClientSession, url: str) -> Image.Image:
    """Asynchronously download an image with exponential back-off.

    Args:
        session: An open :class:`aiohttp.ClientSession`.
        url: Publicly accessible image URL.

    Returns:
        PIL Image in RGB mode.

    Raises:
        RuntimeError: If all retry attempts are exhausted.
    """
    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                resp.raise_for_status()
                data = await resp.read()
                img = Image.open(io.BytesIO(data)).convert("RGB")
                return img
        except Exception as exc:
            last_exc = exc
            wait = BACKOFF_BASE * (2 ** attempt)
            logger.warning(
                "Async download attempt %d/%d failed for %s – retrying in %.1fs: %s",
                attempt + 1, MAX_RETRIES, url, wait, exc,
            )
            await asyncio.sleep(wait)
    raise RuntimeError(f"Failed to download image from {url} after {MAX_RETRIES} attempts") from last_exc


async def download_images_async(urls: list[str]) -> list[Image.Image]:
    """Download multiple images concurrently.

    Args:
        urls: List of image URLs.

    Returns:
        List of PIL Images in the same order as *urls*.
        Images that fail to download are omitted (with a warning logged).
    """
    images: list[Image.Image] = []
    async with aiohttp.ClientSession() as session:
        tasks = [download_image_async(session, url) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    for url, result in zip(urls, results):
        if isinstance(result, Exception):
            logger.error("Skipping image %s due to download failure: %s", url, result)
        else:
            images.append(result)
    return images


def resize_image(image: Image.Image, max_dim: int) -> Image.Image:
    """Resize *image* so its longest side is at most *max_dim* pixels.

    Preserves aspect ratio. If the image is already smaller, it is
    returned unchanged.

    Args:
        image: Input PIL Image.
        max_dim: Maximum allowed dimension (width or height).

    Returns:
        Resized (or original) PIL Image.
    """
    w, h = image.size
    if max(w, h) <= max_dim:
        return image
    scale = max_dim / max(w, h)
    new_size = (int(w * scale), int(h * scale))
    return image.resize(new_size, Image.LANCZOS)
