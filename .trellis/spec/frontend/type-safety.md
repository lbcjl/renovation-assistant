# Type Safety

> TypeScript conventions for the frontend.

---

## Type Organization

- **Strict mode on** (`tsconfig.app.json`: `strict`, `noUnusedLocals`, `noUnusedParameters`).
- **Shared domain types in `src/types.ts`**; use union types for closed sets
  (e.g. `type ChatRole = 'user' | 'assistant'`).
- **Type-only imports**: `import type { ChatMessage } from '../types'`.
- **Env vars** are typed in `src/vite-env.d.ts`.

## Validation

- No runtime validation library (Zod/Yup) in the MVP. API responses are typed and narrowed at
  the boundary; a single `as <Type>` is acceptable only for a known JSON response shape.

## Example (real code — `frontend/src/api/chat.ts`)

```ts
interface ChatResponse { reply: string }
const data = (await response.json()) as ChatResponse
return data.reply
```

## Forbidden Patterns

- ❌ `any` (use a precise type or `unknown` + narrowing).
- ❌ Non-null assertion `value!` (check for null instead — see `main.tsx` root check).
- ❌ Untyped `fetch().then(r => r.json())` results.
