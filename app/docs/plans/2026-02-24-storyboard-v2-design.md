# 分镜系统 V2 设计 — 面向 AI 视频模型的工业化改造

## 背景

当前分镜（Shot）模型是传统格式，只有 `camera`、`scene`、`character`、`lighting`、`audio` 五个内容字段。直接对接文生视频模型（Seedance 2.0、Kling 3.0、Vidu 等）时存在以下痛点：

- 缺乏角色一致性锚点：模型不知道角色长什么样，每次生成都会变脸
- 提示词不够结构化：视频模型需要"主体+运动+环境+镜头"组合，简单描述不够精准
- 缺乏负面提示：AI 生成容易崩坏（多余手指、画面抖动），需要 Negative Prompt 约束
- 没有镜头运动指令：视频模型核心优势是运镜（推拉摇移），静态的"特写/中景"不够

## 设计决策

| 决策项 | 结论 |
|--------|------|
| 资产注入方式 | 系统从 DB 组装 Character/Scene 数据注入 prompt，AI 只生成 shots |
| visual_prompt 语言 | 固定英文，中文字段供用户阅读 |
| negative_prompt 策略 | 全局默认 + 镜头级可选覆盖，系统自动合并 |
| 时间轴 | AI 输出 duration，time_slot 由系统累加计算 |
| ref_character_ids | 可选数组，0/1/多个均可，系统自动注入角色描述 |
| 旧数据兼容 | 不兼容，直接替换，旧数据废弃 |

---

## 一、数据模型变更

### Shot 模型（替换现有）

```prisma
model Shot {
  id               String  @id @default(uuid())
  scriptId         String
  script           Script  @relation(fields: [scriptId], references: [id], onDelete: Cascade)
  order            Int
  duration         Int     // 秒数，AI生成
  cameraShotType   String  // wide/medium/close/extreme-close
  cameraMovement   String  // static/slow_push_in/slow_pull_out/pan_left/pan_right/tilt_up/tilt_down/dynamic_follow/slight_handheld_shake/orbit
  sceneSetting     String  // 中文场景描述，供用户阅读
  characterAction  String? // 中文角色动作描述，可选
  visualPrompt     String  // 英文结构化提示词，给视频模型用
  negativePrompt   String? // 镜头级负面提示词，可选
  refCharacterIds  String? // JSON数组，引用的角色ID，可选
  audio            String  // 中文，对白/音效
}
```

相比旧模型：
- `camera` → 拆分为 `cameraShotType` + `cameraMovement`
- `scene` → `sceneSetting`
- `character` → `characterAction`（改为可选）
- 新增 `duration`、`visualPrompt`、`negativePrompt`、`refCharacterIds`
- 删除 `lighting`（光影信息合并进 `visualPrompt`）

### Project 模型新增字段

```prisma
model Project {
  // ... 现有字段
  defaultNegativePrompt String? // 全局默认负面提示词
}
```

---

## 二、AI 生成流程

### 组装流程

1. 系统从 DB 查询 Project 下所有 Character 和 Scene
2. 组装 `global_assets` 注入 system prompt
3. AI 只负责生成 `shots` 数组
4. 用户仍可通过 PromptConfigPanel 自定义 system/user prompt

### System Prompt 结构

```
你是一个专业的AI视频分镜师。根据剧本内容生成分镜数据。

## 可用角色资产
- su_jin (苏烬): 25岁亚洲男性, 黑色短发, 消瘦, 眼神忧郁疲惫...
- lao_li (老李): 50岁肥胖中年男人, 秃顶...

## 可用场景资产
- scene_1 (出租屋): 昏暗的廉价出租屋...
- scene_2 (老李办公室): ...

## 输出要求
- visual_prompt 必须为英文，格式：主体 + 动作 + 环境 + 光影 + 镜头语言
- ref_character_ids 引用上方角色ID，系统会自动注入角色外貌描述
- camera_movement 使用标准值：static, slow_push_in, slow_pull_out, pan_left, pan_right, tilt_up, tilt_down, dynamic_follow, slight_handheld_shake, orbit
- duration 单位为秒，建议 3-6 秒/镜头
- negative_prompt 只在需要额外约束时填写，系统有全局默认值
- 输出纯 JSON，不要其他内容
```

