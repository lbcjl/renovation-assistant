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
    """Call an OpenAI-compatible /embeddings endpoint.

    The HTTP client is created lazily, so the provider can be constructed without
    credentials (e.g. when no knowledge index exists yet and embeddings are never
    actually called). A missing key only fails when an embedding call is made.
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

    async def embed(self, texts: list[str]) -> list[list[float]]:
        response = await self._client_or_create().embeddings.create(
            model=self._model, input=texts
        )
        # The API may reorder; sort by index to be safe.
        ordered = sorted(response.data, key=lambda item: item.index)
        return [item.embedding for item in ordered]

    async def embed_query(self, text: str) -> list[float]:
        vectors = await self.embed([text])
        return vectors[0]
