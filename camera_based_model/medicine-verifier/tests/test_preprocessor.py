"""
Unit tests for pipeline.preprocessor module.
"""

import sys
import tempfile
from pathlib import Path

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.preprocessor import preprocess
from config import MAX_IMAGE_DIMENSION


@pytest.fixture
def sample_image_path():
    """Create a temporary test image and return its path."""
    img = Image.new("RGB", (2048, 1536), color=(128, 128, 128))
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        img.save(f, format="PNG")
        return f.name


@pytest.fixture
def small_image_path():
    """Create a small temporary test image."""
    img = Image.new("RGB", (100, 80), color=(200, 100, 50))
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        img.save(f, format="JPEG")
        return f.name


class TestPreprocess:
    def test_output_is_rgb(self, sample_image_path):
        result = preprocess(sample_image_path)
        assert result.mode == "RGB"

    def test_resized_within_bounds(self, sample_image_path):
        result = preprocess(sample_image_path)
        w, h = result.size
        assert max(w, h) <= MAX_IMAGE_DIMENSION

    def test_preserves_aspect_ratio(self, sample_image_path):
        result = preprocess(sample_image_path)
        w, h = result.size
        original_ratio = 2048 / 1536
        new_ratio = w / h
        assert abs(original_ratio - new_ratio) < 0.02

    def test_small_image_not_upscaled(self, small_image_path):
        result = preprocess(small_image_path)
        w, h = result.size
        assert w <= 100 and h <= 80

    def test_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            preprocess("/nonexistent/path/image.png")