### User Prompt

```
请将以下剧本转换为分镜：

{剧本内容}
```

### AI 输出格式

```json
{
  "shots": [
    {
      "order": 1,
      "duration": 4,
      "camera_shot_type": "extreme-close",
      "camera_movement": "static, slight_handheld_shake",
      "scene_setting": "昏暗的廉价出租屋, 夜晚, 杂乱的电脑桌",
      "character_action": "一只夹着烟的手入画...",
      "visual_prompt": "Close-up shot of a computer screen...",
      "negative_prompt": "distorted text, bad anatomy",
      "ref_character_ids": [],
      "audio": "音效：鼠标点击声"
    }
  ]
}
```

---

## 三、下游消费 — 视频模型 Prompt 组装

调用视频模型时，系统为每个 shot 组装最终 prompt：

### 角色描述注入

```typescript
let finalPrompt = ""
for (const id of shot.refCharacterIds) {
  const char = characters.find(c => c.id === id)
  finalPrompt += `[Character: ${char.name}] ${char.description}. `
}
finalPrompt += shot.visualPrompt
```

### 负面提示词合并

```typescript
const finalNegative = [
  project.defaultNegativePrompt,
  shot.negativePrompt
].filter(Boolean).join(", ")
```

### 传给视频模型 API

- `finalPrompt` → 正向提示词
- `finalNegative` → 负面提示词
- `shot.duration` → 时长控制

### 需要重写的文件

- `src/lib/video-prompt-generator.ts` — 适配新 Shot 字段
- `src/lib/storyboard-prompt-generator.ts` — 适配新 Shot 字段
- `src/lib/default-video-prompts.ts` — 更新模板

---

## 四、前端 UI 变更

### Shot 卡片布局

- 顶部：`order` + `duration`秒 + `cameraShotType` + `cameraMovement`
- 中间：`sceneSetting`、`characterAction`（中文，用户可读）
- 折叠区域：`visualPrompt`（英文）、`negativePrompt`
- 底部：`audio`、引用的角色标签（从 refCharacterIds 解析显示角色名）

### 编辑能力

- 所有字段可手动编辑
- `cameraShotType` 和 `cameraMovement` 用下拉选择
- 其余为文本输入/文本域

### 全局负面提示词

分镜编辑器顶部增加输入框，编辑 `project.defaultNegativePrompt`

### 下拉选项

cameraShotType：`wide`, `medium`, `close`, `extreme-close`

cameraMovement：`static`, `slow_push_in`, `slow_pull_out`, `pan_left`, `pan_right`, `tilt_up`, `tilt_down`, `dynamic_follow`, `slight_handheld_shake`, `orbit`

### time_slot 展示

前端根据 duration 累加计算并显示，不存 DB

---

## 五、涉及变更的文件清单

| 文件 | 变更类型 |
|------|----------|
| `prisma/schema.prisma` | 修改 Shot 模型，Project 加字段 |
| `src/components/storyboard-editor.tsx` | 重写，适配新字段和 UI |
| `src/app/api/projects/[id]/storyboard/generate/route.ts` | 重写 prompt 组装和解析逻辑 |
| `src/app/api/projects/[id]/storyboard/route.ts` | 适配新 Shot 字段的 CRUD |
| `src/lib/video-prompt-generator.ts` | 重写，适配新 Shot 结构 |
| `src/lib/storyboard-prompt-generator.ts` | 重写，适配新 Shot 结构 |
| `src/lib/default-video-prompts.ts` | 更新模板 |
| `src/app/api/projects/[id]/video/[videoId]/generate-prompt/route.ts` | 适配新 Shot 字段 |
