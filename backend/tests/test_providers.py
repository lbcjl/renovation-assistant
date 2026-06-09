"""Providers must be constructible without credentials (lazy client).

Regression test: a missing key previously raised at construction, which made the
/chat dependency fail with 500 even when the client was never actually used
(e.g. no knowledge index, so embeddings are never called).
"""

from app.llm.openai_compatible import OpenAICompatibleProvider
from app.rag.embeddings import OpenAICompatibleEmbeddings


def test_embeddings_provider_constructs_without_key() -> None:
    # Must not raise even though api_key is empty.
    OpenAICompatibleEmbeddings(api_key="", base_url="https://example.test/v1", model="m")


def test_llm_provider_constructs_without_key() -> None:
    OpenAICompatibleProvider(api_key="", base_url="https://example.test/v1", model="m")
