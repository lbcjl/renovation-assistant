# Frontend Development Guidelines

> Best practices for frontend development in this project (Next.js App Router + React + TypeScript).

---

## Overview

The frontend is the client-side part of a single **Next.js 15 (App Router) + React 19 +
TypeScript** application: a three-tab UI (chat / image generation / settings) that talks
to the colocated `app/api/*` route handlers. Network calls are isolated in
`lib/api-client.ts`, shared chat types come from `lib/chat.ts`, and components own their
local state.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Component/page/api organization | ✅ Filled |
| [Component Guidelines](./component-guidelines.md) | Function components, props, UI states | ✅ Filled |
| [Hook Guidelines](./hook-guidelines.md) | Custom hook naming and when to extract | ✅ Filled |
| [State Management](./state-management.md) | Local state in MVP; when to go global | ✅ Filled |
| [Quality Guidelines](./quality-guidelines.md) | ESLint, build, a11y, testing | ✅ Filled |
| [Type Safety](./type-safety.md) | strict TS, no any, typed API | ✅ Filled |

---

## Stack at a glance

- Next.js 15 App Router, React 19, TypeScript (strict)
- `@ai-sdk/react` `useChat` + `DefaultChatTransport` for chat streaming
  (sources rendered from the custom `data-sources` message part)
- `react-markdown` + `remark-gfm` for assistant message rendering
- ESLint flat config (`eslint-config-next`)
- Plain CSS with BEM-style class names (`app/globals.css`)

---

**Language**: All documentation should be written in **English**.
