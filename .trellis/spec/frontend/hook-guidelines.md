# Hook Guidelines

> Custom hook patterns.

---

## Custom Hook Patterns

- Use built-in hooks (`useState`, `useEffect`, `useRef`) for local UI state. Chat
  streaming state comes from the library hook `useChat` (`@ai-sdk/react`) inside
  `ChatWindow` — see [state-management](./state-management.md).
- **Extract a custom hook only when logic is reused** across ≥2 components or becomes
  complex.
- Side effects belong in `useEffect` with cleanup (see the `cancelled` flag pattern in
  `ChatWindow` / `ProviderSettingsForm` mount-fetch effects); data fetching still goes
  through `lib/api-client.ts` functions.

## Data Fetching

- No data-fetching library (React Query/SWR) in the MVP. Calls are made directly through
  `lib/api-client.ts` functions from event handlers (or a mount `useEffect`);
  loading/error state is local `useState`.

## Naming Conventions

- Custom hooks are named `useXxx` and live in a root `hooks/` directory (create it with
  the first hook).

## Current state

No project-defined custom hooks yet (chat uses the library hook `useChat`). When the
first one is added, document its contract here with a real example.

## Common Mistakes

- ❌ A hook not prefixed with `use`.
- ❌ Calling `fetch()` inside a hook directly (route it through `lib/api-client.ts`).
- ❌ Premature extraction of a hook used by only one component.
- ❌ A mount-fetch effect without a cancellation guard (state update after unmount).
