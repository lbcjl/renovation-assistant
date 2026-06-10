# Error Handling

> How errors are caught, converted, and returned at the backend (Next.js route handlers).

---

## Rules

1. **Validate requests at the top of the route handler.** Request bodies are parsed
   and validated by small `parse*` helpers (e.g. `parseChatRequest` in `lib/chat.ts`);
   invalid input returns `400` with `{"detail": "..."}` (the FastAPI-era response
   shape is kept so clients stay unchanged).
2. **Catch broad exceptions only at the API boundary.** A route handler may wrap an
   upstream/provider call in `try/catch`, log it, and return an error `Response`.
   Do not catch broadly deeper in the stack.
3. **Map upstream failures to `502`.** LLM/embedding provider failures are not our bug;
   surface them as `502 Bad Gateway`, never leak the provider error text to the client.
4. **Retry transient upstream failures before giving up; exhausted retries are `503`.**
   For providers known to be flaky, retry dropped connections / 5xx / rate limits with an
   increasing delay at the service layer, throw a dedicated error class when all attempts
   fail, and map it to `503 Service Unavailable` so clients can distinguish "try again
   later" from a hard failure.
5. **Preserve the cause** when wrapping (`new Error(msg, { cause })` or log the original
   before mapping).
6. **CLI scripts** (e.g. `scripts/ingest.ts`) throw an `Error` with a clear message for
   unrecoverable setup problems and exit non-zero.

## Example (real code — `app/api/chat/route.ts`)

Mid-stream provider failures are masked before reaching the client (parity with the
old SSE error event `{"detail": "LLM provider error"}`):

```ts
function streamErrorMessage(error: unknown): string {
  // Never leak provider details to the client.
  console.error("LLM streaming failed:", error);
  return "LLM provider error";
}

const stream = createUIMessageStream<ChatUIMessage>({
  execute: ({ writer }) => { /* ... */ },
  onError: streamErrorMessage,
});
```

## Example (real code — transient retry, `lib/image-service.ts` + `app/api/image/route.ts`)

The service layer retries transient errors (connection failures, 5xx, 429) and throws a
dedicated error class when exhausted:

```ts
export class ImageGenerationUnavailableError extends Error {}

// generateImage(): up to maxAttempts (3) calls, sleeping
// retryDelaySeconds * (attempt - 1) before each retry;
// non-transient errors propagate immediately without retry.
```

The route maps the dedicated error to `503` and everything else to `502`:

```ts
} catch (error) {
  if (error instanceof ImageGenerationUnavailableError) {
    console.warn("Image provider unavailable after retries");
    return Response.json({ detail: "Image service temporarily unavailable" }, { status: 503 });
  }
  console.error("Image generation failed:", error);
  return Response.json({ detail: "Image generation failed" }, { status: 502 });
}
```

Error matrix for `POST /api/image`:

| Condition | Status | detail |
|-----------|--------|--------|
| Invalid prompt (empty / >1000 chars) | 400 | validation message |
| `IMAGE_API_KEY` not configured | 503 | `Image generation not configured` |
| Transient upstream failure, retries exhausted | 503 | `Image service temporarily unavailable` |
| Any other generation failure | 502 | `Image generation failed` |

Tests asserting this contract: `lib/image-service.test.ts` (retry-then-succeed,
retries-exhausted, non-transient-no-retry). Retries are controlled entirely in the
service (single `fetch` per attempt) so total upstream calls stay bounded.

## Example (real code — `app/api/settings/[provider]/route.ts`)

Runtime provider settings (chat LLM and image generation) are edited from the
frontend settings page and persisted by `lib/runtime-config.ts` to
`data/provider_config.json` (git-ignored; overrides `.env` defaults).

Error matrix for `/api/settings/{provider}` (`provider` ∈ `llm` | `image`):

| Endpoint | Condition | Status | detail |
|----------|-----------|--------|--------|
| any | Unknown provider segment | 404 | `Unknown provider` |
| PUT | `base_url` not http(s), missing fields | 400 | validation message |
| PUT | No API key provided and none saved | 400 | `API key is required` |
| POST `/models` | No API key provided and none saved | 503 | `{provider} provider not configured` |
| POST `/models` | Upstream `/models` fetch failure | 502 | `Failed to list models` |

Tests asserting this contract: `tests/settings-routes.test.ts` (also covers key
masking and section isolation when saving); `tests/chat-route.test.ts` covers the
chat request guards (max 40 messages / 4000 chars, `model` pass-through).

## Example (real code — `scripts/ingest.ts`)

```ts
if (!settings.embeddingApiKey) {
  throw new Error("EMBEDDING_API_KEY is not set; cannot build the index.");
}
// top level: buildIndex().catch((error) => { console.error(...); process.exit(1); });
```

## Common Mistakes

- ❌ Empty `catch {}` that silently swallows exceptions (only acceptable for
  optional parsing, e.g. "missing body means use saved config").
- ❌ Returning `200` with an error payload instead of a proper status code.
- ❌ Echoing provider exception text (may contain request details) to the client.
