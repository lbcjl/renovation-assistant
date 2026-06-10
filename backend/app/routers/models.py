"""Model listing endpoint.

Exposes the chat models available at the configured OpenAI-compatible LLM
endpoint so the frontend can offer a model picker. The selected model is sent
back per chat request (``ChatRequest.model``).
"""

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.config import Settings, get_settings
from app.schemas import ModelListResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/models", tags=["models"])

_LIST_TIMEOUT_SECONDS = 15.0


async def _fetch_model_ids(base_url: str, api_key: str) -> list[str]:
    """Return the model ids served by an OpenAI-compatible ``/models`` endpoint."""
    async with httpx.AsyncClient(timeout=_LIST_TIMEOUT_SECONDS) as client:
        response = await client.get(
            f"{base_url.rstrip('/')}/models",
            headers={"Authorization": f"Bearer {api_key}"},
        )
        response.raise_for_status()
        payload = response.json()
    return sorted(
        {item["id"] for item in payload.get("data", []) if isinstance(item.get("id"), str)}
    )


@router.get("", response_model=ModelListResponse)
async def list_models(settings: Settings = Depends(get_settings)) -> ModelListResponse:
    """List chat models available at the configured LLM endpoint.

    Authentication is temporarily disabled for local testing.
    """
    if not settings.llm_api_key:
        raise HTTPException(status_code=503, detail="LLM not configured")
    try:
        models = await _fetch_model_ids(settings.llm_base_url, settings.llm_api_key)
    except Exception as exc:  # noqa: BLE001 - surface any upstream failure as 502
        logger.exception("Failed to list models from LLM provider")
        raise HTTPException(status_code=502, detail="Failed to list models") from exc
    return ModelListResponse(models=models, default=settings.llm_model)
