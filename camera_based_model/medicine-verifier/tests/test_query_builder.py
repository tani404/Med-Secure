"""
Unit tests for pipeline.query_builder module.

These tests mock the NVIDIA NIM API call so they run without credentials.
"""

import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.query_builder import build_query, SYSTEM_PROMPT


@pytest.fixture
def mock_openai_client():
    """Fixture that patches the OpenAI client used inside build_query."""
    with patch("pipeline.query_builder.OpenAI") as MockClient:
        instance = MagicMock()
        MockClient.return_value = instance
        yield instance


class TestBuildQuery:
    def test_returns_cleaned_query(self, mock_openai_client):
        mock_openai_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="paracetamol 500mg tablet"))]
        )
        result = build_query("Paraceta mol IP 500 mg Tab lets")
        assert result == "paracetamol 500mg tablet"

    def test_strips_quotes(self, mock_openai_client):
        mock_openai_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content='"amoxicillin 250mg capsule"'))]
        )
        result = build_query("Amoxicill in 250 mg Cap")
        assert result == "amoxicillin 250mg capsule"

    def test_retries_on_failure(self, mock_openai_client):
        mock_openai_client.chat.completions.create.side_effect = [
            RuntimeError("API down"),
            MagicMock(
                choices=[MagicMock(message=MagicMock(content="ibuprofen 400mg tablet"))]
            ),
        ]
        with patch("pipeline.query_builder.time.sleep"):
            result = build_query("Ibu prof en 400")
        assert result == "ibuprofen 400mg tablet"

    def test_raises_after_max_retries(self, mock_openai_client):
        mock_openai_client.chat.completions.create.side_effect = RuntimeError("down")
        with patch("pipeline.query_builder.time.sleep"):
            with pytest.raises(RuntimeError, match="failed after"):
                build_query("bad text")

    def test_system_prompt_content(self):
        assert "pharmaceutical" in SYSTEM_PROMPT.lower()
        assert "max 8 words" in SYSTEM_PROMPT

    def test_empty_response_raises(self, mock_openai_client):
        mock_openai_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="   "))]
        )
        with patch("pipeline.query_builder.time.sleep"):
            with pytest.raises(RuntimeError, match="failed after"):
                build_query("some text")
