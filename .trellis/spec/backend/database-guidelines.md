# Database Guidelines

> Data persistence patterns. **The MVP has no relational database.**

---

## Current state (MVP)

There is **no SQL database**. Knowledge persistence is file-based:

| Data | Location | Tracked in git? |
|------|----------|-----------------|
| Source knowledge docs | `data/knowledge/**/*.md` | ✅ committed |
| Built vector index | `data/index/` (`embeddings.json` + `documents.json`) | ❌ gitignored (rebuildable) |
| Uploaded files + metadata | `data/uploads/`, `data/file_metadata.json` | ❌ gitignored (runtime data) |
| Runtime provider settings | `data/provider_config.json` (contains API keys) | ❌ gitignored |

- The vector "store" is `lib/rag/store.ts` (`VectorStore`): an in-memory matrix of
  normalized vectors with cosine search, persisted as JSON via `save()` / `load()`.
- Rebuild the index with: `npm run ingest` (requires `EMBEDDING_API_KEY`).
- The user DB that backed JWT auth (SQLAlchemy/Alembic) was dropped together with
  login in the 2026-06 Next.js migration.

## When a database is introduced later

Document here, before writing code:
- ORM/driver choice and why.
- Migration tool and workflow.
- Naming conventions (tables, columns), and query patterns.
- How it relates to / replaces the file-based index above (e.g. `sqlite-vec`, `pgvector`, Qdrant).

## Common Mistakes

- ❌ Committing the built index (`data/index/`) — it is derived from the docs.
- ❌ Committing `data/provider_config.json` — it stores API keys in plain text.
- ❌ Storing secrets or user PII inside the index/documents.
