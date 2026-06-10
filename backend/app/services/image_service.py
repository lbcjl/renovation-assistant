"""Image generation service using OpenAI-compatible API."""

import logging

from openai import AsyncOpenAI

from app.config import Settings

logger = logging.getLogger(__name__)


class ImageGenerationService:
    """Generate images from text prompts using gpt-image-2 API."""

    def __init__(self, settings: Settings):
        self._client = AsyncOpenAI(
            api_key=settings.image_api_key,
            base_url=settings.image_base_url,
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
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
        )
        # Extract image URL from response
        content = response.choices[0].message.content
        if not content:
            raise ValueError("No image URL in response")
        return content.strip()
