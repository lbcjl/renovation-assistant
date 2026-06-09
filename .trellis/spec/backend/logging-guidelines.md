# Logging Guidelines

> Structured, secret-safe logging for the backend.

---

## Log Levels

- Use the stdlib `logging` module. Module logger: `logging.getLogger("renovation_assistant")`.
- `warning` — recoverable misconfiguration (e.g. missing API key at startup).
- `exception` — a caught error at the API boundary (logs the traceback).
- `info` — notable lifecycle events (index loaded, N chunks indexed).
- `print()` is only acceptable in **CLI entrypoints** (e.g. `app/rag/ingest.py`), never in
  request handlers.

## Example (real code — `app/main.py`)

```python
logger = logging.getLogger("renovation_assistant")

if not _settings.llm_api_key:
    logger.warning("LLM_API_KEY is not set; /chat will fail until it is configured.")
...
logger.exception("LLM provider call failed")
```

## What NOT to Log

- ❌ API keys or any `.env` values.
- ❌ Full LLM prompts/responses at `info` in production (may contain user data).
- ❌ Full request bodies that may contain user PII.
