# 场景设计模块文档

## 1. 模块概述

根据剧本中的场景描述，生成二次元赛璐璐风格的场景概念设计图（四视图）。

### 1.1 核心功能
- 从剧本/分镜自动提取场景信息
- 生成场景四视图概念设计
- 支持多种风格选择
- 用户可编辑 Prompt

### 1.2 四视图构成
| 视图 | 说明 |
|------|------|
| 全景/正面视角 | 展示环境整体氛围 |
| 俯视图 | 展示空间布局 |
| 窗户细节 | 窗户样式及窗外光影 |
| 门口细节 | 出入口样式 |

### 1.3 视觉风格
**默认：二次元赛璐璐风格**
- 明快色彩、清晰轮廓线、硬边阴影
- 类似新海诚或京阿尼背景美术风格

---

## 2. System Prompt 设计

```
# Role
你是一位拥有丰富经验的二次元游戏/动画美术总监，擅长"二次元赛璐璐（Anime Cel-Shaded）"风格的场景概念设计。

# Task
根据用户提供的【剧本/剧情描述】，提炼关键视觉信息，并编写适用于AI绘画工具的英文提示词（Prompt）。

# Style Guidelines
1. **艺术风格**：二次元赛璐璐风格，强调明快色彩、清晰轮廓线、硬边阴影。
2. **构图要求**：输出场景概念设计图，包含4个视图分割展示：
   - 全景/正面视角 (Main View)
   - 俯视图 (Top Down View)
   - 窗户细节 (Window Detail)
   - 门口细节 (Doorway Detail)
3. **否定要素**：画面中绝对不能出现任何人物。

# Workflow
1. 分析剧本，提取：地点、时间（日/夜）、天气、关键物体、氛围
2. 将信息转化为结构化英文提示词
```

---

## 3. Prompt 输出格式

```
**[Subject]**
(地点 + 关键家具/建筑特征)

**[Environment & Lighting]**
(时间 + 天气 + 光照方向 + 室内/室外氛围)

**[Style & Composition]**
Anime style, Cel shading, vibrant colors, clean lines, high definition.
Concept art sheet, reference sheet, 4 views, split screen, layout design.
View 1: Wide angle front view of [地点].
View 2: Orthographic top-down plan view.
View 3: Close-up of the window design.
View 4: Close-up of the door design.

**[Negative Prompts]**
--no humans, characters, people, text, watermark, blurry, realistic, 3d render
```

---

## 4. 输出示例

### 输入（剧本片段）
```
场景：苏烬的出租屋
时间：夜晚
描述：昏暗的出租屋，烟雾弥漫。电脑屏幕的冷光映在脸上，
桌面散乱，有烟灰缸、打火机和几张揉皱的纸。
```

### 生成的 Prompt
```
**Subject**
Small cramped rental apartment, messy desk with computer setup, 
ashtray with cigarette butts, crumpled papers, lighter, 
old curtains, single bed in corner.

**Environment & Lighting**
Night time, dim interior, cold blue light from computer monitor,
smoke haze in the air, oppressive and lonely atmosphere,
urban apartment setting.

**Style & Composition**
Anime style, Cel shading, moody colors, clean lines, 
Makoto Shinkai style background art, high definition, 8k.
Concept art sheet, reference sheet, 4 views, split screen.
View 1: Wide angle front view of the messy room.
View 2: Orthographic top-down floor plan view.
View 3: Close-up of window with city lights outside.
View 4: Close-up of the apartment door.

**Negative Prompts**
--no humans, characters, people, text, watermark, blurry, 
realistic, 3d render --ar 3:2 --niji 6
```

---

## 5. 界面设计

### 5.1 场景设计台布局
```
┌─────────────────────────────────────────────────────┐
│  [项目名称]                    [保存] [导出] [设置] │
├──────────────────────┬──────────────────────────────┤
│   场景列表           │      场景详情/预览           │
│                      │                              │
│   [+新建场景]        │   ┌────────────────────┐    │
│                      │   │  四视图预览        │    │
│   ┌─────────────┐   │   │ ┌────┬────┐       │    │
│   │ 出租屋 [夜] │   │   │ │全景│俯视│       │    │
│   └─────────────┘   │   │ ├────┼────┤       │    │
│   ┌─────────────┐   │   │ │窗户│门口│       │    │
│   │ 办公室 [日] │   │   │ └────┴────┘       │    │
│   └─────────────┘   │   └────────────────────┘    │
│                      │                              │
│                      │   [生成场景方案]             │
└──────────────────────┴──────────────────────────────┘
```

### 5.2 Prompt 编辑面板
```
┌─────────────────────────────────────────────────────┐
│  场景设计方案：出租屋                               │
├─────────────────────────────────────────────────────┤
│  Subject：                           [编辑] [复制] │
│  ┌─────────────────────────────────────────────┐   │
│  │ Small cramped rental apartment...           │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  Environment & Lighting：            [编辑] [复制] │
│  ┌─────────────────────────────────────────────┐   │
│  │ Night time, dim interior...                 │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  [重新生成方案]  [生成四视图]                      │
└─────────────────────────────────────────────────────┘
```

### 5.3 用户微调交互

**Prompt 编辑**：
- 直接修改各部分 Prompt 内容
- 支持中英文混合输入，系统自动翻译

**场景参数**：
| 参数 | 选项 |
|------|------|
| 时间 | 清晨/白天/黄昏/夜晚 |
| 天气 | 晴天/阴天/雨天/雪天 |
| 氛围 | 温馨/压抑/神秘/紧张 |
| 风格 | 新海诚/京阿尼/吉卜力 |

---

## 6. API 接口设计

### 6.1 生成场景设计方案（LLM）
```
POST /api/scene/design-plan

Request:
{
  "name": "出租屋",
  "description": "昏暗的出租屋，烟雾弥漫...",
  "time": "night",
  "mood": "oppressive"
}

Response:
{
  "subject": "Small cramped rental apartment...",
  "environment": "Night time, dim interior...",
  "style": "Anime style, Cel shading...",
  "negativePrompt": "--no humans..."
}
```

### 6.2 生成场景四视图（图像模型）
```
POST /api/scene/generate

Request:
{
  "sceneId": "xxx",
  "prompt": "完整的prompt",
  "tool": "midjourney"  // midjourney | stable-diffusion
}

Response:
{
  "imageUrl": "https://...",
  "views": {
    "main": "url",
    "topDown": "url", 
    "window": "url",
    "door": "url"
  }
}
```

---

## 7. AI 工具适配

| 工具 | 建议配置 |
|------|----------|
| Midjourney/Niji | `--niji 6 --ar 3:2` |
| Stable Diffusion | Counterfeit/MeinaMix + ControlNet |

---

*文档版本：v1.0*
*更新日期：2026-01-27*
