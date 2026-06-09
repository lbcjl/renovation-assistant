# Directory Structure

> How frontend code is organized in this project. Documents the actual layout under `frontend/`.

---

## Directory Layout

```
frontend/
├── index.html
├── src/
│   ├── main.tsx            # entry point (createRoot)
│   ├── App.tsx             # root component / page layout
│   ├── index.css           # global styles (BEM-style class names)
│   ├── types.ts            # shared domain types (e.g. ChatMessage, ChatRole)
│   ├── api/                # one module per backend endpoint, typed
│   │   └── chat.ts         #   postChat(messages) -> reply
│   ├── components/         # React components
│   │   └── ChatWindow.tsx
│   └── vite-env.d.ts       # import.meta.env typing
├── package.json            # scripts: dev / build / lint / typecheck
├── tsconfig*.json          # project references (app + node)
├── vite.config.ts
└── eslint.config.js        # flat config, typescript-eslint
```

## Module Organization

- **Network calls live in `src/api/`**, never inside components. One exported function per
  endpoint, with typed input/output (see `api/chat.ts`).
- **Shared types live in `src/types.ts`**. Components import them with `import type`.
- Components are presentational + own their local state; extract a `src/hooks/` module only
  when logic is reused across components.

## Naming Conventions

- Components: `PascalCase.tsx` (e.g. `ChatWindow.tsx`). Functions/vars: `camelCase`.
- CSS classes: BEM-style — `block__element--modifier` (e.g. `chat__message--user`).

## Anti-patterns

- ❌ `fetch()` directly inside a component (put it in `src/api/`).
- ❌ Inline styles for layout (use classes in `index.css`).
- ❌ Committing `node_modules/` or `dist/`.
