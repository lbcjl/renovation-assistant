# Migrate to Next.js (single full-stack app)

## Goal

Replace the current two-project setup (FastAPI backend at `backend/` + Vite React
frontend at `frontend/`) with a single Next.js (App Router, TypeScript) application,
so the whole product runs with one `npm run dev`. Old projects are deleted after the
new app reaches feature parity (git history keeps them recoverable).

## Decisions (confirmed with user 2026-06-10)

- **Big-bang migration**: one shot, no transition period with two stacks.
- **Direct replacement**: build the Next.js app and delete `frontend/` + `backend/`.
  New app lives at the repository root (single `package.json`).
- **Login is cancelled entirely**: do NOT port JWT auth, user DB, SQLAlchemy/Alembic,
  or the login UI. No Auth.js. (Auth was already disabled for local testing.)
- **Vercel AI SDK** (`ai` + `@ai-sdk/openai-compatible` + `@ai-sdk/react`) for chat
  streaming. Frontend SSE parsing is replaced by `useChat`; RAG sources are delivered
  as stream data parts. Image generation may use the plain `openai` npm SDK or fetch
  if the AI SDK's image API doesn't fit the relay — behavior parity wins.

## Features to migrate (parity checklist)

1. **Chat with RAG** (`POST /chat/stream` → `app/api/chat/route.ts`)
   - Server-side system prompt built from retrieved knowledge chunks (port `prompts.py`)
   - Streaming reply + cited sources (deduped, scored) shown under the answer
   - Request guards: max 40 messages, max 4000 chars each
2. **RAG pipeline** (`backend/app/rag/` → `lib/rag/`)
   - Vector store: cosine similarity, persisted to disk. `.npy` is NumPy-only —
     store embeddings as JSON/binary JS format instead and REBUILD the index via the
     new ingest script (knowledge markdown sources are the ground truth)
   - Embeddings client: OpenAI-compatible `/embeddings` (DashScope text-embedding-v4)
   - Chunking + ingest script (`npm run ingest`), retrieval with top_k / min_score
3. **Image generation** (`POST /image/generate` → `app/api/image/route.ts`)
   - Retry transient failures (connection/5xx/429) with increasing delay, 3 attempts
   - Exhausted retries → 503; other failures → 502; prompt 1–1000 chars → 422-style 400
   - Proxy support (current `IMAGE_PROXY_URL`) via undici ProxyAgent / custom fetch
4. **File upload & knowledge extraction** (`/api/files/*`)
   - Upload (pdf/docx/xlsx/images), list, delete, add-to-knowledge-base
   - Parsers: pypdf→`unpdf` or `pdf-parse`, python-docx→`mammoth`, openpyxl→`xlsx`
   - Serve uploaded files
5. **Runtime provider settings** (`/settings/{llm|image}` → `app/api/settings/...`)
   - GET (key masked, e.g. `sk-fPX...vZ8A`), PUT (empty key keeps saved), POST models
     (probe endpoint's `/models` before saving)
   - Persisted JSON overrides `.env` defaults; applies without restart
   - Error matrix preserved: unknown provider 4xx, no key 503/400, upstream fail 502
6. **UI: three tabs** (装修问答 / AI 效果图 / 设置) — port existing components and
   CSS (BEM, `index.css` design tokens) with minimal visual change; tabs keep both
   pages mounted (chat history / generated image survive switching). Remove login UI
   and the 测试模式 badge can stay or be dropped.

## Explicitly dropped

- JWT auth, `/auth/*` endpoints, login page, user DB, SQLAlchemy/Alembic/bcrypt/jose
- Python toolchain (ruff, pytest), FastAPI, uvicorn

## Data migration

- `backend/data/knowledge/**` (markdown, tracked) → `data/knowledge/` at root; fix
  `.gitignore` (`/data/` currently ignores the root data dir — scope it to keep
  knowledge tracked while ignoring index/uploads/provider_config.json)
- `backend/data/provider_config.json`, uploads + metadata → copy to new location
- `backend/.env` values → `.env.local` (Next.js convention; already gitignored)
- Vector index: regenerate with `npm run ingest` (do not attempt to read `.npy`)

## Tech notes

- Next.js 15 App Router, TypeScript strict, ESLint; plain CSS carried over
- Route handlers run on Node runtime (NOT edge) — needed for fs, proxy, long requests
- Dev-mode singleton caching via `globalThis` pattern (provider/store instances)
- Long requests (image gen 1–2 min) fine for local self-host; document Vercel limits
- Tests: Vitest — port the behavioral contracts (image retry matrix, settings error
  matrix + masking + section isolation, vector store ranking, chunking, chat guards)

## Acceptance criteria

- [ ] `npm install && npm run dev` at repo root serves the full app on one port
- [ ] Chat streams answers with sources, grounded in the rebuilt knowledge index
- [ ] Image generation works incl. retry/503 path and proxy
- [ ] Settings page edits both providers, fetch-models probe works, key stays masked
- [ ] File upload → parse → add to knowledge base → retrievable in chat
- [ ] `frontend/` and `backend/` deleted; README + `.trellis/spec/*` updated to new stack
- [ ] `npm run lint`, `tsc --noEmit`, `vitest run` all pass
