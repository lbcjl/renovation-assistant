# Type Safety

> TypeScript conventions for the frontend.

---

## Type Organization

- **Strict mode on** (`tsconfig.json`: `"strict": true`); unused locals/params are
  rejected by the `next/typescript` ESLint preset.
- **Shared domain types live next to their domain logic in `lib/`** and are imported
  with the `@/` alias: chat types in `lib/chat.ts` (`ChatUIMessage`, `ChatSource`),
  file metadata in `lib/file-service.ts` (`FileMetadata`, re-exported by
  `lib/api-client.ts`). Use union types for closed sets
  (e.g. `type ProviderSection = "llm" | "image"`).
- **Type-only imports**: `import type { FileMetadata } from "@/lib/api-client"`.
  This also keeps server modules out of client bundles when only types are needed.
- **Env vars** are read server-side only, through `lib/config.ts` (`getSettings()`)
  with typed fields and defaults — components never touch `process.env`.

## Validation

- No runtime validation library (Zod/Yup) in the MVP. API responses are typed and
  narrowed at the boundary; a single `as <Type>` is acceptable only for a known JSON
  response shape, and every other cast needs a justifying comment (see
  `messageSources` in `lib/chat.ts`).

## Example (real code — `lib/api-client.ts`)

```ts
export interface ImageGenerationResponse {
  image_url: string;
}

const data = (await response.json()) as ImageGenerationResponse;
return data.image_url;
```

## Forbidden Patterns

- ❌ `any` (use a precise type or `unknown` + narrowing).
- ❌ Non-null assertion `value!` (check for null instead).
- ❌ Untyped `fetch().then(r => r.json())` results.
- ❌ Unexplained `as` casts (a comment must say why the cast is safe).
