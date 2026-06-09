# Quality Guidelines

> Code standards and testing requirements for the backend.

---

## Required Patterns

- **Python 3.11+** with full type hints on public functions. Use `list[X]`, `X | None`.
- **Config** via `pydantic-settings` (`app/config.py`), read from env / `.env`. Never hardcode
  secrets or URLs.
- **Provider pattern**: external services sit behind a `Protocol` + a `factory` cached with
  `@lru_cache`, so they are swappable and testable (`app/llm/`, `app/rag/`).
- **Async**: route handlers and provider calls are `async`; use `AsyncOpenAI` (no blocking I/O
  in async handlers).

## Linting

- `ruff` (config in `pyproject.toml`: rules `E,F,I,UP,B`, line length 100).
  Run `ruff check .` — must be clean.

## Testing Requirements

- Every endpoint and every RAG component has tests (`backend/tests/`).
- **No network or API key in tests** — override providers with fakes via
  `app.dependency_overrides` (see `tests/conftest.py` `FakeProvider`).
- Cover edge cases: empty retrieval, empty `messages` (→ 422), score-threshold fallback.

```python
# tests/conftest.py
app.dependency_overrides[get_llm_provider] = lambda: fake_provider
```

## Forbidden Patterns

- ❌ Hardcoded secrets / base URLs (use `Settings`).
- ❌ Synchronous blocking calls inside `async` handlers.
- ❌ `except Exception` anywhere except the API boundary.
- ❌ Committing `.env` or `data/index/`.
