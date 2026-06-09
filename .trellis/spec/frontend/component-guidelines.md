# Component Guidelines

> Patterns for React components in this project.

---

## Component Structure

- **Function components only**, with typed props (`interface XxxProps`). No class components.
- **No data fetching in components** — call a typed function from `src/api/` (e.g.
  `ChatWindow` calls `postChat`). Components orchestrate; `api/` talks to the network.
- **Handle every UI state explicitly**: empty, loading, error, and success. `ChatWindow`
  renders an empty-state placeholder, a "思考中…" loading bubble, and an error line.

## Props Conventions

- Type event handlers; import React event types as types:
  `import { useState, type KeyboardEvent } from 'react'`.
- For fire-and-forget async in a handler, mark it: `onClick={() => void handleSend()}`.

## Example (real code — `frontend/src/components/ChatWindow.tsx`)

```tsx
try {
  const reply = await postChat(nextMessages)
  setMessages([...nextMessages, { role: 'assistant', content: reply }])
} catch (err) {
  setError(err instanceof Error ? err.message : '出错了，请稍后重试')
} finally {
  setLoading(false)
}
```

## Styling Patterns

- Plain CSS with BEM-style class names in `src/index.css` (e.g. `chat__message--user`).

## Common Mistakes

- ❌ `any`-typed props.
- ❌ `fetch()` / business logic embedded in JSX.
- ❌ Floating promises (always `await` or `void`).
