# State Management

> Where state lives and how it flows.

---

## State Categories (MVP)

- **Local component state only** (`useState`). No global store yet.
- **Server state** (the chat history/messages) is owned by the component that renders it
  (`ChatWindow`), not lifted higher than necessary.
- **URL state**: none yet (single page).

## When to Use Global State

- Introduce **Context or a store** only when shared state is genuinely needed (e.g. user
  settings, selected model, auth) — and document the choice here at that time.

## Example (real code — `frontend/src/components/ChatWindow.tsx`)

```tsx
const [messages, setMessages] = useState<ChatMessage[]>([])
const [input, setInput] = useState('')
```

## Common Mistakes

- ❌ Lifting all state into `App` "just in case".
- ❌ Global mutable singletons for state.
- ❌ Reaching for a state library before there is shared cross-component state.
