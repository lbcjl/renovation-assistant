"""Image generation service using OpenAI-compatible API."""

import logging

import httpx
from openai import AsyncOpenAI

from app.config import Settings

logger = logging.getLogger(__name__)


class ImageGenerationService:
    """Generate images from text prompts using gpt-image-2 API."""

    def __init__(self, settings: Settings):
        proxy_url = settings.image_proxy_url or None
        self._client = AsyncOpenAI(
            api_key=settings.image_api_key,
            base_url=settings.image_base_url,
            http_client=httpx.AsyncClient(
                proxy=proxy_url,
                timeout=settings.request_timeout_seconds,
                trust_env=False,
            ),
        )
        self._model = settings.image_model

    async def generate_image(self, prompt: str) -> str:
        """Generate an image and return the URL.

        Args:
            prompt: Text description of the desired image

        Returns:
            URL of the generated image

        Raises:
            Exception: If generation fails
        """
        response = await self._client.images.generate(
            model=self._model,
            prompt=prompt,
            n=1,
            size="1024x1024",
        )
        image = response.data[0] if response.data else None
        if image is None:
            raise ValueError("No image data in response")
        if image.url:
            return image.url
        if image.b64_json:
            return f"data:image/png;base64,{image.b64_json}"
        raise ValueError("No image URL or base64 data in response")
