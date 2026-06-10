# Directory Structure

> How frontend code is organized in this project. Documents the actual layout at the
> repository root (single Next.js app; the old `frontend/` Vite project was removed
> in the 2026-06 migration).

---

## Directory Layout

```
renovation-assistant/
├── app/
│   ├── layout.tsx           # root layout (html lang, metadata, globals.css import)
│   ├── page.tsx             # 'use client' root page: header + tab nav, keeps all
│   │                        #   three pages mounted (.app__page--hidden switching)
│   ├── globals.css          # global styles (BEM-style class names, design tokens)
│   └── api/                 # route handlers (backend) — see backend specs
├── components/              # React components (client)
│   ├── ChatWindow.tsx       #   useChat-based chat + file list/upload sections
│   ├── FileCard.tsx
│   ├── FileUpload.tsx
│   ├── ImageGenerator.tsx
│   ├── SettingsPage.tsx
│   └── ProviderSettingsForm.tsx
├── lib/
│   ├── api-client.ts        # browser-side fetch helpers, one function per endpoint,
│   │                        #   friendly Chinese error messages
│   └── chat.ts              # shared chat types/helpers (ChatUIMessage, messageText,
│                            #   messageSources) used by both the route and the UI
├── eslint.config.mjs        # flat config (eslint-config-next)
└── tsconfig.json            # strict, @/* path alias to repo root
```

## Module Organization

- **Network calls live in `lib/api-client.ts`**, never inline in components. One
  exported function per endpoint, with typed input/output and the user-facing
  Chinese error strings. (Exception: chat streaming goes through `useChat` /
  `DefaultChatTransport` pointed at `/api/chat`.)
- **Shared chat/domain types** come from `lib/chat.ts` (`ChatUIMessage`,
  `ChatSource`) and `lib/file-service.ts` (`FileMetadata`, re-exported by
  `lib/api-client.ts`). Components import them with `import type`.
- Components are presentational + own their local state; extract a `hooks/` module
  only when logic is reused across components.
- Components that use hooks/state declare `"use client"`.

## Naming Conventions

- Components: `PascalCase.tsx` (e.g. `ChatWindow.tsx`). Functions/vars: `camelCase`.
- CSS classes: BEM-style — `block__element--modifier` (e.g. `chat__row--user`).

## Anti-patterns

- ❌ `fetch()` directly inside a component (put it in `lib/api-client.ts`).
- ❌ Inline styles for layout (use classes in `app/globals.css`).
- ❌ Importing server-only modules (`fs`, `lib/config.ts`, …) from client components —
  type-only imports are fine.
