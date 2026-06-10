# State Management

> Where state lives and how it flows.

---

## State Categories (MVP)

- **Local component state only** (`useState`). No global store.
- **Chat state** (messages, streaming status) is owned by `useChat` from
  `@ai-sdk/react` inside the component that renders it (`ChatWindow`), not lifted
  higher than necessary. Generated images / settings forms keep their own
  `useState` in `ImageGenerator` / `ProviderSettingsForm`.
- **Tab switching keeps pages mounted**: `app/page.tsx` renders all three pages and
  hides inactive ones with the `app__page--hidden` class, so chat history and
  generated images survive switching tabs without any global state.
- **URL state**: none yet (single page).

## When to Use Global State

- Introduce **Context or a store** only when shared state is genuinely needed (e.g. user
  settings shared across tabs) — and document the choice here at that time.

## Example (real code — `components/ChatWindow.tsx`)

```tsx
const [input, setInput] = useState("");
const { messages, sendMessage, status } = useChat<ChatUIMessage>({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
  onError: (chatError) => setError(friendlyChatError(chatError)),
});
const loading = status === "submitted" || status === "streaming";
```

## Common Mistakes

- ❌ Lifting all state into the root page "just in case".
- ❌ Global mutable singletons for state.
- ❌ Reaching for a state library before there is shared cross-component state.
- ❌ Unmounting tab pages on switch (loses chat history / generated image).
