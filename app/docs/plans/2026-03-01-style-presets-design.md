# 风格预设系统设计文档

## 概述
将风格预设从硬编码改为数据库存储，支持用户自定义预设。

## 目标
- 将现有11个风格预设迁移到数据库
- 支持用户创建项目级别的自定义预设
- 保持系统预设的不可编辑性

## 数据库设计

### 新增表：StylePreset

```prisma
model StylePreset {
  id          String   @id @default(uuid())
  name        String   // 显示名称
  keywords    String   // 英文关键词
  category    String   // 'popular' | 'artistic' | '3d'
  icon        String   // emoji 图标
  description String   // 中文描述
  isDefault   Boolean  @default(false) // 系统预设标识
  order       Int      @default(0) // 排序权重
  projectId   String?  // null=全局预设，非null=项目自定义
  project     Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([projectId, category])
}
```

**字段说明**：
- `isDefault`: true 表示系统预设，不可编辑删除
- `projectId`: null 表示全局预设，非null 表示项目级预设
- `order`: 同一类别内的排序权重，数字越小越靠前

### 修改 Project 模型

```prisma
model Project {
  // ... 现有字段
  stylePresets StylePreset[] // 新增关联
}
```

## 风格预设数据

### 主流商业漫剧风 (popular)
1. 二次元赛璐璐 - `Anime style, cel shading, flat colors, clean lines, vibrant`
2. 吉卜力风格 - `Studio Ghibli style, Hayao Miyazaki style, hand-drawn, watercolor texture, lush nature, whimsical, serene, vibrant blues and greens`
3. 热血少年漫 - `Shonen manga style, dynamic composition, speed lines, impactful, exaggerated anatomy, energetic, bold outlines, action scene`
4. 萌系二次元 - `Kawaii, Moe style, big eyes, pastel colors, soft lighting, blush, cute, innocent`
5. 韩漫精致风 - `Korean webtoon style, manhwa style, detailed illustration, soft lighting`
6. 新海诚风 - `Makoto Shinkai style, anime art, vibrant colors, lens flare, detailed clouds`
7. 厚涂概念风 - `Digital painting, semi-realistic, thick impasto, artstation trending, cinematic lighting`

### 特色艺术风格 (artistic)
1. 国潮水墨风 - `Chinese ink wash painting, traditional chinese art, watercolor style, elegant, ink splashes`
2. 赛博朋克风 - `Cyberpunk style, neon lights, futuristic, sci-fi, blade runner aesthetic`
3. 末世废土 - `Post-apocalyptic, wasteland, rust, dust, ruins, mechanical details, desaturated colors, cinematic lighting, gritty`
4. 复古漫画风 - `Retro comic book style, vintage colors, halftone pattern, ben-day dots`
5. 悬疑暗黑 - `Dark fantasy, Noir style, Horror anime, low key lighting, shadows, mysterious, eerie, cold tones, dramatic contrast`

### 3D与渲染风格 (3d)
1. 虚幻引擎渲染 - `Unreal Engine 5 render, 3D render, octane render, ray tracing, 8k`
2. 欧美动漫 - `Disney style, Pixar style, Western animation, 3D render, expressive face, exaggerated expressions, glossy, subsurface scattering`
3. 盲盒/粘土风 - `Blind box style, chibi, clay render, 3D cute, soft focus`
4. 2.5D 风格 - `2.5D style, isometric view, 3D background with anime character`

## API 设计

### 1. 获取风格预设列表
- **端点**: `GET /api/style-presets?projectId={projectId}`
- **权限**: 项目成员可访问
- **响应**:
```json
{
  "presets": [
    {
      "id": "uuid",
      "name": "二次元赛璐璐",
      "keywords": "Anime style, cel shading...",
      "category": "popular",
      "icon": "✨",
      "description": "线条清晰，色彩明快...",
      "isDefault": true,
      "order": 1
    }
  ]
}
```

### 2. 创建自定义预设
- **端点**: `POST /api/projects/{projectId}/style-presets`
- **权限**: 项目所有者
- **请求体**:
```json
{
  "name": "我的自定义风格",
  "keywords": "custom style keywords",
  "category": "popular",
  "icon": "🎨",
  "description": "自定义风格描述"
}
```

### 3. 更新自定义预设
- **端点**: `PATCH /api/projects/{projectId}/style-presets/{presetId}`
- **权限**: 项目所有者
- **限制**: 仅允许更新项目级预设（projectId不为null）
- **请求体**: 部分字段更新

### 4. 删除自定义预设
- **端点**: `DELETE /api/projects/{projectId}/style-presets/{presetId}`
- **权限**: 项目所有者
- **限制**: 仅允许删除项目级预设

## 前端修改

### project-settings.tsx 修改
1. 从 API 加载预设列表（替换硬编码 STYLE_PRESETS）
2. 添加"新建自定义风格"按钮和对话框
3. 预设卡片添加编辑/删除按钮（仅项目级预设显示）
4. 加载状态处理

### 新增组件
- `style-preset-dialog.tsx`: 新建/编辑预设对话框
- 使用 shadcn/ui 的 Dialog, Form 组件

## 实现步骤

1. 修改 `prisma/schema.prisma`，添加 StylePreset 模型
2. 创建数据库迁移
3. 创建迁移脚本，插入系统预设数据
4. 创建 API 端点：
   - `src/app/api/style-presets/route.ts`
   - `src/app/api/projects/[id]/style-presets/route.ts`
   - `src/app/api/projects/[id]/style-presets/[presetId]/route.ts`
5. 修改 `project-settings.tsx`，从 API 加载数据
6. 新建 `style-preset-dialog.tsx` 组件

## 错误处理

- 系统预设不可编辑/删除：返回 403 Forbidden
- 项目级预设仅项目所有者可操作：返回 403 Forbidden
- 创建预设时 category 必须是有效值：返回 400 Bad Request

## 测试要点

- [ ] 系统预设正确加载并显示
- [ ] 系统预设不可编辑删除
- [ ] 项目自定义预设可以创建、编辑、删除
- [ ] 预设按类别正确分组
- [ ] 类别内按 order 字段正确排序
- [ ] 选择预设后正确更新项目 style 字段