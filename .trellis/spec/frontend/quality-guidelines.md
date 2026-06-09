# Quality Guidelines

> Code standards and checks for the frontend.

---

## Required Patterns

- **No `any`, no non-null assertions, no unused vars** (enforced by `tsconfig`).
- **Accessibility**: interactive controls are reachable and keyboard-friendly (e.g. Enter to
  send, Shift+Enter for newline in `ChatWindow`); disable buttons while loading.

## Linting & Build

- **Lint**: ESLint flat config (`eslint.config.js`) with `typescript-eslint` recommended.
  Run `npm run lint` — must be clean (0 errors).
- **Type-check / build**: `npm run build` (`tsc -b && vite build`) must pass with no type
  errors. `npm run typecheck` (`tsc -b`) for type-check only.

```bash
npm run lint
npm run build   # tsc -b && vite build
```

## Testing Requirements

No frontend tests in the MVP yet. When component logic grows, add **Vitest +
@testing-library/react** and document patterns here.

## Forbidden Patterns

- ❌ Disabling an ESLint rule inline without a justifying comment.
- ❌ Committing `node_modules/` or `dist/`.
- ❌ Shipping `console.log` left over from debugging.
