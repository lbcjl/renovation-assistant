"""Construct the configured LLM provider."""

from functools import lru_cache

from app.config import get_settings
from app.llm.base import LLMProvider
from app.llm.openai_compatible import OpenAICompatibleProvider
from app.services.runtime_config import load_provider_config


@lru_cache(maxsize=8)
def _provider_for(
    api_key: str, base_url: str, model: str, timeout: float
) -> OpenAICompatibleProvider:
    """Cache providers by connection settings so HTTP clients are reused."""
    return OpenAICompatibleProvider(
        api_key=api_key, base_url=base_url, model=model, timeout=timeout
    )


def get_llm_provider() -> LLMProvider:
    """Return the LLM provider for the current runtime configuration.

    The runtime config (``data/provider_config.json``, editable from the
    settings page) overrides the ``.env`` defaults, so changes apply on the
    next chat request without a restart. All supported endpoints speak the
    OpenAI-compatible protocol, so they share one implementation.
    """
    settings = get_settings()
    config = load_provider_config("llm", settings)
    return _provider_for(
        config.api_key, config.base_url, config.model, settings.request_timeout_seconds
    )
