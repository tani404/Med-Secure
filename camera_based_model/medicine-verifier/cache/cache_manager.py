"""
Persistent disk cache for query results (URLs + CLIP embeddings).

Uses :pypi:`diskcache` with SHA-256 keys and a configurable TTL.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

import numpy as np
from diskcache import Cache

from config import CACHE_DIR, CACHE_TTL
from utils.logger import get_logger

logger = get_logger(__name__)


class CacheManager:
    """Thin wrapper around :class:`diskcache.Cache` keyed by query string."""

    def __init__(self, cache_dir: str = CACHE_DIR, ttl: int = CACHE_TTL) -> None:
        self._cache = Cache(cache_dir)
        self._ttl = ttl
        logger.info("Cache initialised at %s (TTL=%ds)", cache_dir, ttl)

    # ── helpers ──────────────────────────────────────────────────────────
    @staticmethod
    def _key(query: str) -> str:
        """Return a stable SHA-256 hex digest of *query*."""
        return hashlib.sha256(query.strip().lower().encode()).hexdigest()

    @staticmethod
    def _serialise_embeddings(embeddings: list[np.ndarray]) -> list[list[float]]:
        return [emb.tolist() for emb in embeddings]

    @staticmethod
    def _deserialise_embeddings(raw: list[list[float]]) -> list[np.ndarray]:
        return [np.array(emb, dtype=np.float32) for emb in raw]

    # ── public API ───────────────────────────────────────────────────────
    def get(self, query: str) -> dict[str, Any] | None:
        """Look up cached results for *query*.

        Args:
            query: The search query string.

        Returns:
            ``{"urls": [...], "embeddings": [...]}`` on hit, else ``None``.
        """
        key = self._key(query)
        raw: str | None = self._cache.get(key)
        if raw is None:
            logger.debug("Cache MISS for query: %s", query)
            return None
        logger.info("Cache HIT for query: %s", query)
        data = json.loads(raw)
        data["embeddings"] = self._deserialise_embeddings(data["embeddings"])
        return data

    def set(self, query: str, urls: list[str], embeddings: list[np.ndarray]) -> None:
        """Store search results for *query*.

        Args:
            query: The search query string.
            urls: Reference image URLs.
            embeddings: Corresponding CLIP embeddings.
        """
        key = self._key(query)
        payload = json.dumps({
            "urls": urls,
            "embeddings": self._serialise_embeddings(embeddings),
        })
        self._cache.set(key, payload, expire=self._ttl)
        logger.info("Cached %d results for query: %s", len(urls), query)

    def clear(self) -> None:
        """Evict all cached entries."""
        self._cache.clear()
        logger.info("Cache cleared")

    def close(self) -> None:
        """Close the underlying diskcache store."""
        self._cache.close()
