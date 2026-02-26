# 模型配置优化设计

## 背景

简化模型选择，保留 GLM-4.7、GLM-4-Flash 和 Claude Sonnet，移除 Opus 和 Haiku。同时将 API Key 配置从环境变量改为数据库存储，支持界面配置。

## 目标

1. 精简模型列表，保留常用模型
2. API Key 在界面配置，存储到数据库
3. 全局配置页面管理
4. 支持后续扩展新模型

---

## 数据模型

### GlobalConfig 表（新增）

```prisma
model GlobalConfig {
  id              String   @id @default("default")
  // 智谱 AI 配置
  glmApiKey       String?
  glmApiUrl       String?  @default("https://open.bigmodel.cn/api/paas/v4/chat/completions")
  // Anthropic 配置
  anthropicApiKey String?
  anthropicApiUrl String?  @default("https://api.anthropic.com")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### 模型列表

```typescript
const AVAILABLE_MODELS = [
  {
    id: 'glm-4.7',
    name: 'GLM-4.7',
    description: '智谱 AI 高性能模型，支持深度思考',
    provider: 'zhipu',
    thinking: true,
  },
  {
    id: 'glm-4-flash',
    name: 'GLM-4-Flash',
    description: '智谱 AI 快速模型，响应迅速',
    provider: 'zhipu',
    thinking: false,
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'Anthropic 均衡模型',
    provider: 'anthropic',
    thinking: false,
  },
  {
    id: 'claude-sonnet-4-5-20250929-thinking',
    name: 'Claude Sonnet 4.5 (Thinking)',
    description: 'Anthropic 均衡模型，支持思考',
    provider: 'anthropic',
    thinking: true,
  },
]
```

---

## API 设计

### 全局配置 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings` | 获取当前配置（脱敏） |
| PATCH | `/api/settings` | 更新配置 |

**GET 响应**（脱敏）：
```json
{
  "id": "default",
  "glmApiKey": "****abc123",
  "glmApiUrl": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
  "anthropicApiKey": "****xyz789",
  "anthropicApiUrl": "https://api.anthropic.com"
}
```

**PATCH 请求**：
```json
{
  "glmApiKey": "新的key",
  "anthropicApiKey": "新的key"
}
```

---

## 设置页面

**路由**：`/settings`

**页面布局**：
```
┌─────────────────────────────────────────┐
│  全局设置                               │
├─────────────────────────────────────────┤
│  智谱 AI 配置                           │
│  ┌─────────────────────────────────────┐│
│  │ API Key: [****abc123    ] [显示/隐藏]││
│  │ API 端点: [https://open.bigmodel...] ││
│  │ 状态: ✅ 已配置                      ││
│  └─────────────────────────────────────┘│
│                                         │
│  Anthropic 配置                         │
│  ┌─────────────────────────────────────┐│
│  │ API Key: [未配置        ] [显示/隐藏]││
│  │ API 端点: [https://api.anthropic.com]││
│  │ 状态: ⚠️ 未配置                      ││
│  └─────────────────────────────────────┘│
│                                         │
│  [保存配置]                             │
└─────────────────────────────────────────┘
```

**功能**：
- API Key 默认脱敏显示，点击可切换明文
- 未配置的供应商显示警告状态
- 保存后立即生效

---

## AI 调用改造

### lib/ai.ts 改造

```typescript
async function getConfig() {
  const config = await prisma.globalConfig.findUnique({ where: { id: 'default' } })
  return config
}

async function callZhipuAI(params: {...}): Promise<string> {
  const config = await getConfig()
  const apiKey = config?.glmApiKey

  if (!apiKey) {
    throw new Error('智谱 AI 未配置，请前往 /settings 配置 API Key')
  }

  const apiUrl = config.glmApiUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
  // ... 调用逻辑
}

async function callAnthropic(params: {...}): Promise<string> {
  const config = await getConfig()
  const apiKey = config?.anthropicApiKey

  if (!apiKey) {
    throw new Error('Anthropic 未配置，请前往 /settings 配置 API Key')
  }

  const apiClient = new Anthropic({
    apiKey,
    baseURL: config.anthropicApiUrl || 'https://api.anthropic.com',
  })
  // ... 调用逻辑
}
```

### 环境变量兼容

- 首次启动时，如果数据库无配置，从环境变量初始化
- 后续以数据库配置为准

### ModelSelector 组件

- 移除已删除的模型选项
- 未配置 API Key 的供应商显示警告标识

---

## 实施计划

1. **Phase 1**：数据库 Schema 更新
   - 新增 GlobalConfig 表
   - 运行迁移

2. **Phase 2**：API 实现
   - GET/PATCH /api/settings

3. **Phase 3**：设置页面
   - 创建 /settings 页面
   - 配置表单组件

4. **Phase 4**：AI 调用改造
   - 改造 lib/ai.ts
   - 环境变量初始化逻辑

5. **Phase 5**：模型选择器更新
   - 更新 AVAILABLE_MODELS
   - 显示配置状态
