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
4. **Retry transient upstream failures before giving up; exhausted retries are `503`.**
   For providers known to be flaky, retry dropped connections / 5xx / rate limits with an
   increasing delay at the service layer, raise a dedicated exception when all attempts
   fail, and map it to `503 Service Unavailable` so clients can distinguish "try again
   later" from a hard failure.
5. **Preserve the cause** with `raise ... from exc`.
6. **CLI scripts** raise `SystemExit("clear message")` for unrecoverable setup problems.

## Example (real code — `app/main.py`)

```python
try:
    reply = await provider.chat(messages)
except Exception as exc:  # noqa: BLE001 - surface any upstream failure as 502
    logger.exception("LLM provider call failed")
    raise HTTPException(status_code=502, detail="LLM provider error") from exc
```

## Example (real code — transient retry, `app/services/image_service.py` + `app/routers/image.py`)

Service layer retries transient errors and raises a dedicated exception when exhausted:

```python
_TRANSIENT_ERRORS = (APIConnectionError, InternalServerError, RateLimitError)

class ImageGenerationUnavailableError(Exception):
    """The upstream image provider kept failing transiently after all retries."""

# generate_image(): up to max_attempts (3) calls, sleeping retry_delay_seconds * (attempt - 1)
# between attempts; non-transient errors propagate immediately without retry.
```

The router maps the dedicated exception to `503` and everything else to `502`:

```python
try:
    image_url = await service.generate_image(request.prompt)
except ImageGenerationUnavailableError as exc:
    raise HTTPException(status_code=503, detail="Image service temporarily unavailable") from exc
except Exception as exc:
    logger.exception("Image generation failed")
    raise HTTPException(status_code=502, detail="Image generation failed") from exc
```

Error matrix for `POST /image/generate`:

| Condition | Status | detail |
|-----------|--------|--------|
| Invalid prompt (empty / >1000 chars) | 422 | Pydantic validation errors |
| `IMAGE_API_KEY` not configured | 503 | `Image generation not configured` |
| Transient upstream failure, retries exhausted | 503 | `Image service temporarily unavailable` |
| Any other generation failure | 502 | `Image generation failed` |

Tests asserting this contract: `tests/test_image.py` (retry-then-succeed, retries-exhausted,
non-transient-no-retry, 503 endpoint mapping). When disabling SDK-level retries
(`AsyncOpenAI(max_retries=0)`), keep all retry control in the service so total upstream
calls stay bounded.

## Example (real code — `app/routers/models.py`)

Error matrix for `GET /models` (lists chat models from the configured OpenAI-compatible
endpoint; the picked model is sent back per request via `ChatRequest.model`):

| Condition | Status | detail |
|-----------|--------|--------|
| `LLM_API_KEY` not configured | 503 | `LLM not configured` |
| Upstream `/models` fetch failure | 502 | `Failed to list models` |

Tests asserting this contract: `tests/test_models.py` (also covers `ChatRequest.model`
pass-through to the provider for `/chat` and `/chat/stream`).

## Example (real code — `app/rag/ingest.py`)

```python
if not settings.embedding_api_key:
    raise SystemExit("EMBEDDING_API_KEY is not set; cannot build the index.")
```

## Common Mistakes

- ❌ Bare `except:` or silently swallowing exceptions.
- ❌ Returning `200` with an error payload instead of a proper status code.
- ❌ Echoing provider exception text (may contain request details) to the client.
