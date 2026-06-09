"""Build the vector index from markdown docs in the knowledge directory.

Usage (from the backend/ directory, with EMBEDDING_API_KEY set in .env):

    python -m app.rag.ingest
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from app.config import get_settings
from app.rag.chunking import chunk_markdown
from app.rag.embeddings import OpenAICompatibleEmbeddings
from app.rag.store import Document, VectorStore


async def build_index() -> VectorStore:
    settings = get_settings()
    knowledge_dir = Path(settings.knowledge_dir)
    doc_paths = sorted(knowledge_dir.glob("*.md"))
    if not doc_paths:
        raise SystemExit(f"No .md files found in {knowledge_dir.resolve()}")
    if not settings.embedding_api_key:
        raise SystemExit("EMBEDDING_API_KEY is not set; cannot build the index.")

    documents: list[Document] = []
    for path in doc_paths:
        text = path.read_text(encoding="utf-8")
        for i, (chunk, source) in enumerate(chunk_markdown(text, path.stem)):
            documents.append(Document(id=f"{path.stem}-{i}", text=chunk, source=source))

    embeddings = OpenAICompatibleEmbeddings(
        api_key=settings.embedding_api_key,
        base_url=settings.embedding_base_url,
        model=settings.embedding_model,
    )
    vectors = await embeddings.embed([doc.text for doc in documents])

    store = VectorStore(dim=len(vectors[0]), model=settings.embedding_model)
    store.add(documents, vectors)
    store.save(Path(settings.index_dir))
    print(f"Indexed {store.size} chunks from {len(doc_paths)} docs -> {settings.index_dir}")
    return store


if __name__ == "__main__":
    asyncio.run(build_index())
