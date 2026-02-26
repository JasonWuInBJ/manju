# 技术设计文档

## 1. 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                    前端 (React)                          │
├─────────────────────────────────────────────────────────┤
│  剧本编辑器 │ 人物设计器 │ 场景设计器 │ 视频合成器       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  API Gateway (Next.js)                   │
├─────────────────────────────────────────────────────────┤
│  /api/script  │ /api/character │ /api/scene │ /api/video│
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ LLM API  │   │ 图像 API │   │ 视频 API │
    │ Claude   │   │ DALL-E   │   │ Runway   │
    └──────────┘   └──────────┘   └──────────┘
```

## 2. 目录结构

```
comic-video-generator/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── page.tsx         # 首页
│   │   ├── project/[id]/    # 项目详情页
│   │   └── api/             # API 路由
│   ├── components/          # React 组件
│   │   ├── ScriptEditor/    # 剧本编辑器
│   │   ├── CharacterDesigner/
│   │   ├── SceneDesigner/
│   │   └── VideoComposer/
│   ├── services/            # API 调用服务
│   ├── stores/              # Zustand 状态
│   └── types/               # TypeScript 类型
├── docs/                    # 文档
└── public/                  # 静态资源
```

## 3. 核心数据模型

### 3.1 项目 (Project)
```typescript
interface Project {
  id: string;
  title: string;
  status: 'draft' | 'processing' | 'completed';
  novelText: string;
  script: Script;
  characters: Character[];
  scenes: Scene[];
  videos: Video[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.2 剧本 (Script)
```typescript
interface Script {
  title: string;
  duration: number;
  scenes: ScriptScene[];
}

interface ScriptScene {
  id: number;
  description: string;
  characters: string[];
  dialogue: string;
  camera: 'wide' | 'medium' | 'close';
  mood: string;
}
```

### 3.3 人物 (Character)
```typescript
interface Character {
  id: string;
  name: string;
  description: string;
  images: {
    front: string;    // 正面图 URL
    side: string;     // 侧面图
    back: string;     // 背面图
    quarter: string;  // 3/4 视角
  };
  expressions: {
    happy: string;
    sad: string;
    angry: string;
    surprised: string;
  };
  seed: number;       // 保持一致性的种子
}
```

### 3.4 场景 (Scene)
```typescript
interface Scene {
  id: string;
  name: string;
  description: string;
  style: string;
  views: {
    panorama: string;  // 全景
    medium: string;    // 中景
    closeup: string;   // 近景
    atmosphere: string; // 氛围图
  };
}
```

## 4. API 接口设计

### 4.1 剧本生成
```
POST /api/script/generate
Body: { novelText: string, duration: number }
Response: { script: Script }
```

### 4.2 人物生成
```
POST /api/character/generate
Body: { name: string, description: string }
Response: { character: Character }
```

### 4.3 场景生成
```
POST /api/scene/generate
Body: { description: string, style: string }
Response: { scene: Scene }
```

### 4.4 视频合成
```
POST /api/video/compose
Body: { sceneId: string, characterIds: string[], dialogue: string }
Response: { taskId: string }

GET /api/video/status/:taskId
Response: { status: string, progress: number, url?: string }
```

## 5. AI Prompt 模板

### 5.1 剧本生成 Prompt
```
你是一位专业的短视频编剧。请将以下小说片段改编为短视频剧本。

要求：
1. 时长约 {duration} 秒
2. 分为 3-5 个场景
3. 每个场景包含：场景描述、人物、对话、镜头、情绪

小说内容：
{novelText}

请以 JSON 格式输出。
```

### 5.2 人物描述生成 Prompt
```
根据以下人物信息，生成适合 AI 绘图的详细描述：

人物名：{name}
原始描述：{description}

输出格式：英文，包含外貌、服装、气质等细节。
```

## 6. 第三方 API 集成

### 6.1 OpenAI / Claude
- 用途：剧本生成、文本理解
- SDK：`openai` / `@anthropic-ai/sdk`

### 6.2 图像生成
- DALL-E 3：`openai.images.generate()`
- Midjourney：通过 Discord API 或第三方代理

### 6.3 视频生成
- Runway Gen-3：REST API
- Pika Labs：API（需申请）

## 7. 部署方案

- **平台**：Vercel / 阿里云
- **数据库**：Supabase PostgreSQL
- **存储**：Cloudflare R2 / 阿里云 OSS
- **CDN**：Cloudflare

---

*文档版本：v1.0*
