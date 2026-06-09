"""Provider construction and batching behavior (no network)."""

import asyncio
from types import SimpleNamespace

from app.llm.openai_compatible import OpenAICompatibleProvider
from app.rag.embeddings import OpenAICompatibleEmbeddings


def test_embeddings_provider_constructs_without_key() -> None:
    # Regression: an empty key must not raise at construction (lazy client).
    OpenAICompatibleEmbeddings(api_key="", base_url="https://example.test/v1", model="m")


def test_llm_provider_constructs_without_key() -> None:
    OpenAICompatibleProvider(api_key="", base_url="https://example.test/v1", model="m")


def test_embeddings_batches_requests_within_limit(monkeypatch) -> None:
    """embed() must split large inputs into batches of <= 10 (DashScope limit)."""
    provider = OpenAICompatibleEmbeddings(api_key="x", base_url="y", model="m")
    batch_sizes: list[int] = []

    class _StubEmbeddings:
        async def create(self, *, model: str, input: list[str]):
            batch_sizes.append(len(input))
            data = [SimpleNamespace(index=i, embedding=[0.0]) for i in range(len(input))]
            return SimpleNamespace(data=data)

    stub_client = SimpleNamespace(embeddings=_StubEmbeddings())
    monkeypatch.setattr(provider, "_client_or_create", lambda: stub_client)

    result = asyncio.run(provider.embed([f"t{i}" for i in range(23)]))

    assert len(result) == 23
    assert batch_sizes == [10, 10, 3]
