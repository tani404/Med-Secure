"""
Image search via SerpAPI (Google Images).

Returns the top-K image URLs for a given query string.

NOTE: This module exposes both a sync ``search_images`` (for use inside
``run_in_executor``) and an async ``search_images_async`` wrapper that
offloads to a thread so it never blocks the event loop.
"""

from __future__ import annotations

import asyncio
import time

from serpapi import Client as SerpApiClient

from config import SERPAPI_KEY, TOP_K_IMAGES, MAX_RETRIES, BACKOFF_BASE
from utils.logger import get_logger

logger = get_logger(__name__)

# Per-request timeout for SerpAPI calls (seconds).
_SERPAPI_TIMEOUT = 30


def search_images(query: str, top_k: int = TOP_K_IMAGES) -> list[str]:
    """Search Google Images via SerpAPI for *query* and return image URLs.

    This is a **synchronous** function.  When called from an async context,
    use :func:`search_images_async` instead to avoid blocking the event loop.

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

    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            logger.info(
                "Image search attempt %d/%d for '%s'", attempt + 1, MAX_RETRIES, query
            )
            client = SerpApiClient(api_key=SERPAPI_KEY)
            results = client.search(
                engine="google_images",
                q=query,
                num=top_k,
                timeout=_SERPAPI_TIMEOUT,
            )

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


async def search_images_async(query: str, top_k: int = TOP_K_IMAGES) -> list[str]:
    """Async wrapper — runs :func:`search_images` in a thread pool."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, search_images, query, top_k)
