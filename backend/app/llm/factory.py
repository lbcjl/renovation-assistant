"""Construct the configured LLM provider."""

from functools import lru_cache

from app.config import get_settings
from app.llm.base import LLMProvider
from app.llm.openai_compatible import OpenAICompatibleProvider


@lru_cache
def get_llm_provider() -> LLMProvider:
    """Return the LLM provider selected by configuration.

    All currently supported providers (deepseek, qwen, glm) speak the
    OpenAI-compatible protocol, so they share one implementation.
    """
    settings = get_settings()
    return OpenAICompatibleProvider(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        model=settings.llm_model,
        timeout=settings.request_timeout_seconds,
    )
