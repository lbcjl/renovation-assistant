# Quality Guidelines

> Code standards and checks for the frontend.

---

## Required Patterns

- **No `any`, no non-null assertions, no unused vars** (enforced by strict `tsconfig.json`
  + the `next/typescript` ESLint preset).
- **Accessibility**: interactive controls are reachable and keyboard-friendly (e.g. Enter to
  send, Shift+Enter for newline in `ChatWindow`); icon-only buttons carry `aria-label`;
  disable buttons/inputs while loading.

## Linting & Build

- **Lint**: ESLint flat config (`eslint.config.mjs`, `next/core-web-vitals` +
  `next/typescript`). Run `npm run lint` — must be clean (0 errors).
- **Type-check**: `npm run typecheck` (`tsc --noEmit`) must pass with no errors.
- **Build**: `npm run build` (`next build`) must succeed.

```bash
npm run lint
npm run typecheck
npm run build
```

## Testing Requirements

- Vitest (`npm run test`) covers shared logic and route contracts (`tests/`,
  `lib/**/*.test.ts`). There are no component (DOM) tests yet; when component logic
  grows, add **@testing-library/react** and document patterns here.

## Forbidden Patterns

- ❌ Disabling an ESLint rule inline without a justifying comment.
- ❌ Committing `node_modules/` or `.next/`.
- ❌ Shipping `console.log` left over from debugging.
