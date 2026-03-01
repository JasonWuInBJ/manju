# 全局风格预设应用设计文档

## 概述
将项目风格预设自动应用到所有生图模块的Prompt生成中，实现统一的视觉风格管理。

## 目标
- 所有生图模块自动使用项目级风格预设
- 移除角色独立的style字段，统一管理
- 在Prompt生成层融入风格关键词

## 当前实现分析

### 存在的问题
1. **风格管理分散**：角色有独立的style字段（硬编码4个选项），场景/道具没有style
2. **硬编码风格**：合成图使用硬编码的 `'cel-shaded anime style'`
3. **不统一的风格来源**：各模块使用不同的风格来源，无法保持全局一致

### 生图相关API端点
1. `POST /api/projects/[id]/characters/[characterId]/prompt` - 角色prompt生成
2. `POST /api/projects/[id]/scenes/[sceneId]/prompt` - 场景prompt生成
3. `POST /api/projects/[id]/props/[propId]/prompt` - 道具prompt生成
4. `POST /api/projects/[id]/video/[videoId]/compose-image` - 合成图生成

## 设计方案

### 核心策略
1. **统一使用项目风格** - 所有prompt生成都从项目的 `style` 字段获取风格关键词
2. **移除角色独立style** - 删除Character模型的style字段
3. **自动拼接风格** - 在生成prompt时，自动将项目风格关键词融入prompt

### 数据库Schema修改

删除Character模型的style字段：

```prisma
model Character {
  id               String  @id @default(uuid())
  projectId        String
  project          Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name             String
  role             String
  description      String
  // style            String  @default("cel-shaded")  <- 删除此字段
  prompt           String?
  imageUrl         String?
  // ... 其他字段保持不变
}
```

### API修改细节

#### 1. 角色Prompt生成API

**文件**: `src/app/api/projects/[id]/characters/[characterId]/prompt/route.ts`

**修改内容**:
- 删除硬编码的 `STYLE_PROMPTS` 常量
- 通过 `include` 关联查询获取项目信息
- 使用 `character.project.style` 替代 `character.style`
- 如果项目style为空，使用默认值 `'Anime style, cel shading'`

**示例代码**:
```typescript
const character = await prisma.character.findUnique({
  where: { id: characterId },
  include: { project: true }
})

const projectStyle = character.project.style || 'Anime style, cel shading'

const finalUserPrompt = userPrompt ||
  `角色名：${character.name}\n角色类型：${character.role}\n描述：${character.description}\n风格：${projectStyle}`
```

#### 2. 场景Prompt生成API

**文件**: `src/app/api/projects/[id]/scenes/[sceneId]/prompt/route.ts`

**修改内容**:
- 通过 `include` 关联查询获取项目信息
- 在生成的prompt末尾拼接项目风格关键词
- 格式：`${parsed.prompt}, ${projectStyle}`

**示例代码**:
```typescript
const scene = await prisma.scene.findUnique({
  where: { id: sceneId },
  include: { project: true }
})

const projectStyle = scene.project.style || 'Anime style'

// 在最终prompt中拼接风格
const finalPrompt = `${parsed.prompt}, ${projectStyle}`
```

#### 3. 道具Prompt生成API

**文件**: `src/app/api/projects/[id]/props/[propId]/prompt/route.ts`

**修改内容**:
- 通过 `include` 关联查询获取项目信息
- 在用户prompt中添加项目风格信息
- 确保生成的道具与项目整体风格一致

**示例代码**:
```typescript
const prop = await prisma.prop.findUnique({
  where: { id: propId },
  include: { project: true }
})

const projectStyle = prop.project.style || 'Anime style'

const finalUserPrompt = userPrompt ||
  `道具名：${prop.name}\n描述：${prop.description || '无'}\n项目风格：${projectStyle}`
```

#### 4. 合成图生成API

**文件**: `src/app/api/projects/[id]/video/[videoId]/compose-image/route.ts`

**修改内容**:
- 查询项目信息获取style字段
- 替换硬编码的 `'cel-shaded anime style'`
- 传递给 `generateCompositeImagePrompt` 函数

**示例代码**:
```typescript
const project = await prisma.project.findUnique({
  where: { id }
})

const projectStyle = project?.style || 'cel-shaded anime style'

prompt = generateCompositeImagePrompt({
  characters,
  scenes,
  props,
  script: video?.script || undefined,
  style: projectStyle,
})
```

### 向后兼容性

- 如果项目 `style` 字段为空或null，使用默认值 `'Anime style, cel shading'`
- 旧的角色数据中的style字段在迁移后会被删除，不再使用
- 所有生图模块统一回退到项目style，保证一致性

## 实现步骤

1. **修改数据库Schema**
   - 编辑 `prisma/schema.prisma`，删除Character.style字段
   - 运行 `npx prisma migrate dev --name remove_character_style`
   - 生成新的Prisma Client

2. **修改角色Prompt API**
   - 文件：`src/app/api/projects/[id]/characters/[characterId]/prompt/route.ts`
   - 删除STYLE_PROMPTS常量
   - 添加项目关联查询
   - 使用project.style

3. **修改场景Prompt API**
   - 文件：`src/app/api/projects/[id]/scenes/[sceneId]/prompt/route.ts`
   - 添加项目关联查询
   - 在prompt末尾拼接project.style

4. **修改道具Prompt API**
   - 文件：`src/app/api/projects/[id]/props/[propId]/prompt/route.ts`
   - 添加项目关联查询
   - 在userPrompt中包含project.style

5. **修改合成图API**
   - 文件：`src/app/api/projects/[id]/video/[videoId]/compose-image/route.ts`
   - 查询项目style
   - 替换硬编码风格

6. **测试验证**
   - 测试角色prompt生成是否包含项目风格
   - 测试场景prompt生成是否包含项目风格
   - 测试道具prompt生成是否包含项目风格
   - 测试合成图生成是否使用项目风格
   - 测试项目style为空时的默认值处理

## 影响范围

### 前端组件（无需修改）
- `character-designer.tsx` - 不再需要选择style，统一使用项目style
- `scene-designer.tsx` - 自动应用项目style
- `prop-designer.tsx` - 自动应用项目style
- `video-editor.tsx` - 合成图自动使用项目style

### Prompt生成库（无需修改）
- `lib/composite-image-prompt-generator.ts` - 已支持style参数
- `lib/storyboard-prompt-generator.ts` - 已支持style参数
- `lib/video-prompt-generator.ts` - 需检查是否需要添加style参数

## 预期效果

1. **风格统一**：所有生图模块自动使用项目风格，无需用户每次选择
2. **简化操作**：用户只需在项目设置中选择一次风格，全局生效
3. **易于维护**：风格预设集中在项目级别，修改后所有模块自动更新
4. **一致性保证**：角色、场景、道具、合成图的风格始终一致

## 测试要点

- [ ] 项目style字段正确传递到角色prompt生成
- [ ] 项目style字段正确传递到场景prompt生成
- [ ] 项目style字段正确传递到道具prompt生成
- [ ] 项目style字段正确传递到合成图生成
- [ ] 项目style为空时使用默认值
- [ ] 数据库迁移成功执行
- [ ] 旧角色数据的style字段已删除
- [ ] 生成的图片风格与项目预设一致