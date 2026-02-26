# 道具资产 & 角色换装设计

## 背景

当前项目只有角色（Character）和场景（Scene）两类资产。需要新增：
1. **道具资产（Prop）** — 从剧本提取道具，用于分镜合成和视频提示词
2. **角色换装** — 同一角色支持多套装扮，每套装扮是独立的完整 Character 资产

---

## 一、数据模型变更

### 1.1 Character 模型新增字段

```prisma
model Character {
  // ... 现有字段不变 ...

  // 换装支持（平级关系）
  characterGroupId String?  // 同一角色不同版本共享此 ID（UUID，创建时生成）
  costumeName      String?  // 装扮名称，如"日常便服"；原版可为 null
}
```

- 同一角色的所有版本（原版 + 换装版）共享同一个 `characterGroupId`
- 每个版本都是完整的 Character 记录，有独立的 `prompt`、`imageUrl`、`soraCharacterId` 等
- 原版角色创建时生成 `characterGroupId`（等于自身 ID 或新 UUID），`costumeName` 为 null
- 换装版本创建时复用同一 `characterGroupId`，填写 `costumeName`

### 1.2 新增 Prop 模型

```prisma
model Prop {
  id          String   @id @default(uuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String           // 道具名称，如"破旧手机"
  description String           // 中文描述
  prompt      String?          // 英文生图提示词
  imageUrl    String?          // 道具参考图
  imageTaskId String?          // 生图任务 ID（用于恢复轮询）
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 1.3 Project 模型新增关联

```prisma
model Project {
  // ... 现有字段 ...
  props  Prop[]
}
```

### 1.4 Shot 模型新增字段

```prisma
model Shot {
  // ... 现有字段 ...
  refPropIds  String?  // JSON数组，引用的道具ID
}
```

---

## 二、AI 提取流程

### 2.1 道具提取

**端点：** `POST /api/projects/[id]/props/extract`

流程：
1. 查询项目下所有 Script 内容
2. 查询现有 Character 和 Scene 列表（注入 prompt，避免误识别）
3. 调用 AI 提取道具列表
4. 批量写入 DB

System prompt 结构：
```
你是一个专业的剧本分析师。从剧本中提取道具资产。

## 已有角色（不要重复提取）
- 苏烬、老李 ...

## 已有场景（不要重复提取）
- 出租屋、老李办公室 ...

## 道具定义
道具是剧情中出现的具体物品，如武器、交通工具、重要物件等。
不包括：人物、地点、抽象概念。

## 输出格式（纯 JSON）
{
  "props": [
    {
      "name": "破旧手机",
      "description": "屏幕碎裂的老款智能手机，贴满了便利贴",
      "prompt": "a cracked old smartphone covered with sticky notes, worn out, realistic"
    }
  ]
}
```

### 2.2 角色换装提取

**端点：** `POST /api/projects/[id]/characters/extract-costumes`

流程：
1. 查询项目下所有 Script 内容
2. 查询现有 Character 列表
3. AI 分析每个角色在剧本中的装扮变化
4. 为每套新装扮创建 Character 记录，复用父角色的 `characterGroupId`

System prompt 结构：
```
你是一个专业的剧本分析师。分析剧本中角色的服装/装扮变化。

## 现有角色
- 苏烬 (char_001): 25岁亚洲男性, 黑色短发...
- 老李 (char_002): 50岁肥胖中年男人...

## 任务
找出每个角色在不同场合/时间段的不同装扮。
只提取有明显视觉差异的装扮（换了衣服、变装、时间跨度大等）。

## 输出格式（纯 JSON）
{
  "costumes": [
    {
      "characterId": "char_001",
      "costumeName": "日常便服",
      "description": "宽松的灰色卫衣，黑色运动裤，拖鞋",
      "prompt": "wearing loose gray hoodie, black sweatpants, slippers, casual style"
    }
  ]
}
```

创建换装版本时：
- 复制父角色的 `name`、`role`、`description`、`style`
- `characterGroupId` 与父角色相同
- `costumeName` 填写装扮名称
- `prompt` 在父角色基础 prompt 上追加装扮描述

---

## 三、分镜生成时的资产注入

调用分镜生成 API 时，System prompt 中的角色列表展开所有版本：

```
## 可用角色资产
- char_001 (苏烬): 25岁亚洲男性, 黑色短发... [默认]
- char_003 (苏烬·日常便服): 25岁亚洲男性, 黑色短发... + 宽松灰色卫衣
- char_004 (苏烬·战斗装): 25岁亚洲男性, 黑色短发... + 黑色战术背心

## 可用道具资产
- prop_001 (破旧手机): 屏幕碎裂的老款智能手机...
- prop_002 (武士刀): 刀鞘破旧，刀身有缺口...
```

Shot 的 `refCharacterIds` 直接引用具体版本 ID（如 `char_003`），`refPropIds` 引用道具 ID。

视频 prompt 组装时，道具描述注入方式与角色相同：

```typescript
for (const id of shot.refPropIds) {
  const prop = props.find(p => p.id === id)
  finalPrompt += `[Prop: ${prop.name}] ${prop.description}. `
}
```

---

## 四、前端 UI

### 4.1 道具页面

新增 `/project/[id]/prop` 页面，结构与场景页面一致：
- 顶部：「从剧本提取道具」按钮
- 卡片列表：道具名、描述、生图按钮、图片预览
- 支持手动新增、编辑、删除

### 4.2 角色页面改造

- 角色列表按 `characterGroupId` 分组
- 每组展示为一个卡片组，组内横向排列各版本
- 每组右上角有「提取换装」按钮（针对该角色）
- 换装版本卡片显示 `costumeName` 标签

### 4.3 分镜编辑器

Shot 卡片底部新增道具标签区（类似现有角色标签），显示 `refPropIds` 对应的道具名。

---

## 五、涉及变更的文件清单

| 文件 | 变更类型 |
|------|----------|
| `prisma/schema.prisma` | Character 加 `characterGroupId`/`costumeName`，新增 Prop 模型，Shot 加 `refPropIds` |
| `prisma/migrations/` | 新增迁移 |
| `src/app/project/[id]/prop/page.tsx` | 新建道具页面 |
| `src/components/prop-designer.tsx` | 新建道具设计组件 |
| `src/app/api/projects/[id]/props/route.ts` | 道具 CRUD |
| `src/app/api/projects/[id]/props/extract/route.ts` | AI 提取道具 |
| `src/app/api/projects/[id]/characters/extract-costumes/route.ts` | AI 提取换装 |
| `src/components/character-designer.tsx` | 改造：按组展示，支持换装版本 |
| `src/components/storyboard-editor.tsx` | Shot 卡片加道具标签 |
| `src/lib/storyboard-prompt-generator.ts` | 注入道具资产到 system prompt |
| `src/lib/video-prompt-generator.ts` | 组装时注入道具描述 |
| `src/components/project-nav.tsx` | 新增「道具」导航项 |
