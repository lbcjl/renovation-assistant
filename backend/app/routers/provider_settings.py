"""Provider settings endpoints (chat LLM and image generation).

Lets the frontend settings page read and edit each provider's connection
(base URL / API key / model) at runtime, and probe an endpoint for its
available models before saving. Saved values are persisted by
``app.services.runtime_config`` and picked up on the next request by
``app.llm.factory`` (chat) and ``app.routers.image`` (image generation).
"""

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.config import Settings, get_settings
from app.schemas import (
    FetchModelsRequest,
    ModelListResponse,
    ProviderSettingsResponse,
    ProviderSettingsUpdateRequest,
)
from app.services.runtime_config import (
    ProviderConfig,
    ProviderSection,
    load_provider_config,
    mask_api_key,
    save_provider_config,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])

_LIST_TIMEOUT_SECONDS = 15.0


async def _fetch_model_ids(base_url: str, api_key: str, proxy_url: str = "") -> list[str]:
    """Return the model ids served by an OpenAI-compatible ``/models`` endpoint."""
    async with httpx.AsyncClient(
        timeout=_LIST_TIMEOUT_SECONDS, proxy=proxy_url or None, trust_env=False
    ) as client:
        response = await client.get(
            f"{base_url.rstrip('/')}/models",
            headers={"Authorization": f"Bearer {api_key}"},
        )
        response.raise_for_status()
        payload = response.json()
    return sorted(
        {item["id"] for item in payload.get("data", []) if isinstance(item.get("id"), str)}
    )


def _to_response(config: ProviderConfig) -> ProviderSettingsResponse:
    return ProviderSettingsResponse(
        base_url=config.base_url,
        model=config.model,
        api_key_set=bool(config.api_key),
        api_key_preview=mask_api_key(config.api_key),
    )


@router.get("/{provider}", response_model=ProviderSettingsResponse)
async def get_provider_settings(
    provider: ProviderSection,
    settings: Settings = Depends(get_settings),
) -> ProviderSettingsResponse:
    """Current connection settings for a provider, with the API key masked.

    Authentication is temporarily disabled for local testing.
    """
    return _to_response(load_provider_config(provider, settings))


@router.put("/{provider}", response_model=ProviderSettingsResponse)
async def update_provider_settings(
    provider: ProviderSection,
    request: ProviderSettingsUpdateRequest,
    settings: Settings = Depends(get_settings),
) -> ProviderSettingsResponse:
    """Save new connection settings; they apply from the next request.

    Authentication is temporarily disabled for local testing.
    """
    current = load_provider_config(provider, settings)
    api_key = request.api_key or current.api_key
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is required")
    config = ProviderConfig(base_url=request.base_url, api_key=api_key, model=request.model)
    save_provider_config(provider, config)
    return _to_response(config)


@router.post("/{provider}/models", response_model=ModelListResponse)
async def list_models(
    provider: ProviderSection,
    request: FetchModelsRequest,
    settings: Settings = Depends(get_settings),
) -> ModelListResponse:
    """List models served by the given (or saved) OpenAI-compatible endpoint.

    Authentication is temporarily disabled for local testing.
    """
    current = load_provider_config(provider, settings)
    base_url = request.base_url or current.base_url
    api_key = request.api_key or current.api_key
    if not api_key:
        raise HTTPException(status_code=503, detail=f"{provider} provider not configured")
    # The image relay may only be reachable through the configured proxy.
    proxy_url = settings.image_proxy_url if provider == "image" else ""
    try:
        models = await _fetch_model_ids(base_url, api_key, proxy_url)
    except Exception as exc:  # noqa: BLE001 - surface any upstream failure as 502
        logger.exception("Failed to list models from %s endpoint", provider)
        raise HTTPException(status_code=502, detail="Failed to list models") from exc
    return ModelListResponse(models=models, default=current.model)
