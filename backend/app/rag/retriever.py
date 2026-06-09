"""Retrieve relevant knowledge chunks for a user query."""

from __future__ import annotations

from dataclasses import dataclass

from app.rag.embeddings import EmbeddingProvider
from app.rag.store import SearchHit, VectorStore


@dataclass
class RetrievedContext:
    """Result of a retrieval: the relevant hits (may be empty)."""

    hits: list[SearchHit]

    @property
    def is_empty(self) -> bool:
        return not self.hits


class Retriever:
    """Embed a query, search the store, and keep hits above a score threshold."""

    def __init__(
        self,
        store: VectorStore,
        embeddings: EmbeddingProvider,
        *,
        top_k: int,
        min_score: float,
    ) -> None:
        self._store = store
        self._embeddings = embeddings
        self._top_k = top_k
        self._min_score = min_score

    @property
    def store(self) -> VectorStore:
        """Access the underlying vector store for direct operations."""
        return self._store

    async def retrieve(self, query: str) -> RetrievedContext:
        # No index yet -> behave gracefully (no embedding call, empty context).
        if self._store.size == 0 or not query.strip():
            return RetrievedContext(hits=[])
        query_vector = await self._embeddings.embed_query(query)
        hits = self._store.search(query_vector, self._top_k)
        relevant = [hit for hit in hits if hit.score >= self._min_score]
        return RetrievedContext(hits=relevant)
