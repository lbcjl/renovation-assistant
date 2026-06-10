# Backend Development Guidelines

> Best practices for backend development in this project (Next.js Route Handlers, TypeScript).

---

## Overview

The backend is the **`app/api/`** layer of a single Next.js (App Router) application,
providing a renovation Q&A chat API backed by an OpenAI-compatible LLM and a RAG
knowledge base, plus image generation, file upload, and runtime provider settings.
Domain logic lives in **`lib/`** (route handler files only export HTTP methods);
external services sit behind small interfaces + factory functions so they are
swappable and testable.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | ✅ Filled |
| [Database Guidelines](./database-guidelines.md) | Persistence (file-based; no SQL in MVP) | ✅ Filled |
| [Error Handling](./error-handling.md) | Boundary catches, 502 mapping, validation | ✅ Filled |
| [Quality Guidelines](./quality-guidelines.md) | lint, typing, provider pattern, tests | ✅ Filled |
| [Logging Guidelines](./logging-guidelines.md) | Log levels, secret-safe logging | ✅ Filled |

---

## Stack at a glance

- Next.js 15 App Router Route Handlers (`app/api/**/route.ts`, Node runtime — never edge)
- TypeScript strict; settings from env vars via `lib/config.ts` (`getSettings()`,
  cached on `globalThis` to survive dev hot-reload)
- Vercel AI SDK (`ai` + `@ai-sdk/openai-compatible`) for chat streaming (UI message
  stream with a custom `data-sources` part); plain `fetch`/`undici` for image
  generation and `/models` probing (proxy via `ProxyAgent`)
- JSON-persisted vector store for RAG (`lib/rag/`), built by `npm run ingest`
- Tooling: `eslint` (lint), `tsc --noEmit` (typecheck), `vitest` (tests in
  `tests/` and colocated `lib/**/*.test.ts`)

---

**Language**: All documentation should be written in **English**.
