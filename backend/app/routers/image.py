"""Image generation endpoint."""

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.config import get_settings
from app.schemas import ImageGenerationRequest, ImageGenerationResponse
from app.services.image_service import ImageGenerationService, ImageGenerationUnavailableError
from app.services.runtime_config import load_provider_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/image", tags=["image"])


def get_image_service() -> ImageGenerationService:
    """Dependency: image generation service built from the runtime config.

    The runtime config (``data/provider_config.json``, editable from the
    settings page) overrides the ``.env`` defaults, so changes apply on the
    next request without a restart.
    """
    settings = get_settings()
    config = load_provider_config("image", settings)
    if not config.api_key:
        raise HTTPException(status_code=503, detail="Image generation not configured")
    effective = settings.model_copy(
        update={
            "image_api_key": config.api_key,
            "image_base_url": config.base_url,
            "image_model": config.model,
        }
    )
    return ImageGenerationService(effective)


@router.post("/generate", response_model=ImageGenerationResponse)
async def generate_image(
    request: ImageGenerationRequest,
    service: ImageGenerationService = Depends(get_image_service),
) -> ImageGenerationResponse:
    """Generate an image from a text prompt.

    Authentication is temporarily disabled for local testing.
    """
    try:
        image_url = await service.generate_image(request.prompt)
    except ImageGenerationUnavailableError as exc:
        logger.warning("Image provider unavailable after retries")
        raise HTTPException(
            status_code=503, detail="Image service temporarily unavailable"
        ) from exc
    except Exception as exc:
        logger.exception("Image generation failed")
        raise HTTPException(status_code=502, detail="Image generation failed") from exc
    return ImageGenerationResponse(image_url=image_url)
