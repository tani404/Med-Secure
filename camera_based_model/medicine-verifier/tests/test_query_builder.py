"""
Unit tests for pipeline.query_builder module.

These tests mock the Anthropic SDK call so they run without credentials.
"""

import sys
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.query_builder import build_query, SYSTEM_PROMPT


def _make_anthropic_response(text: str) -> MagicMock:
    """Create a mock Anthropic message response."""
    block = MagicMock()
    block.text = text
    msg = MagicMock()
    msg.content = [block]
    return msg


@pytest.fixture
def mock_anthropic_client():
    """Fixture that patches the Anthropic async client used inside build_query."""
    with patch("pipeline.query_builder.anthropic") as mock_mod:
        instance = AsyncMock()
        mock_mod.AsyncAnthropic.return_value = instance
        yield instance


class TestBuildQuery:
    @pytest.mark.asyncio
    async def test_returns_cleaned_query(self, mock_anthropic_client):
        mock_anthropic_client.messages.create.return_value = _make_anthropic_response(
            '{"medicine_name": "Paracetamol", "dosage": "500mg", "form": "tablet", '
            '"manufacturer": null, "primary_query": "paracetamol 500mg tablet", "alt_queries": []}'
        )
        result = await build_query("Paraceta mol IP 500 mg Tab lets")
        assert result["primary_query"] == "paracetamol 500mg tablet"

    @pytest.mark.asyncio
    async def test_returns_medicine_name(self, mock_anthropic_client):
        mock_anthropic_client.messages.create.return_value = _make_anthropic_response(
            '{"medicine_name": "Amoxicillin", "dosage": "250mg", "form": "capsule", '
            '"manufacturer": null, "primary_query": "amoxicillin 250mg capsule", "alt_queries": ["amoxicillin capsule"]}'
        )
        result = await build_query("Amoxicill in 250 mg Cap")
        assert result["medicine_name"] == "Amoxicillin"
        assert len(result["alt_queries"]) >= 1

    @pytest.mark.asyncio
    async def test_retries_on_failure(self, mock_anthropic_client):
        mock_anthropic_client.messages.create.side_effect = [
            RuntimeError("API down"),
            _make_anthropic_response(
                '{"medicine_name": "Ibuprofen", "dosage": "400mg", "form": "tablet", '
                '"manufacturer": null, "primary_query": "ibuprofen 400mg tablet", "alt_queries": []}'
            ),
        ]
        with patch("pipeline.query_builder.asyncio.sleep", new_callable=AsyncMock):
            result = await build_query("Ibu prof en 400")
        assert result["primary_query"] == "ibuprofen 400mg tablet"

    @pytest.mark.asyncio
    async def test_raises_after_max_retries(self, mock_anthropic_client):
        mock_anthropic_client.messages.create.side_effect = RuntimeError("down")
        with patch("pipeline.query_builder.asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(RuntimeError, match="failed after"):
                await build_query("bad text")

    def test_system_prompt_content(self):
        assert "pharmaceutical" in SYSTEM_PROMPT.lower()
        assert "max 6 words" in SYSTEM_PROMPT

    @pytest.mark.asyncio
    async def test_empty_primary_query_raises(self, mock_anthropic_client):
        mock_anthropic_client.messages.create.return_value = _make_anthropic_response(
            '{"medicine_name": "", "dosage": "", "form": "", '
            '"manufacturer": null, "primary_query": "", "alt_queries": []}'
        )
        with patch("pipeline.query_builder.asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(RuntimeError, match="failed after"):
                await build_query("some text")
