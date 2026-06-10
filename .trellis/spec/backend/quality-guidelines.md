# Quality Guidelines

> Code standards and testing requirements for the backend (Next.js route handlers + `lib/`).

---

## Required Patterns

- **TypeScript strict mode** (`tsconfig.json`: `"strict": true`). Public functions carry
  explicit return types; route handlers return `Promise<Response>`.
- **Config** via `lib/config.ts` (`getSettings()`), read from env / `.env.local`. Never
  hardcode secrets or URLs; every path/provider value has an env override so tests can
  redirect disk access to temp directories.
- **Provider pattern**: external services sit behind an interface + a factory cached on
  `globalThis` (`lib/rag/embeddings.ts` + `lib/rag/factory.ts`), so they are swappable
  and testable. Transports are injectable where retry behavior is tested
  (`lib/image-service.ts` `fetchImpl`).
- **Validation at the boundary**: request bodies are parsed by small `parse*` helpers
  returning a discriminated result (`{ ok: true, value } | { ok: false, detail }`),
  never thrown past the handler.

## Linting & Type-check

- `npm run lint` — ESLint flat config (`eslint.config.mjs`, `eslint-config-next` +
  `next/typescript`). Must be clean.
- `npm run typecheck` — `tsc --noEmit`. Must be clean.

## Testing Requirements

- Every endpoint contract and every RAG component has Vitest tests
  (`tests/*.test.ts` for routes, colocated `lib/**/*.test.ts` for services).
- **No network or API key in tests** — stub the global `fetch` with `vi.stubGlobal`,
  or inject a fake transport (`fetchImpl`); redirect persistence with env overrides
  (`PROVIDER_CONFIG_PATH`, `INDEX_DIR`, ...) pointing at `fs.mkdtempSync` dirs, then
  call `resetSettingsCache()` / `resetRagSingletons()`.
- Cover the documented error matrices: chat guards (40 messages / 4000 chars),
  image retry (transient retry, exhausted → unavailable, non-transient no-retry),
  settings (masking, empty-key-keeps-saved, section isolation, 404/503/502).

```ts
// tests/settings-routes.test.ts
process.env["PROVIDER_CONFIG_PATH"] = path.join(tempDir, "provider_config.json");
resetSettingsCache();
vi.stubGlobal("fetch", fetchMock);
```

## Forbidden Patterns

- ❌ Hardcoded secrets / base URLs (use `getSettings()`).
- ❌ `any` (use `unknown` + narrowing) and unjustified `as` casts.
- ❌ `catch` swallowing errors silently outside the API boundary.
- ❌ Committing `.env.local`, `data/index/`, or `data/provider_config.json`.
