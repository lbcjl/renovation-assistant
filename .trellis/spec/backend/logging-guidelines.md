# Logging Guidelines

> Structured, secret-safe logging for the backend (Next.js route handlers + `lib/`).

---

## Log Levels

The backend logs through the Node `console` (no logging library in the MVP):

- `console.warn` — recoverable problems: transient retry attempts, ignoring an
  unreadable config/index file, blocked path traversal, provider unavailable
  after retries.
- `console.error` — a caught error at the API boundary, logged **before** the
  sanitized error response is returned (preserve the original error object).
- `console.log` — only acceptable in **CLI entrypoints** (e.g. `scripts/ingest.ts`
  reporting "Indexed N chunks"), never in request handlers.

## Example (real code — `app/api/image/route.ts`)

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

Pass the error object as a separate argument (`console.error("msg:", error)`) so the
stack is printed; the client only ever sees the constant `detail` string.

## What NOT to Log

- ❌ API keys or any `.env` / `provider_config.json` values (log the masked preview
  from `maskApiKey` if needed).
- ❌ Full LLM prompts/responses (may contain user data).
- ❌ Full request bodies that may contain user PII.
