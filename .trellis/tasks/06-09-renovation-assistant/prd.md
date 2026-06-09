# 装修智能体 (Renovation Assistant) — 业主向对话式装修问答顾问

## Goal

面向**业主**的 **Web 对话式装修问答顾问**:用户用自然语言提问(选材、施工工艺/顺序、报价是否合理、避坑、装修流程等),系统基于 **国内 LLM + 精选装修知识库(RAG)** 给出通俗、可信、尽量可溯源的解答。后续可把"预算估算""选材清单生成"等作为工具能力扩展。

## Requirements

- R1. Web 聊天界面,支持多轮对话与 SSE 流式输出。
- R2. 面向业主:表达通俗、接地气,必要时解释专业术语。
- R3. 覆盖核心问答场景(MVP):选材建议、施工工艺/顺序、报价合理性判断、常见避坑、装修流程。
- R4. RAG:基于装修知识库做检索增强,回答尽量给出依据/出处;**检索为空时兜底**(明说"不确定 / 建议咨询专业人士"),不编造。
- R5. 知识库内容 = **自写种子知识(MVP 主力)** + **公开资料整理(改写事实/要点 + 标注来源,避免搬运受版权保护原文)**。
- R6. LLM 用**国内模型**,provider 通过配置可切换(默认一家起步)。

## Acceptance Criteria

- [ ] 用户在网页上就常见装修问题发起多轮对话,获得相关、正确、通俗的解答。
- [ ] 回答经知识库检索增强;命中时给出处,未命中时给兜底回复而非编造。
- [ ] 回答以流式逐字返回;首字时延可接受(目标 < 3s,联网核实模型后定稿)。
- [ ] 知识库支持增量添加文档并重建索引。
- [ ] 后端对"检索""回答生成""空检索兜底"有基础测试。

## Definition of Done (team quality bar)

- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes
- Rollout/rollback considered if risky

## Technical Approach

- **后端**:Python + FastAPI(LLM/RAG 生态最成熟)。
- **LLM**:国内模型,默认 **DeepSeek**(可配置切换 通义 Qwen / 智谱 GLM);薄 provider 抽象层。
- **Embedding**:**BGE-M3**(中文检索强);MVP 经托管 API 调用(如 硅基流动 / DashScope)免自运维,后续可本地化。
- **向量库**:MVP 用 **sqlite-vec 或 Chroma**(本地、零运维);数据量大再上 Qdrant/Milvus。
- **前端**:React + Vite 聊天 UI,SSE 流式;后续可换 Next.js。
- **知识库管线**:文档(md/txt)→ 切分 → embedding → 向量库;查询时检索 top-k 注入提示词,要求模型**基于检索内容作答并给出处**。
- **配置**:API key、模型名、top-k 等走环境变量 / 配置文件。

## Decision (ADR-lite)

**Context**: "装修智能体"形态多样,需先定主线、用户、平台、知识来源与 provider。
**Decision**: MVP = 面向业主的 Web 对话式装修问答顾问;LLM + RAG;采用 **Approach A**(Python + FastAPI + 国内 LLM + BGE-M3 embedding + 本地向量库 + React 前端)。
**Consequences**: 重心在"回答质量 + 知识库质量";引入 RAG 多一层检索管线(换准确性/可溯源);provider 做可切换抽象以降低绑定风险。公开资料整理需做版权合规处理。

## Out of Scope (MVP 不做)

- 复杂项目管理 CRUD(进度/采购/施工队)、效果图 / 图像生成、移动端原生 App、微信小程序。
- 预算估算 / 方案生成:列为后续"工具能力"扩展。
- 完整用户账号体系:MVP 可先无登录或最简会话。

## Technical Notes

- 价格 / 最新模型版本待联网恢复后核实,再落 provider 具体代码。
- 公开资料整理须注意版权:改写事实与要点 + 标注来源,避免搬运原文或违反站点条款的抓取;种子知识为 MVP 主力。
- 技术栈已定,可据此填充 `00-bootstrap-guidelines` 的前/后端开发指南。
- 已检视 `.trellis/` 脚手架,无既有产品代码;本项目从零搭建。

## Implementation Plan (small PRs)

- **PR1 — 脚手架 + 一问一答骨架**:FastAPI 后端(健康检查 + /chat)、最小 React 聊天页、LLM provider 抽象(默认 DeepSeek)跑通一问一答(暂不接 RAG)、配置/环境变量、基础测试 + lint/CI。
- **PR2 — RAG 核心**:知识库管线(切分/embedding/sqlite-vec)+ 检索;检索结果注入提示词;录入一小批种子知识;回答给出处;空检索兜底;检索/回答测试。
- **PR3 — 体验 + 边界 + 内容扩充**:SSE 流式输出、多轮上下文;公开资料整理脚本(改写 + 来源标注)扩充知识库;错误/超时/输入注入处理;文档完善。
