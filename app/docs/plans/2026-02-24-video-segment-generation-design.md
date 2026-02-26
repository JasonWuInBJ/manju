# 视频分段生成架构设计

## 背景

当前视频生成 API 限制只能生成 5/10/15 秒的短视频，需要重构 Pipeline 支持分段生成，用户下载后在剪辑软件中手动合并。

## 目标

1. 支持按分镜或自定义段落创建视频片段
2. 支持多次生成、保留历史版本
3. 新增 Episode 层级管理多个 Video 片段
4. 用户可手动排序或按时间戳排序片段

---

## 数据模型

### Episode（新增）

```
Episode
├── id, projectId
├── name（如"第一集片段合集"）
├── description
├── scriptIds（JSON 数组，多对多关联 Scripts）
└── createdAt, updatedAt
```

### Video（重构）

```
Video
├── id, projectId, episodeId
├── scriptId（可选，关联来源分镜）
├── name
├── order（手动排序）
├── startTime / endTime（时间戳排序，可选）
├── prompt（当前使用的 prompt）
├── selectedCharacterIds / selectedSceneIds / selectedShotIds
├── assets: VideoAsset[]
└── createdAt, updatedAt
```

### VideoAsset（新增）

```
VideoAsset
├── id, videoId
├── type（composite_image / video）
├── url
├── taskId（轮询任务 ID）
├── duration（5 / 10 / 15 秒）
├── aspectRatio（16:9 / 9:16 / 1:1）
├── prompt（生成时使用的 prompt）
├── version（版本号）
└── createdAt
```

---

## 数据库 Schema

```prisma
model Episode {
  id          String   @id @default(uuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String
  description String?
  scriptIds   String?  // JSON 数组: ["script-id-1", "script-id-2"]
  videos      Video[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Video {
  id                   String   @id @default(uuid())
  projectId            String
  project              Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  episodeId            String?
  episode              Episode? @relation(fields: [episodeId], references: [id], onDelete: SetNull)
  scriptId             String?
  script               Script?  @relation(fields: [scriptId], references: [id], onDelete: SetNull)
  name                 String?

  // 排序
  order                Int      @default(0)
  startTime            Float?   // 秒，可选
  endTime              Float?   // 秒，可选

  // 生成参数
  prompt               String?
  selectedCharacterIds String?  // JSON 数组
  selectedSceneIds     String?  // JSON 数组
  selectedShotIds      String?  // JSON 数组

  // 资产
  assets               VideoAsset[]

  // 兼容旧数据（后续版本清理）
  compositeImageUrl    String?
  compositeImageTaskId String?
  videoUrl             String?
  videoTaskId          String?
  videoPrompt          String?

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}

model VideoAsset {
  id           String   @id @default(uuid())
  videoId      String
  video        Video    @relation(fields: [videoId], references: [id], onDelete: Cascade)
  type         String   // "composite_image" | "video"
  url          String?
  taskId       String?  // 轮询任务 ID
  duration     Int?     // 5 | 10 | 15
  aspectRatio  String?  // "16:9" | "9:16" | "1:1"
  prompt       String?  // 生成时使用的 prompt
  version      Int      @default(1)
  createdAt    DateTime @default(now())
}
```

---

## API 路由

### Episode 相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/projects/[id]/episodes` | 创建 Episode |
| GET | `/api/projects/[id]/episodes` | 列出所有 Episode |
| GET | `/api/projects/[id]/episodes/[episodeId]` | 获取单个 Episode（含 Videos） |
| PATCH | `/api/projects/[id]/episodes/[episodeId]` | 更新 Episode |
| DELETE | `/api/projects/[id]/episodes/[episodeId]` | 删除 Episode |
| POST | `/api/projects/[id]/episodes/[episodeId]/reorder` | 调整 Video 顺序 |

### Video 相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/projects/[id]/videos` | 创建 Video（可指定 episodeId） |
| GET | `/api/projects/[id]/videos` | 列出所有 Video（支持 ?episodeId= 筛选） |
| DELETE | `/api/projects/[id]/videos/[videoId]` | 删除 Video |

### VideoAsset 相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/projects/[id]/videos/[videoId]/assets` | 生成资产 |
| GET | `/api/projects/[id]/videos/[videoId]/assets` | 列出该 Video 所有资产 |
| GET | `/api/projects/[id]/videos/[videoId]/assets/[assetId]` | 获取单个资产状态 |
| DELETE | `/api/projects/[id]/videos/[videoId]/assets/[assetId]` | 删除资产 |

**资产生成请求体**：
```json
{
  "type": "composite_image" | "video",
  "duration": 5 | 10 | 15,
  "aspectRatio": "16:9" | "9:16" | "1:1",
  "prompt": "可选，覆盖 Video.prompt"
}
```

---

## 前端组件

### EpisodeEditor（新增）

职责：管理 Episode 及其下的 Video 片段

- Episode 列表（切换、创建、删除）
- Video 片段列表（支持拖拽排序）
- 显示每个片段的状态、时长、预览
- 批量操作（批量生成、批量下载）

### VideoEditor（调整）

职责：单个 Video 片段的编辑

- 选择剧本/分镜
- 选择角色/场景
- 生成合成图
- 生成视频
- 预览资产历史（多个版本）

### 页面布局

```
/project/[id]/video
├── 左侧：EpisodeEditor（Episode 列表 + Video 片段列表）
├── 右侧：VideoEditor（编辑选中的 Video 片段）
└── 或：Tab 切换两个视图
```

---

## 生成流程

```
创建 Episode（可选）
    ↓
创建 Video 片段
    ├── 方式1：按分镜创建（选择 Shot → 自动创建 Video）
    └── 方式2：手动创建（填写名称、时间范围）
    ↓
编辑 Video 片段
    ├── 选择素材（角色/场景）
    ├── 生成合成图 → VideoAsset(type=composite_image)
    ├── 调整 Prompt
    └── 生成视频 → VideoAsset(type=video, duration=5/10/15)
    ↓
重复创建更多片段
    ↓
在 Episode 中排序、预览
    ↓
批量下载所有片段的视频资产
```

---

## 数据迁移

### 迁移步骤

1. 创建默认 Episode（名称："默认合集"）
2. 遍历所有 Video：
   - 更新 episodeId
   - 如果有 compositeImageUrl，创建 VideoAsset(type=composite_image)
   - 如果有 videoUrl，创建 VideoAsset(type=video, prompt=videoPrompt)
3. 验证迁移结果
4. 后续版本清理旧字段

### 兼容性处理

- 前端检查 `assets` 数组，无数据时降级读取旧字段
- API 返回数据同时包含新结构和旧字段

---

## 实施计划

1. **Phase 1**：数据库 Schema 更新
   - 新增 Episode 表
   - 新增 VideoAsset 表
   - 更新 Video 表字段

2. **Phase 2**：API 实现
   - Episode CRUD
   - Video CRUD（调整现有）
   - VideoAsset CRUD

3. **Phase 3**：前端组件
   - EpisodeEditor 组件
   - VideoEditor 组件调整
   - 页面布局调整

4. **Phase 4**：数据迁移
   - 迁移脚本
   - 兼容性处理
   - 测试验证

5. **Phase 5**：清理
   - 删除旧字段
   - 删除兼容代码
