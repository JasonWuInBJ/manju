# 道具描述管线修复 + 道具提取 Prompt 自定义

日期：2026-02-28

## 问题

道具描述在分镜生成阶段正确带上，但之后所有下游环节丢失。同时道具提取的 Prompt 不支持自定义。

## 修复范围

### Part 1：修复道具描述丢失（6 处 + 2 个模板）

| # | 文件 | 问题 | 修复 |
|---|------|------|------|
| 1 | `api/.../video/[videoId]/generate-prompt/route.ts` | Shot 没 select refPropIds，没查 props，没传给 generateVideoPrompt | 加 refPropIds select，查 props，传入 |
| 2 | `api/.../video/[videoId]/compose/route.ts` | 没查 props，没传给 generateStoryboardPrompt | 查 props，传入 |
| 3 | `api/.../video/[videoId]/compose-image/route.ts` | 没查 props，generateCompositeImagePrompt 不接受 props | 查 props，传入 |
| 4 | `api/.../videos/[videoId]/assets/route.ts` | handleCompositeImageGeneration 没查 props | 查 props，传入 |
| 5 | `api/.../storyboard/route.ts` PUT | ShotInput 缺 refPropIds，create 时丢弃 | 加字段，写入 |
| 6 | `lib/composite-image-prompt-generator.ts` | 接口不接受 props | 加 props 参数，拼入 prompt |
| 7 | `lib/default-image-prompts.ts` | 无 {props} 占位符 | 加 Props: {props} |
| 8 | `lib/default-video-prompts.ts` | 无 {props} 占位符 | 加 Props: {props} |

### Part 2：道具提取 Prompt 自定义（4 处）

| # | 文件 | 修改 |
|---|------|------|
| 1 | `components/prompt-config-panel.tsx` | type 联合加 prop_extract，TYPE_LABELS 加 `道具提取` |
| 2 | `components/prop-designer.tsx` | 配置 tab 拆为 道具提取 / 道具设计，提取时传自定义 prompt |
| 3 | `api/.../prompts/generate/route.ts` | META_PROMPTS 加 prop_extract 条目 |
| 4 | `prisma/schema.prisma` | 更新 type 字段注释 |

## 不需要改的

- `props/extract/route.ts` — 已支持 customSystemPrompt / customUserPrompt
- `storyboard/generate/route.ts` — 已正确传 props
- `video-prompt-generator.ts` — assembleShotPrompt 已正确处理 refPropIds
- `storyboard-prompt-generator.ts` — 已接受 props 参数
