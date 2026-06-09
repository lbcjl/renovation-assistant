# Hook Guidelines

> Custom hook patterns.

---

## Custom Hook Patterns

- Use built-in hooks (`useState`, etc.) for local UI state. The MVP keeps chat state in the
  owning component (`ChatWindow`) — see [state-management](./state-management.md).
- **Extract a custom hook only when logic is reused** across ≥2 components or becomes complex
  (e.g. a future `useChat()` wrapping message state + `postChat`).
- Side effects belong in `useEffect`; data fetching still goes through `src/api/` functions.

## Data Fetching

- No data-fetching library (React Query/SWR) in the MVP. Calls are made directly through
  `src/api/` functions from event handlers; loading/error state is local `useState`.

## Naming Conventions

- Custom hooks are named `useXxx` and live in `src/hooks/`.

## Current state

No custom hooks yet (MVP). When the first one is added (likely `useChat`), document its
contract here with a real example.

## Common Mistakes

- ❌ A hook not prefixed with `use`.
- ❌ Calling `fetch()` inside a hook directly (route it through `src/api/`).
- ❌ Premature extraction of a hook used by only one component.
