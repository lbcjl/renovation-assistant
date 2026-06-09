"""Embedding provider for an OpenAI-compatible /embeddings API.

Defaults target SiliconFlow hosting BAAI/bge-m3 (strong Chinese retrieval),
so no local embedding model is required.
"""

from typing import Protocol

from openai import AsyncOpenAI


class EmbeddingProvider(Protocol):
    """Interface for turning text into vectors."""

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of documents."""
        ...

    async def embed_query(self, text: str) -> list[float]:
        """Embed a single query string."""
        ...


class OpenAICompatibleEmbeddings:
    """Call an OpenAI-compatible /embeddings endpoint."""

    def __init__(self, *, api_key: str, base_url: str, model: str) -> None:
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self._model = model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        response = await self._client.embeddings.create(model=self._model, input=texts)
        # The API may reorder; sort by index to be safe.
        ordered = sorted(response.data, key=lambda item: item.index)
        return [item.embedding for item in ordered]

    async def embed_query(self, text: str) -> list[float]:
        vectors = await self.embed([text])
        return vectors[0]
