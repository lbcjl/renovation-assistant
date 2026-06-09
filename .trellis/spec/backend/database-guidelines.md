# Database Guidelines

> Data persistence patterns. **The MVP has no relational database.**

---

## Current state (MVP)

There is **no SQL database**. Knowledge persistence is file-based:

| Data | Location | Tracked in git? |
|------|----------|-----------------|
| Source knowledge docs | `backend/data/knowledge/*.md` | ✅ committed |
| Built vector index | `backend/data/index/` (`embeddings.npy` + `documents.json`) | ❌ gitignored (rebuildable) |

- The vector "store" is `app/rag/store.py` (`VectorStore`): an in-memory NumPy matrix with
  cosine search, persisted via `save()` / `load()`.
- Rebuild the index with: `python -m app.rag.ingest` (requires `EMBEDDING_API_KEY`).

## When a database is introduced later

Document here, before writing code:
- ORM/driver choice and why.
- Migration tool and workflow.
- Naming conventions (tables, columns), and query patterns.
- How it relates to / replaces the file-based index above (e.g. `sqlite-vec`, `pgvector`, Qdrant).

## Common Mistakes

- ❌ Committing the built index (`data/index/`) — it is derived from the docs.
- ❌ Storing secrets or user PII inside the index/documents.
