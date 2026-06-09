"""LLM provider abstraction.

The chat endpoint depends on this Protocol, not on a concrete vendor, so a
provider can be swapped via configuration (see ``factory.get_llm_provider``).
"""

from typing import Protocol

from app.schemas import ChatMessage


class LLMProvider(Protocol):
    """Minimal interface a chat LLM provider must implement."""

    async def chat(self, messages: list[ChatMessage]) -> str:
        """Return the assistant reply for the given conversation."""
        ...
