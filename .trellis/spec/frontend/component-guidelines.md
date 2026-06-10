# Component Guidelines

> Patterns for React components in this project.

---

## Component Structure

- **Function components only**, with typed props (`interface XxxProps`). No class components.
- Components that use hooks/state/event handlers declare `"use client"` at the top
  (this app's components are all client components; the server side is `app/api/`).
- **No data fetching in components** — call a typed function from `lib/api-client.ts`
  (e.g. `ImageGenerator` calls `generateImage`). Components orchestrate; `lib/api-client.ts`
  talks to the network. (Exception: chat streaming goes through `useChat` /
  `DefaultChatTransport` pointed at `/api/chat`.)
- **Handle every UI state explicitly**: empty, loading, error, and success. `ChatWindow`
  renders an empty-state placeholder with suggestion chips, a typing indicator while the
  stream starts, and an error line; inputs/buttons are disabled while loading.

## Props Conventions

- Type event handlers; import React event types as types:
  `import { useState, type KeyboardEvent } from "react"`.
- For fire-and-forget async in a handler, mark it: `onClick={() => void handleGenerate()}`.

## Example (real code — `components/ImageGenerator.tsx`)

```tsx
setLoading(true);
setError("");
try {
  const url = await generateImage(prompt);
  setImageUrl(url);
} catch (err) {
  const errorMessage = err instanceof Error ? err.message : "生成失败，请重试";
  setError(errorMessage);
} finally {
  setLoading(false);
}
```

## Styling Patterns

- Plain CSS with BEM-style class names in `app/globals.css` (e.g. `chat__row--user`,
  `image-generator__button`).
- `next/image` is skipped for provider-hosted / API-served image URLs — use `<img>`
  with an inline `eslint-disable-next-line @next/next/no-img-element` plus a reason.

## Common Mistakes

- ❌ `any`-typed props.
- ❌ `fetch()` / business logic embedded in JSX.
- ❌ Floating promises (always `await` or `void`).
- ❌ Forgetting `"use client"` on a component that uses hooks.
