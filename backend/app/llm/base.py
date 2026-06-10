"""LLM provider abstraction.

The chat endpoints depend on this Protocol, not on a concrete vendor, so a
provider can be swapped via configuration (see ``factory.get_llm_provider``).
"""

from collections.abc import AsyncIterator
from typing import Protocol

from app.schemas import ChatMessage


class LLMProvider(Protocol):
    """Minimal interface a chat LLM provider must implement."""

    async def chat(self, messages: list[ChatMessage], model: str | None = None) -> str:
        """Return the full assistant reply for the given conversation.

        ``model`` overrides the configured default model for this call.
        """
        ...

    def chat_stream(
        self, messages: list[ChatMessage], model: str | None = None
    ) -> AsyncIterator[str]:
        """Yield the assistant reply incrementally as text deltas.

        ``model`` overrides the configured default model for this call.
        """
        ...
