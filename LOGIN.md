# 登录功能使用指南

装修小助手现在需要登录才能使用。本文档说明如何设置和使用认证功能。

## 功能概述

- **认证方式**：用户名 + 密码
- **用户类型**：内部用户（管理员预设）
- **Token 有效期**：7 天
- **保护范围**：所有聊天功能需登录

## 首次部署设置

### 1. 配置环境变量

后端需要配置 JWT 密钥。编辑 `backend/.env` 文件：

```bash
# JWT authentication (必须配置！)
# 生产环境请使用随机生成的密钥：openssl rand -hex 32
JWT_SECRET_KEY=your-secret-key-minimum-32-chars-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRE_DAYS=7

# Database path
DATABASE_PATH=data/database.db
```

**重要**：生产环境必须更改 `JWT_SECRET_KEY`！推荐使用以下命令生成：

```bash
openssl rand -hex 32
```

### 2. 运行数据库迁移

首次部署时需要创建数据库表：

```bash
cd backend
.venv/Scripts/alembic upgrade head
```

### 3. 创建管理员账号

使用 CLI 工具创建第一个用户：

```bash
cd backend
.venv/Scripts/python -m app.cli.create_user admin YourSecurePassword123
```

**输出**：
```
[OK] User 'admin' created successfully.
```

## 创建更多用户

管理员可以通过 CLI 创建更多用户：

```bash
cd backend
.venv/Scripts/python -m app.cli.create_user <用户名> <密码>
```

**限制**：
- 用户名：≥3 字符
- 密码：≥8 字符

## 前端登录流程

1. 打开前端页面（http://localhost:5173）
2. 显示登录表单，输入用户名和密码
3. 点击"登录"按钮
4. 登录成功后进入聊天界面
5. 顶部显示用户名和"登出"按钮

**Token 持久化**：
- Token 存储在浏览器 localStorage 中
- 刷新页面自动验证 token，无需重新登录
- Token 有效期 7 天，过期后需重新登录

## API 使用

### 登录

**请求**：
```bash
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "YourPassword"
}
```

**响应**（200 成功）：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "username": "admin"
}
```

**响应**（401 失败）：
```json
{
  "detail": "Incorrect username or password"
}
```

### 获取当前用户信息

**请求**：
```bash
GET /auth/me
Authorization: Bearer <your_token>
```

**响应**（200 成功）：
```json
{
  "username": "admin",
  "is_active": true
}
```

### 使用聊天功能

所有聊天端点现在需要认证：

```bash
POST /chat/stream
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "messages": [
    {"role": "user", "content": "卫生间防水要刷多高？"}
  ]
}
```

**未认证响应**（401）：
```json
{
  "detail": "Not authenticated"
}
```

## 测试

后端测试已包含认证测试：

```bash
cd backend
.venv/Scripts/pytest tests/test_auth.py -v
.venv/Scripts/pytest tests/test_chat_auth.py -v
```

## 安全建议

1. **生产环境**：
   - 必须更改 `JWT_SECRET_KEY`（≥32 字符）
   - 使用 HTTPS 传输（避免 token 被截获）
   - 定期更新用户密码
   
2. **密码强度**：
   - 建议 ≥12 字符
   - 包含大小写字母、数字、特殊字符

3. **Token 管理**：
   - Token 有效期 7 天（可在 `.env` 中调整 `JWT_EXPIRE_DAYS`）
   - 无刷新机制（到期需重新登录）
   - 前端存储在 localStorage（用户登出时清除）

## 故障排除

### 登录失败：用户名或密码错误

检查用户是否存在：

```bash
cd backend
.venv/Scripts/python -c "import asyncio; from sqlalchemy import select; from app.database import AsyncSessionLocal; from app.models import User; async def check(): async with AsyncSessionLocal() as s: r = await s.execute(select(User)); print([u.username for u in r.scalars()]); asyncio.run(check())"
```

### Token 过期

前端会自动检测 401 错误并提示重新登录。用户点击"登出"后可重新登录。

### 数据库文件丢失

如果 `data/database.db` 被删除，需要重新运行迁移和创建用户：

```bash
cd backend
.venv/Scripts/alembic upgrade head
.venv/Scripts/python -m app.cli.create_user admin NewPassword123
```

## MVP 限制

当前实现为 MVP（最小可行产品），存在以下限制：

- ❌ 无自助注册功能
- ❌ 无密码找回/重置
- ❌ 无角色权限系统
- ❌ 无会话管理（无法主动撤销 token）
- ❌ 无 Token 刷新机制

后续可根据需求扩展这些功能。
