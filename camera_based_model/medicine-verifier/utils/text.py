"""Shared text utilities for the medicine-verifier pipeline."""

from __future__ import annotations

import re


def extract_json(raw: str) -> str:
    """Strip optional markdown code fences and return the inner JSON string.

    Handles responses like:
        ```json
        {"key": "value"}
        ```

    If no fences are found, returns the input unchanged.
    """
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw)
    if match:
        return match.group(1)
    return raw
