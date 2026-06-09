# Error Handling

> How errors are caught, converted, and returned at the backend.

---

## Rules

1. **Validation errors are automatic.** Request bodies are Pydantic models
   (`app/schemas.py`); invalid input returns `422` without manual handling.
2. **Catch broad exceptions only at the API boundary.** A route handler may wrap an
   upstream/provider call in `try/except Exception`, log it, and re-raise as an
   `HTTPException`. Do not catch broadly deeper in the stack.
3. **Map upstream failures to `502`.** LLM/embedding provider failures are not our bug;
   surface them as `502 Bad Gateway`, never leak the provider stack trace to the client.
4. **Preserve the cause** with `raise ... from exc`.
5. **CLI scripts** raise `SystemExit("clear message")` for unrecoverable setup problems.

## Example (real code — `app/main.py`)

```python
try:
    reply = await provider.chat(messages)
except Exception as exc:  # noqa: BLE001 - surface any upstream failure as 502
    logger.exception("LLM provider call failed")
    raise HTTPException(status_code=502, detail="LLM provider error") from exc
```

## Example (real code — `app/rag/ingest.py`)

```python
if not settings.embedding_api_key:
    raise SystemExit("EMBEDDING_API_KEY is not set; cannot build the index.")
```

## Common Mistakes

- ❌ Bare `except:` or silently swallowing exceptions.
- ❌ Returning `200` with an error payload instead of a proper status code.
- ❌ Echoing provider exception text (may contain request details) to the client.
