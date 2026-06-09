# Frontend Development Guidelines

> Best practices for frontend development in this project (React + Vite + TypeScript).

---

## Overview

The frontend is a **React + Vite + TypeScript** single-page chat UI that talks to the backend
`/chat` API. Network calls are isolated in `src/api/`, shared types in `src/types.ts`, and
components own their local state.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Component/page/api/hook organization | ✅ Filled |
| [Component Guidelines](./component-guidelines.md) | Function components, props, UI states | ✅ Filled |
| [Hook Guidelines](./hook-guidelines.md) | Custom hook naming and when to extract | ✅ Filled |
| [State Management](./state-management.md) | Local state in MVP; when to go global | ✅ Filled |
| [Quality Guidelines](./quality-guidelines.md) | ESLint, build, a11y, testing | ✅ Filled |
| [Type Safety](./type-safety.md) | strict TS, no any, typed API | ✅ Filled |

---

## Stack at a glance

- React 18, Vite 5, TypeScript (strict)
- ESLint flat config + `typescript-eslint`
- Plain CSS with BEM-style class names (`src/index.css`)

---

**Language**: All documentation should be written in **English**.
