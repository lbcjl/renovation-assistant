"""Construct the embedding provider and retriever from configuration."""

from functools import lru_cache
from pathlib import Path

from app.config import get_settings
from app.rag.embeddings import EmbeddingProvider, OpenAICompatibleEmbeddings
from app.rag.retriever import Retriever
from app.rag.store import VectorStore

_DOCUMENTS_FILE = "documents.json"


@lru_cache
def get_embeddings() -> EmbeddingProvider:
    settings = get_settings()
    return OpenAICompatibleEmbeddings(
        api_key=settings.embedding_api_key,
        base_url=settings.embedding_base_url,
        model=settings.embedding_model,
    )


@lru_cache
def get_retriever() -> Retriever:
    settings = get_settings()
    index_dir = Path(settings.index_dir)
    if (index_dir / _DOCUMENTS_FILE).exists():
        store = VectorStore.load(index_dir)
    else:
        # No index built yet: an empty store makes /chat degrade gracefully
        # to plain LLM answers (with honest "no knowledge base" hedging).
        store = VectorStore(dim=1, model=settings.embedding_model)
    return Retriever(
        store,
        get_embeddings(),
        top_k=settings.retrieval_top_k,
        min_score=settings.retrieval_min_score,
    )
