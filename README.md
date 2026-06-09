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
                                      └─────────────────────┘
```

## 目录结构

```
renovation-assistant/
├── backend/      FastAPI 服务 (Python)        见 backend/README.md
├── frontend/     React + Vite 聊天界面 (TS)
├── .github/      CI 工作流
└── .trellis/     Trellis 工作流与任务/规范
```

## 快速开始

需要:Python 3.11+、Node 20+。

**后端**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows(Git Bash): source .venv/Scripts/activate
pip install -r requirements-dev.txt
cp .env.example .env          # 填入 LLM_API_KEY(DeepSeek 等)
uvicorn app.main:app --reload # http://localhost:8000
```

**前端**(另开一个终端)
```bash
cd frontend
npm install
cp .env.example .env          # 默认指向 http://localhost:8000
npm run dev                   # http://localhost:5173
```

## 路线图

- **PR1(当前)**:脚手架 + 一问一答跑通(前端聊天页 + 后端 /chat + 可切换 LLM provider)。*暂未接 RAG。*
- **PR2**:RAG 核心 —— 知识库管线(切分/embedding/向量库)+ 检索 + 出处 + 空检索兜底 + 录入种子知识。
- **PR3**:SSE 流式输出 + 多轮上下文 + 公开资料扩充知识库 + 边界处理(超时/输入注入)。

## 说明

- LLM 默认走 **DeepSeek**(OpenAI 兼容接口);切换到通义 Qwen / 智谱 GLM 只需改 `backend/.env` 里的 `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY`。
- 各模型最新价格/版本以官方为准(后续核实)。
