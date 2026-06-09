"""Tests for the NumPy-backed vector store."""

from pathlib import Path

from app.rag.store import Document, VectorStore


def _store() -> VectorStore:
    store = VectorStore(dim=3, model="test")
    store.add(
        [Document(id="a", text="a", source="A"), Document(id="b", text="b", source="B")],
        [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
    )
    return store


def test_search_returns_most_similar_first() -> None:
    hits = _store().search([0.9, 0.1, 0.0], top_k=2)
    assert hits[0].document.id == "a"
    assert hits[0].score > hits[1].score


def test_search_empty_store_returns_empty() -> None:
    store = VectorStore(dim=3, model="test")
    assert store.search([1.0, 0.0, 0.0], top_k=5) == []


def test_save_and_load_roundtrip(tmp_path: Path) -> None:
    _store().save(tmp_path)
    loaded = VectorStore.load(tmp_path)
    assert loaded.size == 2
    assert loaded.model == "test"
    assert loaded.search([1.0, 0.0, 0.0], top_k=1)[0].document.id == "a"
