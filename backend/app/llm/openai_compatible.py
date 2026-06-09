"""LLM provider for any OpenAI-compatible Chat Completions API.

DeepSeek, Qwen (DashScope compatible mode) and Zhipu GLM all expose an
OpenAI-compatible endpoint, so one implementation covers the domestic models
we support; switching is purely a matter of base_url / model / api_key.
"""

from openai import AsyncOpenAI

from app.schemas import ChatMessage


class OpenAICompatibleProvider:
    """Call an OpenAI-compatible chat API.

    The HTTP client is created lazily, so the provider can be constructed without
    credentials; a missing key surfaces as an error only when ``chat()`` is
    called (handled as a 502 at the API boundary), never at construction time.
    """

    def __init__(self, *, api_key: str, base_url: str, model: str) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._model = model
        self._client: AsyncOpenAI | None = None

    def _client_or_create(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self._api_key, base_url=self._base_url)
        return self._client

    async def chat(self, messages: list[ChatMessage]) -> str:
        completion = await self._client_or_create().chat.completions.create(
            model=self._model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
        )
        return completion.choices[0].message.content or ""
