# 装修小助手 (Renovation Assistant)

面向**业主**的对话式装修问答顾问。用大白话回答装修问题(选材、施工工艺/顺序、报价是否合理、避坑、流程),底层基于**国内 LLM + 精选装修知识库(RAG)**。

> 需求与技术决策详见 [`.trellis/tasks/06-09-renovation-assistant/prd.md`](.trellis/tasks/06-09-renovation-assistant/prd.md)。

## 架构

```
┌──────────────┐     POST /chat      ┌─────────────────────┐
│  React 前端   │ ──────────────────> │   FastAPI 后端       │
│ (Vite + TS)  │ <────────────────── │  ┌────────────────┐ │
└──────────────┘     {reply}         │  │ LLM provider   │ │ ──> DeepSeek / Qwen / GLM
                                      │  │ (OpenAI 兼容)   │ │     (OpenAI-compatible API)
                                      │  └────────────────┘ │
                                      │  └ RAG 检索 (PR2)    │ ──> 向量库 + 装修知识库
                                      │  └ 图片生成 (NEW)    │ ──> gpt-image-2 API
                                      └─────────────────────┘
```

## 功能特性

- ✅ **智能问答**：基于 RAG 的装修知识检索 + LLM 生成（110块知识/22篇文档）
- ✅ **流式输出**：SSE 打字机效果 + 实时来源标注
- ✅ **用户认证**：JWT 登录保护
- ✅ **文件管理**：上传装修图片/文档到知识库
- ✅ **图片生成**：根据描述生成装修效果图（`/image/generate`）

## 目录结构

```
renovation-assistant/
├── backend/      FastAPI 服务 (Python)        见 backend/README.md
│   ├── app/
│   │   ├── routers/
│   │   │   ├── auth.py          # JWT 认证
│   │   │   ├── files.py         # 文件管理
│   │   │   └── image.py         # 图片生成 (NEW)
│   │   ├── services/
│   │   │   └── image_service.py # 图片生成服务
│   │   └── rag/                 # RAG 检索
│   └── data/
│       ├── knowledge/           # 装修知识库 (22篇)
│       └── index/               # 向量索引 (110块)
├── frontend/     React + Vite 聊天界面 (TS)
└── .trellis/     Trellis 工作流与任务/规范
```

## 快速开始

需要:Python 3.11+、Node 20+。

**后端**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows(Git Bash): source .venv/Scripts/activate
pip install -r requirements-dev.txt
cp .env.example .env          # 填入 LLM_API_KEY / EMBEDDING_API_KEY / IMAGE_API_KEY
uvicorn app.main:app --reload # http://localhost:8000
```

**前端**(另开一个终端)
```bash
cd frontend
npm install
cp .env.example .env          # 默认指向 http://localhost:8000
npm run dev                   # http://localhost:5173
```

## 新功能：图片生成 🎨

使用 gpt-image-2 模型根据文本描述生成装修效果图。

**API 示例**
```bash
curl -X POST http://localhost:8000/image/generate \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"现代简约风格客厅，白色墙面，木质地板"}'
```

**详细文档**：见 [IMAGE_GENERATION.md](IMAGE_GENERATION.md)

## 路线图

- **PR1** ✅ 脚手架 + 一问一答跑通(前端聊天页 + 后端 `/chat` + 可切换 LLM provider)。
- **PR2** ✅ RAG 核心 —— 知识库管线(切分/embedding/向量库)+ 检索 + 出处 + 空检索兜底 + 种子知识。
- **PR3** ✅ SSE 流式输出(打字机效果)+ 多轮上下文 + 基础加固(请求大小限制、LLM 超时)。
- **PR4** ✅ 用户认证 + 文件上传管理
- **PR5** ✅ 图片生成功能（gpt-image-2）
- **后续** ⏭️ 公开资料整理扩充知识库(含版权处理);更多种子知识与检索调优。

## 说明

- LLM 默认走 **DeepSeek**(OpenAI 兼容接口);切换到通义 Qwen / 智谱 GLM 只需改 `backend/.env` 里的 `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY`。
- Embedding 使用阿里百炼 **text-embedding-v4**，中英双语检索能力强。
- 图片生成使用 **gpt-image-2**，支持根据中文描述生成装修效果图。
- 各模型最新价格/版本以官方为准(后续核实)。

## 知识库扩充记录

详见 `backend/data/knowledge_expansion_log.md`

- **扩充前**：11篇文档 / 23块索引
- **扩充后**：22篇文档 / 110块索引（+380%）
- **新增主题**：水电改造、瓦工施工、全屋定制（基材/饰面/封边）、电路材料国标、防水材料国标等
