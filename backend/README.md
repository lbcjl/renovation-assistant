# Renovation Assistant — Backend

FastAPI service powering the renovation Q&A assistant (LLM + RAG).

## Stack
- Python 3.11+, FastAPI, Pydantic v2
- **LLM** via an OpenAI-compatible Chat API (default DeepSeek; swap to Qwen / GLM)
- **RAG**: OpenAI-compatible embeddings (default SiliconFlow `BAAI/bge-m3`; e.g. Alibaba
  DashScope `text-embedding-v4`) + a local NumPy vector store

## Setup
```bash
python -m venv .venv
source .venv/bin/activate        # Windows (Git Bash): source .venv/Scripts/activate
pip install -r requirements-dev.txt
cp .env.example .env             # fill LLM_API_KEY and EMBEDDING_API_KEY/BASE_URL/MODEL
```

## Build the knowledge index (RAG)
```bash
python -m app.rag.ingest         # embeds data/knowledge/*.md -> data/index/ (needs EMBEDDING_API_KEY)
```
Without an index the assistant still answers, but falls back to plain LLM output (no citations).

## Run
```bash
uvicorn app.main:app --reload
```

## Endpoints
- `GET  /health` → `{"status":"ok"}`
- `POST /chat` → `{"reply": str, "sources": [{source, score}]}` (non-streaming)
- `POST /chat/stream` → **Server-Sent Events** (streaming):
  - `event: sources` · `data: {"sources":[{source,score}]}` — once, first
  - `data: {"delta":"..."}` — many (token chunks)
  - `event: done` · `data: {}` — last
  - `event: error` · `data: {"detail":"..."}` — on mid-stream failure

Request body for both: `{"messages":[{"role":"user","content":"..."}]}` (≤40 messages, ≤4000 chars each).

## Test & lint
```bash
pytest
ruff check .
```

## Layout
```
app/main.py            FastAPI app + routes (health, chat, chat/stream)
app/config.py          settings loaded from env / .env
app/schemas.py         request/response models + input limits
app/prompts.py         system prompt + context builder (zh)
app/llm/               LLM provider (Protocol + OpenAI-compatible impl + factory)
app/rag/               embeddings, vector store, chunking, retriever, ingest, factory
data/knowledge/*.md    seed knowledge (committed)
data/index/            built vector index (gitignored)
tests/                 pytest (providers/retriever faked; no network)
```
