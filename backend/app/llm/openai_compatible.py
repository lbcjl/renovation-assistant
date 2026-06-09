"""LLM provider for any OpenAI-compatible Chat Completions API.

DeepSeek, Qwen (DashScope compatible mode) and Zhipu GLM all expose an
OpenAI-compatible endpoint, so one implementation covers the domestic models
we support; switching is purely a matter of base_url / model / api_key.
"""

from openai import AsyncOpenAI

from app.schemas import ChatMessage


class OpenAICompatibleProvider:
    """Call an OpenAI-compatible chat API."""

    def __init__(self, *, api_key: str, base_url: str, model: str) -> None:
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self._model = model

    async def chat(self, messages: list[ChatMessage]) -> str:
        completion = await self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
        )
        return completion.choices[0].message.content or ""
