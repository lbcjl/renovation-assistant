# 图片生成功能使用指南

## 功能概述

新增 `/image/generate` API 端点，支持根据文本描述生成装修效果图。

## API 配置

### 环境变量
```bash
# backend/.env
IMAGE_API_KEY=sk-your-image-key-here
IMAGE_BASE_URL=https://freeapi.dgbmc.top/v1
IMAGE_MODEL=gpt-image-2
```

### 配置说明
- **模型**：gpt-image-2（OpenAI 兼容接口）
- **提供商**：freeapi.dgbmc.top
- **API Key**：本地 `.env` 配置，不提交真实密钥

## API 端点

### POST /image/generate

**请求**
```json
{
  "prompt": "现代简约风格的客厅，白色墙面，木质地板，大落地窗"
}
```

**响应**
```json
{
  "image_url": "https://example.com/generated-image.png"
}
```

**认证**：需要 JWT Token（Bearer Token）

**限制**：
- prompt 长度：1-1000 字符
- 需要登录后调用

## 前端调用示例

```typescript
import api from './api';
import { getToken } from '../utils/token';

export async function generateImage(prompt: string): Promise<string> {
  const token = getToken();
  if (!token) {
    throw new Error('未登录，请先登录');
  }

  const response = await api.post('/image/generate', { prompt }, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data.image_url;
}

// 使用示例
const imageUrl = await generateImage('北欧风格的卧室，原木家具，暖色调');
```

## cURL 测试

```bash
# 1. 先登录获取 token
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 2. 生成图片
curl -X POST http://localhost:8000/image/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"prompt":"简约现代风格客厅，白色墙面，木质地板"}'
```

## 典型使用场景

### 1. 装修风格预览
```json
{
  "prompt": "新中式风格客厅，木质家具，水墨画装饰，暖色灯光"
}
```

### 2. 空间布局构思
```json
{
  "prompt": "开放式厨房，白色橱柜，大理石台面，中岛设计"
}
```

### 3. 材料搭配效果
```json
{
  "prompt": "卧室，灰色墙面配白色衣柜，浅色木地板，简约吊灯"
}
```

## 错误处理

### 401 Unauthorized
```json
{
  "detail": "Could not validate credentials"
}
```
**解决**：检查 Authorization header 是否正确

### 503 Service Unavailable

未配置:
```json
{
  "detail": "Image generation not configured"
}
```
**解决**：检查 IMAGE_API_KEY 环境变量是否配置

上游瞬时故障（自动重试 3 次后仍失败）:
```json
{
  "detail": "Image service temporarily unavailable"
}
```
**解决**：上游中转服务（连接断开 / 5xx / 限流）暂时不可用，稍后重试即可；后端已自动重试 3 次（间隔 2s/4s）

### 502 Bad Gateway
```json
{
  "detail": "Image generation failed"
}
```
**解决**：
- 检查 IMAGE_BASE_URL 是否可访问
- 检查 API Key 是否有效
- 查看后端日志获取详细错误

## 架构说明

### 文件结构
```
backend/
├── app/
│   ├── routers/
│   │   └── image.py              # 图片生成路由
│   ├── services/
│   │   └── image_service.py      # 图片生成服务
│   ├── schemas.py                # 添加 ImageGenerationRequest/Response
│   ├── config.py                 # 添加 image_* 配置项
│   └── main.py                   # 注册 image router
└── tests/
    └── test_image.py             # 图片生成测试
```

### 调用流程
```
前端请求
  ↓
POST /image/generate (需认证)
  ↓
ImageGenerationService
  ↓
OpenAI 兼容 API (images.generate)
  └─ model: gpt-image-2
  └─ prompt: 用户输入的装修效果描述
  ↓
返回图片 URL
```

## 测试

```bash
cd backend
source .venv/Scripts/activate  # Windows Git Bash
pytest tests/test_image.py -v
```

## 前端集成建议

### 1. 创建图片生成组件
```tsx
// components/ImageGenerator.tsx
import { useState } from 'react';
import { generateImage } from '../services/imageService';

export function ImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const url = await generateImage(prompt);
      setImageUrl(url);
    } catch (error) {
      console.error('生成失败', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <textarea 
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="描述你想要的装修效果..."
      />
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? '生成中...' : '生成效果图'}
      </button>
      {imageUrl && <img src={imageUrl} alt="生成的效果图" />}
    </div>
  );
}
```

### 2. 添加预设提示词
```tsx
const PRESET_PROMPTS = [
  '现代简约客厅，白色墙面，木质地板',
  '北欧风格卧室，浅色木家具，暖色调',
  '开放式厨房，白色橱柜，大理石台面',
  '新中式书房，实木书桌，书架，水墨画',
];
```

## 注意事项

1. **API 限流**：注意 gpt-image-2 的调用频率限制
2. **成本控制**：生成图片可能产生费用，建议添加使用配额
3. **图片缓存**：相同 prompt 可缓存结果避免重复生成
4. **提示词优化**：鼓励用户提供详细描述（风格/颜色/材质/布局）

## 扩展方向

- [ ] 支持批量生成（多个角度/风格）
- [ ] 添加图片历史记录
- [ ] 支持图片编辑（基于生成的图片再修改）
- [ ] 集成到聊天界面（对话中生成效果图）

---

**添加时间**：2026-06-10  
**依赖版本**：openai SDK（已在 requirements-dev.txt）  
**测试状态**：✅ 单元测试已添加
