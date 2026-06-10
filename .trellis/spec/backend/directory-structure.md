# Directory Structure

> How backend code is organized in this project. The backend is the `app/api/` +
> `lib/` layer of the single Next.js app at the repository root (the old FastAPI
> `backend/` project was removed in the 2026-06 migration).

---

## Directory Layout

```
renovation-assistant/
├── app/api/                       # Route handlers (HTTP boundary; thin, delegate to lib/)
│   ├── chat/route.ts              #   POST /api/chat — RAG + streaming chat (Vercel AI SDK)
│   ├── image/route.ts             #   POST /api/image — image generation w/ retry matrix
│   ├── files/
│   │   ├── route.ts               #   GET /api/files — list
│   │   ├── upload/route.ts        #   POST /api/files/upload — multipart upload
│   │   └── [id]/
│   │       ├── route.ts           #   DELETE /api/files/{id}
│   │       ├── content/route.ts   #   GET /api/files/{id}/content — serve stored bytes
│   │       └── add-to-kb/route.ts #   POST — extract + chunk + embed + index
│   └── settings/[provider]/
│       ├── route.ts               #   GET/PUT /api/settings/{llm|image}
│       └── models/route.ts        #   POST .../models — probe endpoint's /models
├── lib/                           # Domain logic (importable from routes, scripts, tests)
│   ├── config.ts                  #   Settings from env (getSettings(), globalThis-cached)
│   ├── chat.ts                    #   chat request guards + ChatUIMessage/source helpers
│   ├── prompts.ts                 #   system prompt + context block builders (zh strings)
│   ├── image-service.ts           #   generateImage() with transient-retry contract
│   ├── runtime-config.ts          #   provider_config.json load/save/mask (overrides env)
│   ├── file-service.ts            #   upload validation, metadata, add-to-kb pipeline
│   ├── file-processor.ts          #   pdf/docx/xlsx/csv/txt text extraction
│   └── rag/                       #   retrieval-augmented generation
│       ├── embeddings.ts          #     EmbeddingProvider interface + OpenAI-compatible impl
│       ├── store.ts               #     VectorStore (cosine, JSON-persisted)
│       ├── chunking.ts            #     markdown -> chunks
│       ├── retriever.ts           #     query -> relevant chunks (topK / minScore)
│       └── factory.ts             #     getEmbeddings() / getRetriever() singletons
├── scripts/ingest.ts              # build index (CLI: npm run ingest, runs under tsx)
├── tests/                         # route-level Vitest tests (+ colocated lib/**/*.test.ts)
└── data/
    ├── knowledge/                 # seed knowledge *.md (COMMITTED, ground truth)
    └── index/                     # built vector index (GITIGNORED artifact)
```

## Module Organization

- **Route handler files only export HTTP methods** (`GET`/`POST`/...) plus Next.js
  config like `export const runtime = "nodejs"`. All shared logic lives in `lib/`
  (e.g. `parseChatRequest` is in `lib/chat.ts`, not the route file).
- A new external integration gets an **interface + concrete impl + factory**:
  see `lib/rag/embeddings.ts` (`EmbeddingProvider` + `OpenAICompatibleEmbeddings`)
  and `lib/rag/factory.ts` as the canonical example.
- Factories cache instances on `globalThis` (not module scope) so they survive
  Next.js dev hot reloads; each exposes a `reset*` helper for tests.
- All route handlers declare `export const runtime = "nodejs"` — never edge
  (fs access, proxy dispatchers, and long-running requests need Node).

## Naming Conventions

- Modules: `kebab-case.ts` (e.g. `image-service.ts`, `runtime-config.ts`).
- Factories: `get<Thing>()`; test-only cache resets: `reset<Thing>()`.
- Route params follow App Router conventions: `[id]`, `[provider]`.

## Anti-patterns

- ❌ Business logic inside `route.ts` bodies (keep them thin; delegate to `lib/`).
- ❌ Non-handler exports from a `route.ts` file (Next.js forbids them).
- ❌ Module-level singletons (lost on dev hot-reload — use the `globalThis` pattern).
- ❌ Committing `data/index/` (it is a rebuildable artifact).
