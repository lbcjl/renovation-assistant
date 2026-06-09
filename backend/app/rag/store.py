"""Minimal persistent vector store: cosine similarity over NumPy arrays.

This is intentionally simple and dependency-light. It is a good fit for an
MVP-sized knowledge base (hundreds of chunks); swap it for sqlite-vec or a
dedicated vector database when the corpus grows.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

_EMBEDDINGS_FILE = "embeddings.npy"
_DOCUMENTS_FILE = "documents.json"


@dataclass
class Document:
    """A retrievable knowledge chunk."""

    id: str
    text: str
    source: str


@dataclass
class SearchHit:
    """A document plus its similarity score for a query."""

    document: Document
    score: float


class VectorStore:
    """In-memory cosine-similarity store with disk persistence."""

    def __init__(self, dim: int, model: str) -> None:
        self.dim = dim
        self.model = model
        self._documents: list[Document] = []
        self._matrix = np.zeros((0, dim), dtype=np.float32)

    @property
    def size(self) -> int:
        return len(self._documents)

    def add(self, documents: list[Document], embeddings: list[list[float]]) -> None:
        if not documents:
            return
        vectors = _normalize(np.asarray(embeddings, dtype=np.float32))
        self._documents.extend(documents)
        self._matrix = vectors if self._matrix.shape[0] == 0 else np.vstack([self._matrix, vectors])

    def search(self, query_embedding: list[float], top_k: int) -> list[SearchHit]:
        if not self._documents:
            return []
        query = _normalize(np.asarray([query_embedding], dtype=np.float32))[0]
        scores = self._matrix @ query  # cosine similarity (rows are normalized)
        top_indices = np.argsort(scores)[::-1][:top_k]
        return [SearchHit(self._documents[i], float(scores[i])) for i in top_indices]

    def save(self, index_dir: Path) -> None:
        index_dir.mkdir(parents=True, exist_ok=True)
        np.save(index_dir / _EMBEDDINGS_FILE, self._matrix)
        payload = {
            "model": self.model,
            "dim": self.dim,
            "documents": [asdict(doc) for doc in self._documents],
        }
        (index_dir / _DOCUMENTS_FILE).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    @classmethod
    def load(cls, index_dir: Path) -> VectorStore:
        meta = json.loads((index_dir / _DOCUMENTS_FILE).read_text(encoding="utf-8"))
        store = cls(dim=int(meta["dim"]), model=str(meta["model"]))
        store._documents = [Document(**doc) for doc in meta["documents"]]
        store._matrix = np.load(index_dir / _EMBEDDINGS_FILE)
        return store


def _normalize(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return matrix / norms
