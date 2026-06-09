"""Tests for the retriever (deterministic fake embeddings, no network)."""

import asyncio

from app.rag.retriever import Retriever
from app.rag.store import Document, VectorStore
from tests.conftest import FakeEmbeddings, make_store


def _retriever(min_score: float = 0.3) -> Retriever:
    documents = [
        Document(id="wp", text="卫生间防水刷到1.8米并做闭水试验", source="waterproofing"),
        Document(id="tile", text="贴瓷砖前地面要找平", source="tiling"),
    ]
    return Retriever(make_store(documents), FakeEmbeddings(), top_k=4, min_score=min_score)


def test_retrieve_finds_relevant_doc() -> None:
    context = asyncio.run(_retriever().retrieve("防水要刷多高"))
    assert not context.is_empty
    assert context.hits[0].document.source == "waterproofing"


def test_retrieve_empty_store_returns_empty() -> None:
    retriever = Retriever(
        VectorStore(dim=8, model="fake"), FakeEmbeddings(), top_k=4, min_score=0.3
    )
    assert asyncio.run(retriever.retrieve("防水")).is_empty


def test_retrieve_below_threshold_is_filtered() -> None:
    # A query sharing no vocabulary yields a zero vector -> score 0 -> filtered out.
    assert asyncio.run(_retriever().retrieve("今天天气怎么样")).is_empty
