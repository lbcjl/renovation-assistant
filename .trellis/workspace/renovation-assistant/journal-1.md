# Journal - renovation-assistant (Part 1)

> AI development session journal
> Started: 2026-06-09

---



## Session 1: Renovation assistant MVP: brainstorm, PR1 scaffold, spec bootstrap, PR2 RAG, tuning

**Date**: 2026-06-09
**Task**: Renovation assistant MVP: brainstorm, PR1 scaffold, spec bootstrap, PR2 RAG, tuning

### Summary

Homeowner-facing Web renovation Q&A assistant (domestic LLM + RAG), built and verified end-to-end following the Trellis workflow.

### Main Changes

本次会话从一句「想做装修智能体」出发，经 brainstorm 收敛为「面向业主的 Web 对话式装修问答顾问（国内 LLM + RAG）」，完成 PR1 脚手架、回填开发规范、PR2 RAG，并用真实 key 端到端验证与调优。全程按 Trellis 流程推进。

| 阶段 | 提交 | 内容 |
|------|------|------|
| Brainstorm | — | 收敛 核心方向/目标用户/平台/知识来源/provider，产出 PRD（含 ADR、验收标准、PR 计划） |
| PR1 | `7c65f8b` | FastAPI `/health`+`/chat`、LLM provider 抽象（OpenAI 兼容）、React+Vite 聊天页、pytest/ruff/CI |
| Bootstrap | `324a4fe` | 从 PR1 真实代码回填 `.trellis/spec` 后端 5 + 前端 6 份规范，归档 `00-bootstrap-guidelines` |
| PR2 | `3365013` | RAG：embeddings/向量库(numpy 余弦)/切分/检索/ingest；`/chat` 检索增强+「依据」出处+空检索兜底；6 篇种子知识；前端依据展示；测试 |
| Fix | `b4443fc` | provider 懒构造客户端（空 key 不再 500，改为按需 502） |
| Fix | `af0373e` | embedding 分批（DashScope 限 10 条/批）+ `.env.example` 文档 |
| Tune | `50e8e16` | `RETRIEVAL_MIN_SCORE`→0.5（出处更精准，sources 由 4 条收紧到 2 条） |

**技术栈**：后端 Python/FastAPI；LLM DeepSeek（OpenAI 兼容，可切 Qwen/GLM）；Embedding 阿里百炼 `text-embedding-v4`；向量库 numpy 余弦（本地持久化 `data/index/`）；前端 React+Vite+TS。

**验证**：ruff 干净；pytest 17 项全过；前端 eslint+build 全过；真实建索引（13 块/6 文档）；`/chat` 实测返回基于知识库、带「依据」的回答（防水问题 top 命中 0.943）。

**关键决策 / 踩坑**：
- vision embedding 模型 `tongyi-embedding-vision-plus` 在 DashScope OpenAI 兼容模式 404 不支持 → 纯文本 RAG 改用 `text-embedding-v4`。
- DashScope 文本 embedding 单批 ≤10 → `embed()` 分批。
- 空 `api_key` 会让 `AsyncOpenAI` 构造即抛错 → 懒构造，缺 key 时降级/502 而非 500。
- 向量库 MVP 选 numpy（Windows 上 sqlite-vec 扩展加载不稳），已在 spec 注明后续可换 sqlite-vec/Qdrant。

**运行方式**：
- 后端：`cd backend` → venv → `pip install -r requirements-dev.txt` → `cp .env.example .env`（填 `LLM_API_KEY` + `EMBEDDING_API_KEY/BASE_URL/MODEL`）→ `python -m app.rag.ingest` → `uvicorn app.main:app`
- 前端：`cd frontend` → `npm install` → `npm run dev` → http://localhost:5173

**后续（PR3）**：流式输出（打字机效果）、多轮上下文、公开资料整理扩充知识库、超时/输入注入等边界处理。


### Git Commits

| Hash | Message |
|------|---------|
| `7c65f8b` | (see git log) |
| `324a4fe` | (see git log) |
| `3365013` | (see git log) |
| `b4443fc` | (see git log) |
| `af0373e` | (see git log) |
| `50e8e16` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: PR3: streaming chat over SSE + request guards

**Date**: 2026-06-09
**Task**: PR3: streaming chat over SSE + request guards

### Summary

SSE token streaming (typewriter UX) with live source citations, request-size guards and a configurable LLM timeout; verified end-to-end.

### Main Changes

PR3 在 PR1/PR2 基础上加入流式输出与基础加固，MVP 三步（脚手架 → RAG → 流式）全部完成并真实跑通。

| 项 | 内容 |
|----|------|
| SSE 流式 | `POST /chat/stream`：先发 `sources` 事件 → 逐 token `delta` → `done`；中途出错发 `error` 事件。非流式 `/chat` 保留 |
| Provider | `LLMProvider.chat_stream`（OpenAI 流式 `stream=True`）；可配置请求超时 `request_timeout_seconds` |
| 加固 | 请求限制：≤40 条消息、每条 ≤4000 字（超限返回 422） |
| 前端 | 消费 SSE 打字机渲染（空助手气泡逐字填充）+ 实时「依据」来源标注 |
| 测试 | `/chat/stream` 流式测试 + 请求限制测试；pytest 20 项全过；前端 eslint + build 通过 |

**验证**：真实 DashScope `text-embedding-v4` + DeepSeek 流式——`/chat/stream` 实测先发 sources 事件（4 条相关来源）+ 222 个 delta + done。

**踩坑**：后台重启 uvicorn 时若不显式 `cd` 到 `backend/`，会因 cwd 残留在 `frontend/` 而 exit 127（找不到 `.venv`）；已固定为命令内显式 cd。

**提交**：`e2d02d2`（feat: stream chat responses over SSE）。

**后续**：公开资料整理扩充知识库（含版权处理）、更多种子知识与检索精度调优。


### Git Commits

| Hash | Message |
|------|---------|
| `e2d02d2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: Expand RAG knowledge base from public sources

**Date**: 2026-06-09
**Task**: Expand RAG knowledge base from public sources

### Summary

Added 5 paraphrased-and-cited knowledge docs (index 13 -> 23 chunks / 11 docs); verified new-topic retrieval; sources recorded in data/sources.md.

### Main Changes

本段在 MVP（PR1–PR3）完成后，按「公开资料整理扩充知识库」对 RAG 知识库做了扩充。

| 项 | 内容 |
|----|------|
| 新增知识 | 5 篇：墙面与油漆、吊顶、地板、厨房、装修合同与避坑 |
| 整理方式 | 依据公开资料（知乎 / 新浪家居 / 什么值得买 / 住小帮 / 房天下 / 上海装潢网 / 政府消费提示等）**用自有措辞改写事实要点**，非原文照搬；来源链接记于 `data/sources.md`（不进检索块，避免污染 RAG） |
| 索引 | 由 13 块 / 6 文档 增至 **23 块 / 11 文档**（`python -m app.rag.ingest`） |
| 验证 | 真实检索新主题——「厨房台面用石英石还是不锈钢」top 命中 `kitchen · 厨房台面选什么材质？` score 0.847 |

**版权处理**：仅改写事实性要点（事实本身不受著作权保护），单独留存来源链接备查，避免照搬原文或违反站点条款。

**提交**：`ec06cbd`（feat: expand knowledge base from public sources）。

**后续**：可继续扩充更多主题、检索精度调优；或做用户账号、预算估算 / 选材清单等工具能力。


### Git Commits

| Hash | Message |
|------|---------|
| `ec06cbd` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
