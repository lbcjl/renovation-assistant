# Directory Structure

> How backend code is organized in this project. Documents the actual layout under `backend/`.

---

## Directory Layout

```
backend/
├── app/
│   ├── main.py            # FastAPI app + route handlers (thin; delegate out)
│   ├── config.py          # pydantic-settings: one Settings + get_settings()
│   ├── schemas.py         # Pydantic request/response models (API boundary)
│   ├── prompts.py         # prompt text + builders (user-facing zh strings)
│   ├── llm/               # LLM provider abstraction
│   │   ├── base.py        #   LLMProvider Protocol
│   │   ├── openai_compatible.py  # concrete impl (DeepSeek/Qwen/GLM)
│   │   └── factory.py     #   get_llm_provider() -> configured instance
│   └── rag/               # retrieval-augmented generation
│       ├── embeddings.py  #   EmbeddingProvider Protocol + impl
│       ├── store.py       #   VectorStore (NumPy cosine, persisted)
│       ├── chunking.py    #   markdown -> chunks
│       ├── retriever.py   #   query -> relevant chunks
│       ├── ingest.py      #   build index (CLI: python -m app.rag.ingest)
│       └── factory.py     #   get_embeddings() / get_retriever()
├── tests/                 # pytest; mirrors app/; conftest.py holds fixtures
├── data/
│   ├── knowledge/         # seed knowledge *.md (COMMITTED)
│   └── index/             # built vector index (GITIGNORED artifact)
├── pyproject.toml         # ruff + pytest config
└── requirements*.txt
```

## Module Organization

- A new external integration gets its **own package** under `app/` with three parts:
  `base.py` (a `Protocol`), one concrete implementation, and `factory.py` returning the
  configured instance. See `app/llm/` and `app/rag/` as the canonical examples.
- Route handlers in `main.py` stay thin: parse request → call provider/retriever → return schema.

## Naming Conventions

- Modules: `snake_case.py`. Packages: `snake_case/` with `__init__.py`.
- Factories: `get_<thing>()`, cached with `@lru_cache`.

## Anti-patterns

- ❌ Business logic inside `main.py` route bodies (keep them thin).
- ❌ Instantiating providers inline in a handler — use the factory via `Depends(...)`.
- ❌ Committing `data/index/` (it is a rebuildable artifact).
