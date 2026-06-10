# 装修小助手 (Renovation Assistant)

面向**业主**的对话式装修问答顾问。用大白话回答装修问题（选材、施工工艺/顺序、报价是否合理、避坑、流程），底层基于**国内 LLM + 精选装修知识库（RAG）**，并支持 AI 生成装修效果图。

> 迁移决策与需求详见 [`.trellis/tasks/06-10-migrate-to-nextjs/prd.md`](.trellis/tasks/06-10-migrate-to-nextjs/prd.md)。

## 技术栈

单个 **Next.js 15（App Router）** 全栈应用，一条 `npm run dev` 启动前后端：

- **前端**：React 19 + TypeScript（strict），纯 CSS（BEM 命名，`app/globals.css`）
- **聊天流式输出**：Vercel AI SDK（`ai` + `@ai-sdk/react` 的 `useChat`，RAG 来源以自定义 `data-sources` 流数据块下发）
- **后端**：Next.js Route Handlers（Node runtime，`app/api/**`）
- **RAG**：自研向量库（余弦相似度，JSON 持久化）+ OpenAI 兼容 `/embeddings`
- **测试**：Vitest

> 历史版本是 FastAPI(Python) 后端 + Vite 前端的双项目结构，已于 2026-06 整体迁移到 Next.js（旧代码保留在 git 历史中）。**登录/JWT 认证功能已整体移除**（本地自用，无需登录）。

## 功能特性

- **智能问答**：基于 RAG 的装修知识检索 + LLM 流式回答，每条回答标注知识库「依据」
- **AI 效果图**：根据中文描述生成装修效果图（`POST /api/image`，约需 1~2 分钟）
- **文件管理**：上传 PDF/Word/Excel/图片，一键提取文本加入知识库
- **运行时设置**：设置页可在线切换对话/生图模型的中转站地址、Key 与模型，保存即生效

## 目录结构

```
renovation-assistant/
├── app/
│   ├── api/                 # Route Handlers（后端）
│   │   ├── chat/            #   POST /api/chat        — RAG + 流式聊天
│   │   ├── image/           #   POST /api/image       — 生成效果图
│   │   ├── files/           #   文件上传/列表/删除/加入知识库/取回内容
│   │   └── settings/        #   GET/PUT /api/settings/{llm|image} (+ /models)
│   ├── globals.css          # 全局样式（BEM）
│   ├── layout.tsx
│   └── page.tsx             # 三个 Tab：装修问答 / AI 效果图 / 设置
├── components/              # React 组件（ChatWindow、ImageGenerator、SettingsPage…）
├── lib/                     # 服务端逻辑（config、chat 校验、image-service、文件服务…）
│   └── rag/                 # 切分 / embedding / 向量库 / 检索
├── scripts/ingest.ts        # 知识库索引构建脚本
├── tests/ + lib/**/*.test.ts# Vitest 测试
└── data/
    ├── knowledge/           # 装修知识 markdown（git 跟踪，索引的事实来源）
    ├── index/               # 向量索引（documents.json + embeddings.json，生成产物）
    ├── uploads/             # 用户上传文件（运行时生成）
    └── provider_config.json # 设置页保存的中转站配置（含 Key，git 忽略）
```

## 快速开始

需要 Node 20+。

```bash
npm install
cp .env.example .env.local    # 填入 LLM_API_KEY / EMBEDDING_API_KEY / IMAGE_API_KEY
npm run ingest                # 构建知识库向量索引（需 EMBEDDING_API_KEY）
npm run dev                   # http://localhost:3000
```

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（前后端同端口） |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest 全量测试 |
| `npm run ingest` | 从 `data/knowledge/**/*.md` 重建 `data/index/` 向量索引 |

## 图片生成

```bash
curl -X POST http://localhost:3000/api/image \
  -H "Content-Type: application/json" \
  -d '{"prompt":"现代简约风格客厅，白色墙面，木质地板"}'
# => {"image_url": "https://..."}
```

错误约定（瞬时故障自动重试 3 次，间隔递增）：

| 条件 | 状态码 | detail |
|------|--------|--------|
| prompt 为空 / 超过 1000 字 | 400 | 校验信息 |
| 未配置 `IMAGE_API_KEY` | 503 | `Image generation not configured` |
| 上游瞬时故障且重试耗尽 | 503 | `Image service temporarily unavailable` |
| 其他生成失败 | 502 | `Image generation failed` |

如中转站需要代理访问，配置 `IMAGE_PROXY_URL`（如 `http://127.0.0.1:7897`）。

## 说明

- LLM 默认走 **DeepSeek**（OpenAI 兼容接口）；切换提供商可改 `.env.local` 的 `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY`，或直接在「设置」页在线修改（持久化到 `data/provider_config.json`，优先于环境变量）。
- Embedding 默认 SiliconFlow 的 **BAAI/bge-m3**（中文检索效果好；DeepSeek 无 embeddings 端点，需单独的 Key）。
- 知识库以 `data/knowledge/` 下的 markdown 为准；改动后重新执行 `npm run ingest`。上传文件「加入知识库」后立即可被检索，无需重启。
- 登录/认证已移除：所有接口本地直接可用，不再需要 JWT Token。
- 长请求（生图 1~2 分钟）适合本地自托管；部署到 Vercel 等平台需注意函数超时限制。
