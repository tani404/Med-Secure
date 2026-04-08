"""
CLIP embedding engine.

Wraps the singleton model/processor from :mod:`models.clip_model` and
returns L2-normalised image embeddings as numpy arrays.
"""

from __future__ import annotations

import numpy as np
import torch
from PIL import Image

from models.clip_model import get_clip_model, get_clip_processor, get_device
from utils.logger import get_logger

logger = get_logger(__name__)


class CLIPEmbedder:
    """Produce L2-normalised CLIP image embeddings."""

    def __init__(self) -> None:
        self._model = get_clip_model()
        self._processor = get_clip_processor()
        self._device = get_device()
        logger.info("CLIPEmbedder ready on %s", self._device)

    def embed_image(self, image: Image.Image) -> np.ndarray:
        """Compute the CLIP embedding for a single image.

        Args:
            image: PIL Image (RGB).

        Returns:
            L2-normalised numpy array of shape ``(512,)`` or ``(768,)``.
        """
        inputs = self._processor(images=image, return_tensors="pt")
        pixel_values = inputs["pixel_values"].to(self._device)

        with torch.no_grad():
            # Use the full model forward to get pooled image embedding
            vision_outputs = self._model.vision_model(pixel_values=pixel_values)
            # pooler_output is the CLS token -> shape (1, hidden_dim)
            pooled = vision_outputs.pooler_output
            # Project through the visual projection layer -> shape (1, projection_dim)
            image_embeds = self._model.visual_projection(pooled)

        # L2 normalise
        image_embeds = image_embeds / image_embeds.norm(dim=-1, keepdim=True)
        embedding = image_embeds.squeeze(0).cpu().numpy().astype(np.float32)
        logger.debug("Embedded image -> shape %s", embedding.shape)
        return embedding

    def embed_images(self, images: list[Image.Image]) -> list[np.ndarray]:
        """Embed a batch of images using CLIP's native batching.

        Args:
            images: List of PIL Images.

        Returns:
            List of L2-normalised numpy arrays.
        """
        if not images:
            return []

        # Process all images in a single batched forward pass
        inputs = self._processor(images=images, return_tensors="pt", padding=True)
        pixel_values = inputs["pixel_values"].to(self._device)

        with torch.no_grad():
            vision_outputs = self._model.vision_model(pixel_values=pixel_values)
            pooled = vision_outputs.pooler_output
            image_embeds = self._model.visual_projection(pooled)

        # L2 normalise each embedding
        image_embeds = image_embeds / image_embeds.norm(dim=-1, keepdim=True)
        embeddings = image_embeds.cpu().numpy().astype(np.float32)

        logger.debug("Batch-embedded %d images -> shape %s", len(images), embeddings.shape)
        return [embeddings[i] for i in range(len(images))]
