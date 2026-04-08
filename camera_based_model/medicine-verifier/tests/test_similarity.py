"""
Unit tests for pipeline.similarity module.
"""

import numpy as np
import pytest
import sys
from pathlib import Path

# Ensure project root is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.similarity import cosine_similarity, score_to_status, find_best_match


# ── cosine_similarity ───────────────────────────────────────────────────────

class TestCosineSimilarity:
    def test_identical_vectors(self):
        v = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        assert cosine_similarity(v, v) == pytest.approx(1.0)

    def test_orthogonal_vectors(self):
        a = np.array([1.0, 0.0], dtype=np.float32)
        b = np.array([0.0, 1.0], dtype=np.float32)
        assert cosine_similarity(a, b) == pytest.approx(0.0)

    def test_opposite_vectors(self):
        a = np.array([1.0, 0.0], dtype=np.float32)
        b = np.array([-1.0, 0.0], dtype=np.float32)
        assert cosine_similarity(a, b) == pytest.approx(-1.0)

    def test_normalised_vectors(self):
        a = np.array([0.6, 0.8], dtype=np.float32)  # already unit-length
        b = np.array([0.8, 0.6], dtype=np.float32)
        expected = 0.6 * 0.8 + 0.8 * 0.6  # 0.96
        assert cosine_similarity(a, b) == pytest.approx(expected, abs=1e-5)

    def test_high_dimensional(self):
        rng = np.random.default_rng(42)
        a = rng.random(512).astype(np.float32)
        a /= np.linalg.norm(a)
        assert cosine_similarity(a, a) == pytest.approx(1.0, abs=1e-5)


# ── score_to_status ─────────────────────────────────────────────────────────

class TestScoreToStatus:
    """Tests aligned with config.py thresholds: verified=0.60, possible=0.45."""

    def test_verified(self):
        assert score_to_status(0.90) == "verified"
        assert score_to_status(0.60) == "verified"

    def test_possible(self):
        assert score_to_status(0.55) == "possible"
        assert score_to_status(0.45) == "possible"

    def test_rejected(self):
        assert score_to_status(0.44) == "rejected"
        assert score_to_status(0.0) == "rejected"
        assert score_to_status(-0.5) == "rejected"

    def test_boundary_verified(self):
        assert score_to_status(0.60) == "verified"
        assert score_to_status(0.5999) == "possible"

    def test_boundary_possible(self):
        assert score_to_status(0.45) == "possible"
        assert score_to_status(0.4499) == "rejected"


# ── find_best_match ─────────────────────────────────────────────────────────

class TestFindBestMatch:
    def test_single_reference(self):
        inp = np.array([1.0, 0.0], dtype=np.float32)
        refs = [np.array([0.9, 0.1], dtype=np.float32)]
        score, idx = find_best_match(inp, refs)
        assert idx == 0
        assert score == pytest.approx(0.9, abs=1e-5)

    def test_multiple_references(self):
        inp = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        refs = [
            np.array([0.0, 1.0, 0.0], dtype=np.float32),  # 0.0
            np.array([0.9, 0.1, 0.0], dtype=np.float32),  # 0.9
            np.array([0.5, 0.5, 0.0], dtype=np.float32),  # 0.5
        ]
        score, idx = find_best_match(inp, refs)
        assert idx == 1
        assert score == pytest.approx(0.9, abs=1e-5)

    def test_empty_refs_raises(self):
        inp = np.array([1.0, 0.0], dtype=np.float32)
        with pytest.raises(ValueError, match="at least one"):
            find_best_match(inp, [])

    def test_identical_match(self):
        v = np.array([0.6, 0.8], dtype=np.float32)
        refs = [
            np.array([0.0, 1.0], dtype=np.float32),
            v.copy(),
        ]
        score, idx = find_best_match(v, refs)
        assert idx == 1
        assert score == pytest.approx(1.0, abs=1e-5)
