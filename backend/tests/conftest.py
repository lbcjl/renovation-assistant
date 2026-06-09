"""Shared pytest fixtures.

The chat endpoint depends on ``get_llm_provider``; tests override it with a
fake so no network access or API key is required.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.llm.factory import get_llm_provider
from app.main import app
from app.schemas import ChatMessage


class FakeProvider:
    """In-memory LLM provider for tests."""

    def __init__(self, reply: str = "测试回复") -> None:
        self._reply = reply
        self.received: list[ChatMessage] | None = None

    async def chat(self, messages: list[ChatMessage]) -> str:
        self.received = messages
        return self._reply


@pytest.fixture
def fake_provider() -> FakeProvider:
    return FakeProvider()


@pytest.fixture
def client(fake_provider: FakeProvider) -> Iterator[TestClient]:
    app.dependency_overrides[get_llm_provider] = lambda: fake_provider
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
