# Renovation Assistant — Backend

FastAPI service powering the renovation Q&A assistant.

## Stack
- Python 3.11+, FastAPI, Pydantic v2
- LLM via an **OpenAI-compatible** Chat API (default: DeepSeek; swap to Qwen / GLM by changing `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY`)

## Setup
```bash
python -m venv .venv
source .venv/bin/activate        # Windows (Git Bash): source .venv/Scripts/activate
pip install -r requirements-dev.txt
cp .env.example .env             # then fill in LLM_API_KEY
```

## Run
```bash
uvicorn app.main:app --reload
# Health:  GET  http://localhost:8000/health
# Chat:    POST http://localhost:8000/chat   {"messages":[{"role":"user","content":"..."}]}
```

## Test & lint
```bash
pytest
ruff check .
```

## Layout
```
app/main.py            FastAPI app + routes (health, chat)
app/config.py          settings loaded from env / .env
app/schemas.py         request/response models
app/prompts.py         system prompt (Chinese, user-facing)
app/llm/base.py        LLMProvider protocol
app/llm/openai_compatible.py   provider for OpenAI-compatible APIs
app/llm/factory.py     build the configured provider
tests/                 pytest (provider is faked, no network needed)
```

> RAG (knowledge base + retrieval) arrives in PR2; streaming + multi-turn polish in PR3.
