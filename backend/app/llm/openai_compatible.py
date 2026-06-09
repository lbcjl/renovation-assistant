"""LLM provider for any OpenAI-compatible Chat Completions API.

DeepSeek, Qwen (DashScope compatible mode) and Zhipu GLM all expose an
OpenAI-compatible endpoint, so one implementation covers the domestic models
we support; switching is purely a matter of base_url / model / api_key.
"""

from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from app.schemas import ChatMessage


class OpenAICompatibleProvider:
    """Call an OpenAI-compatible chat API.

    The HTTP client is created lazily, so the provider can be constructed without
    credentials; a missing key surfaces as an error only when a chat call is
    made (handled as a 502 at the API boundary), never at construction time.
    """

    def __init__(self, *, api_key: str, base_url: str, model: str, timeout: float = 60.0) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._model = model
        self._timeout = timeout
        self._client: AsyncOpenAI | None = None

    def _client_or_create(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self._api_key, base_url=self._base_url)
        return self._client

    def _payload(self, messages: list[ChatMessage]) -> list[dict[str, str]]:
        return [{"role": m.role, "content": m.content} for m in messages]

    async def chat(self, messages: list[ChatMessage]) -> str:
        completion = await self._client_or_create().chat.completions.create(
            model=self._model,
            messages=self._payload(messages),
            timeout=self._timeout,
        )
        return completion.choices[0].message.content or ""

    async def chat_stream(self, messages: list[ChatMessage]) -> AsyncIterator[str]:
        stream = await self._client_or_create().chat.completions.create(
            model=self._model,
            messages=self._payload(messages),
            stream=True,
            timeout=self._timeout,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
