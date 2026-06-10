"""Shared pytest fixtures.

The chat endpoints depend on ``get_llm_provider`` and ``get_retriever``; tests
override both with fakes so no network access or API key is required.

Auth routes still have JWT coverage; chat/file/image endpoints are temporarily
open for local testing.
"""

from collections.abc import AsyncIterator, Iterator

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_current_user
from app.llm.factory import get_llm_provider
from app.main import app
from app.models import User
from app.rag.factory import get_retriever
from app.rag.retriever import Retriever
from app.rag.store import Document, VectorStore
from app.schemas import ChatMessage

# A tiny fixed vocabulary makes fake embeddings deterministic and meaningful:
# texts sharing a keyword get a high cosine similarity.
_VOCAB = ["防水", "闭水", "瓷砖", "水电", "预算", "甲醛", "流程", "乳胶漆"]


def fake_vector(text: str) -> list[float]:
    return [float(text.count(word)) for word in _VOCAB]


class FakeProvider:
    """In-memory LLM provider for tests (non-streaming and streaming)."""

    def __init__(self, reply: str = "测试回复") -> None:
        self._reply = reply
        self._stream_pieces = ["测试", "回复"]
        self.received: list[ChatMessage] | None = None

    async def chat(self, messages: list[ChatMessage]) -> str:
        self.received = messages
        return self._reply

    async def chat_stream(self, messages: list[ChatMessage]) -> AsyncIterator[str]:
        self.received = messages
        for piece in self._stream_pieces:
            yield piece


class FakeEmbeddings:
    """Deterministic keyword-based embeddings for tests (no network)."""

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [fake_vector(text) for text in texts]

    async def embed_query(self, text: str) -> list[float]:
        return fake_vector(text)


def make_store(documents: list[Document]) -> VectorStore:
    store = VectorStore(dim=len(_VOCAB), model="fake")
    store.add(documents, [fake_vector(doc.text) for doc in documents])
    return store


def _empty_retriever() -> Retriever:
    store = VectorStore(dim=len(_VOCAB), model="fake")
    return Retriever(store, FakeEmbeddings(), top_k=4, min_score=0.3)


def _populated_retriever() -> Retriever:
    documents = [
        Document(
            id="wp-0",
            text="卫生间淋浴区防水建议刷到1.8米高，并做闭水试验。",
            source="waterproofing · 防水高度",
        ),
        Document(
            id="tile-0",
            text="贴瓷砖前地面要找平、清理干净。",
            source="tiling · 准备",
        ),
        Document(
            id="budget-0",
            text="装修预算可按基础装修加主材分块估算。",
            source="budget · 预算",
        ),
    ]
    return Retriever(make_store(documents), FakeEmbeddings(), top_k=4, min_score=0.3)


@pytest.fixture
def fake_provider() -> FakeProvider:
    return FakeProvider()


def _fake_user() -> User:
    """Return a fake authenticated user for tests."""
    user = User(username="testuser", hashed_password="fakehash", is_active=True)
    user.id = 1
    return user


@pytest.fixture
def client(fake_provider: FakeProvider) -> Iterator[TestClient]:
    app.dependency_overrides[get_llm_provider] = lambda: fake_provider
    app.dependency_overrides[get_retriever] = _empty_retriever
    app.dependency_overrides[get_current_user] = _fake_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def client_with_index(fake_provider: FakeProvider) -> Iterator[TestClient]:
    app.dependency_overrides[get_llm_provider] = lambda: fake_provider
    app.dependency_overrides[get_retriever] = _populated_retriever
    app.dependency_overrides[get_current_user] = _fake_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
