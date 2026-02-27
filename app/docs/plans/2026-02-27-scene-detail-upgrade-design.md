# 场景详情升级设计

## 背景

当前 Scene 模型字段过少（name、description、time、mood、weather、prompt），AI 提取的内容也过于简单。需要扩充为专业影视场景格式，对标分镜脚本标准。

---

## 一、数据模型变更

`Scene` 模型新增 7 个可选字段：

```prisma
model Scene {
  // ... 现有字段不变 ...

  // 新增详细场景信息
  location        String?  // 空间位置，如"EXT-第108层天桥-栏杆旁"
  region          String?  // 地域坐标，如"亚洲-中国-新九龙"
  environmentType String?  // 环境类型，如"城市/室内/自然"
  era             String?  // 年代坐标，如"未来-中国"
  season          String?  // 季节，如"夏季"
  sceneFunction   String?  // 场景功能，如"开场介绍;起(背景铺垫)"
  spaceLayout     String?  // 空间区域划分，如"天桥栏杆边缘-玻璃幕墙外侧"
}
```

`description` 字段保留，但 AI 提取时要求生成更详细的场景特征描述（100字以上）。

---

## 二、AI 提取 prompt 升级

`scenes/extract` 的 system prompt output schema 扩展：

```json
{
  "scenes": [
    {
      "scene_name": "场景中文名",
      "description": "详细场景特征描述，包含建筑结构、视觉细节、氛围光影，100字以上",
      "location": "空间位置，格式：INT/EXT-地点-具体位置",
      "region": "地域坐标，格式：洲-国-城市-区域",
      "environment_type": "环境类型：城市/室内/自然/太空/水下/其他",
      "era": "年代坐标，如：现代/未来/古代-中国",
      "season": "季节：春季/夏季/秋季/冬季",
      "scene_function": "场景功能：开场介绍/起/承/转/合/高潮/结尾",
      "space_layout": "空间区域划分，描述场景内的功能分区",
      "time": "Day/Night/Dawn/Dusk",
      "weather": "Clear/Cloudy/Rain/Heavy Rain/Snow/Fog/Storm",
      "mood": "warm/tense/mysterious/neutral",
      "prompt": "英文生图提示词",
      "negative_prompt": "..."
    }
  ]
}
```

---

## 三、前端场景编辑器改造

现有场景详情卡片结构不变，在"保存"按钮上方新增可折叠的"详细信息"区域，默认折叠：

```
[场景名] [删除]
─────────────────
描述（Textarea）
绘图 Prompt
负面 Prompt
图片预览 + 生成按钮

▶ 详细信息（默认折叠，点击展开）
  空间位置      [Input]
  地域坐标      [Input]
  环境类型      [Select: 城市/室内/自然/太空/水下/其他]
  年代坐标      [Input]
  季节          [Select: 春季/夏季/秋季/冬季]
  场景功能      [Input]
  空间区域划分  [Input]

[保存]
```

---

## 四、涉及变更的文件清单

| 文件 | 变更类型 |
|------|----------|
| `prisma/schema.prisma` | Scene 新增 7 个字段 |
| `prisma/migrations/` | 新增迁移 |
| `src/app/api/projects/[id]/scenes/extract/route.ts` | 升级 system prompt 和字段映射 |
| `src/app/api/projects/[id]/scenes/[sceneId]/route.ts` | PUT 接口新增 7 个字段 |
| `src/components/scene-designer.tsx` | 新增折叠详细信息区域 |
