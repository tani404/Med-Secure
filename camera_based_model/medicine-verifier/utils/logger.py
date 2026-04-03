"""
Structured logging with timestamps for each pipeline step.

Usage:
    from utils.logger import get_logger
    logger = get_logger(__name__)
    logger.info("Starting OCR step")
"""

import logging
import sys
from datetime import datetime, timezone


class _PipelineFormatter(logging.Formatter):
    """Formatter that prepends an ISO-8601 UTC timestamp and step duration."""

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        level = record.levelname.ljust(8)
        name = record.name
        message = record.getMessage()
        base = f"[{timestamp}] {level} {name} :: {message}"
        if record.exc_info:
            base += "\n" + self.formatException(record.exc_info)
        return base


def get_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """Return a logger configured with the pipeline formatter.

    Args:
        name: Logger name (typically ``__name__``).
        level: Minimum log level.

    Returns:
        Configured :class:`logging.Logger` instance.
    """
    logger = logging.getLogger(name)
    if not logger.handlers:
        # Force UTF-8 on Windows to avoid cp1252 encoding errors
        stream = open(sys.stdout.fileno(), mode="w", encoding="utf-8", closefd=False)
        handler = logging.StreamHandler(stream)
        handler.setFormatter(_PipelineFormatter())
        logger.addHandler(handler)
    logger.setLevel(level)
    return logger
