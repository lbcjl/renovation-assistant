"""Image generation endpoint."""

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.config import get_settings
from app.dependencies import get_current_user
from app.models import User
from app.schemas import ImageGenerationRequest, ImageGenerationResponse
from app.services.image_service import ImageGenerationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/image", tags=["image"])


def get_image_service() -> ImageGenerationService:
    """Dependency: image generation service."""
    settings = get_settings()
    if not settings.image_api_key:
        raise HTTPException(status_code=503, detail="Image generation not configured")
    return ImageGenerationService(settings)


@router.post("/generate", response_model=ImageGenerationResponse)
async def generate_image(
    request: ImageGenerationRequest,
    user: User = Depends(get_current_user),
    service: ImageGenerationService = Depends(get_image_service),
) -> ImageGenerationResponse:
    """Generate an image from a text prompt for an authenticated user."""
    try:
        image_url = await service.generate_image(request.prompt)
    except Exception as exc:
        logger.exception("Image generation failed")
        raise HTTPException(status_code=502, detail="Image generation failed") from exc
    return ImageGenerationResponse(image_url=image_url)
