"""Image generation service using OpenAI-compatible API."""

import asyncio
import logging

import httpx
from openai import APIConnectionError, AsyncOpenAI, InternalServerError, RateLimitError

from app.config import Settings

logger = logging.getLogger(__name__)

# Upstream failures worth retrying: dropped connections, 5xx, and rate limits.
_TRANSIENT_ERRORS = (APIConnectionError, InternalServerError, RateLimitError)


class ImageGenerationUnavailableError(Exception):
    """The upstream image provider kept failing transiently after all retries."""


class ImageGenerationService:
    """Generate images from text prompts using gpt-image-2 API."""

    def __init__(
        self,
        settings: Settings,
        *,
        max_attempts: int = 3,
        retry_delay_seconds: float = 2.0,
    ):
        proxy_url = settings.image_proxy_url or None
        self._client = AsyncOpenAI(
            api_key=settings.image_api_key,
            base_url=settings.image_base_url,
            http_client=httpx.AsyncClient(
                proxy=proxy_url,
                timeout=settings.request_timeout_seconds,
                trust_env=False,
            ),
            # Retries are handled here with a longer backoff (the free relay can
            # stay broken for seconds); disable the SDK's own sub-second retries
            # so the total number of upstream calls stays bounded and predictable.
            max_retries=0,
        )
        self._model = settings.image_model
        self._max_attempts = max_attempts
        self._retry_delay_seconds = retry_delay_seconds

    async def generate_image(self, prompt: str) -> str:
        """Generate an image and return the URL.

        Transient upstream failures (dropped connection, 5xx, rate limit) are
        retried with increasing delay before giving up.

        Args:
            prompt: Text description of the desired image

        Returns:
            URL of the generated image

        Raises:
            ImageGenerationUnavailableError: All attempts failed transiently.
            Exception: Non-transient generation failure.
        """
        last_error: Exception | None = None
        for attempt in range(1, self._max_attempts + 1):
            if attempt > 1:
                await asyncio.sleep(self._retry_delay_seconds * (attempt - 1))
            try:
                return await self._request_image(prompt)
            except _TRANSIENT_ERRORS as exc:
                last_error = exc
                logger.warning(
                    "Transient image generation failure (attempt %d/%d): %s",
                    attempt,
                    self._max_attempts,
                    type(exc).__name__,
                )
        raise ImageGenerationUnavailableError(
            f"Image provider failed after {self._max_attempts} attempts"
        ) from last_error

    async def _request_image(self, prompt: str) -> str:
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
