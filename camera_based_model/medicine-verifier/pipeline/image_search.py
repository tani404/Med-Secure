"""
Image search via SerpAPI (Google Images).

Returns the top-K image URLs for a given query string.
"""

from __future__ import annotations

import time

from serpapi import GoogleSearch

from config import SERPAPI_KEY, TOP_K_IMAGES, MAX_RETRIES, BACKOFF_BASE
from utils.logger import get_logger

logger = get_logger(__name__)


def search_images(query: str, top_k: int = TOP_K_IMAGES) -> list[str]:
    """Search Google Images via SerpAPI for *query* and return image URLs.

    Args:
        query: The search query (ideally produced by :func:`build_query`).
        top_k: Maximum number of image URLs to return.

    Returns:
        List of image URLs (may be shorter than *top_k* if fewer results).

    Raises:
        RuntimeError: If the API call fails after retries or the key is missing.
    """
    if not SERPAPI_KEY:
        raise RuntimeError("SERPAPI_KEY is not set")

    params = {
        "engine": "google_images",
        "q": query,
        "api_key": SERPAPI_KEY,
        "num": top_k,
    }

    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            logger.info(
                "Image search attempt %d/%d for '%s'", attempt + 1, MAX_RETRIES, query
            )
            search = GoogleSearch(params)
            results = search.get_dict()

            if "error" in results:
                raise RuntimeError(f"SerpAPI error: {results['error']}")

            images = results.get("images_results", [])
            urls = [img["original"] for img in images[:top_k] if "original" in img]
            logger.info("Found %d image URLs", len(urls))
            return urls

        except Exception as exc:
            last_exc = exc
            wait = BACKOFF_BASE * (2 ** attempt)
            logger.warning(
                "Image search attempt %d failed: %s – retrying in %.1fs",
                attempt + 1, exc, wait,
            )
            time.sleep(wait)

    raise RuntimeError(
        f"Image search failed after {MAX_RETRIES} attempts"
    ) from last_exc
