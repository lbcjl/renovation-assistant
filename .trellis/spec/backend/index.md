# Backend Development Guidelines

> Best practices for backend development in this project (FastAPI, Python 3.11+).

---

## Overview

The backend is a **FastAPI** service providing a renovation Q&A chat API backed by an
OpenAI-compatible LLM and a RAG knowledge base. External services sit behind `Protocol` +
`factory` so they are swappable and testable.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | ✅ Filled |
| [Database Guidelines](./database-guidelines.md) | Persistence (file-based; no SQL in MVP) | ✅ Filled |
| [Error Handling](./error-handling.md) | Boundary catches, 502 mapping, validation | ✅ Filled |
| [Quality Guidelines](./quality-guidelines.md) | ruff, typing, provider pattern, tests | ✅ Filled |
| [Logging Guidelines](./logging-guidelines.md) | Log levels, secret-safe logging | ✅ Filled |

---

## Stack at a glance

- Python 3.11+, FastAPI, Pydantic v2, `pydantic-settings`
- `openai` SDK pointed at OpenAI-compatible endpoints (DeepSeek default; Qwen/GLM swappable)
- NumPy-backed vector store for RAG (`app/rag/`)
- Tooling: `ruff` (lint), `pytest` (tests)

---

**Language**: All documentation should be written in **English**.
