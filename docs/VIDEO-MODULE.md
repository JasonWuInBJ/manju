# 视频合成模块文档

## 1. 模块概述

将角色立绘、场景图片和分镜脚本合成为动态短视频。

### 1.1 核心功能
- 图片转视频（Image-to-Video）
- 镜头运动模拟（推/拉/摇/移）
- 角色动作生成
- 口型同步（Lip Sync）
- 转场效果
- 配音配乐合成

### 1.2 输出规格
| 参数 | 规格 |
|------|------|
| 分辨率 | 1080x1920 (9:16) / 1920x1080 (16:9) / 1080x1080 (1:1) |
| 帧率 | 24fps / 30fps |
| 格式 | MP4 (H.264) |
| 单镜头时长 | 2-5 秒 |

---

## 2. System Prompt 设计

### 2.1 视频生成指令 Prompt
```
你是一位专业的动态视频导演，擅长将静态漫画图片转化为流畅的动态视频。

任务目标：
根据分镜脚本，为每个镜头生成视频生成指令。

输出要求：
1. 镜头运动：描述摄像机的运动方式
2. 角色动作：描述角色的动态表现
3. 特效指令：描述需要添加的视觉特效
4. 时长建议：建议该镜头的持续时间
```

### 2.2 镜头运动类型
| 运动类型 | 英文指令 | 效果描述 |
|----------|----------|----------|
| 推镜 | zoom in / push in | 镜头向主体靠近，强调细节 |
| 拉镜 | zoom out / pull out | 镜头远离主体，展示全貌 |
| 左摇 | pan left | 镜头水平向左移动 |
| 右摇 | pan right | 镜头水平向右移动 |
| 上摇 | tilt up | 镜头垂直向上移动 |
| 下摇 | tilt down | 镜头垂直向下移动 |
| 跟镜 | tracking shot | 跟随角色移动 |
| 定镜 | static | 镜头静止，画面内有动态 |

### 2.3 角色动作指令
```
## 基础动作
- 呼吸：chest breathing, subtle body movement
- 眨眼：eye blinking, natural blink
- 说话：talking, mouth moving, lip sync
- 转头：head turn left/right

## 情绪动作
- 惊讶：surprised expression, eyes widen
- 愤怒：angry expression, furrowed brows
- 悲伤：sad expression, tears forming
- 微笑：smiling, gentle smile
```

---

## 3. 视频生成 Prompt 模板

### 3.1 Runway Gen-3 格式
```
[场景描述], [角色动作], [镜头运动], 
anime style, cel shading, cinematic lighting,
smooth motion, high quality, 24fps
```

### 3.2 示例输出

**输入（分镜脚本）**：
```
镜头语言：中景，缓慢推镜
场景：昏暗的出租屋，电脑屏幕冷光
角色：苏烬坐在电脑前，表情疲惫
```

**生成的视频 Prompt**：
```
A young man sitting at a computer desk in a dim room,
tired expression, cigarette smoke rising,
slow zoom in towards face,
cold blue light from monitor illuminating face,
anime style, cel shading, moody atmosphere,
subtle breathing motion, smoke particles floating,
cinematic, 4 seconds, 24fps
```

### 3.3 转场效果
| 转场类型 | 适用场景 | 指令 |
|----------|----------|------|
| 淡入淡出 | 时间流逝、场景切换 | fade in/out |
| 闪白 | 回忆、穿越、爆发 | flash white |
| 闪黑 | 昏迷、结束、紧张 | flash black |
| 划变 | 平行叙事 | wipe left/right |
| 溶解 | 梦境、回忆 | dissolve |

---

## 4. 输出示例

### 4.1 完整镜头生成方案

**镜头一**
```json
{
  "shotId": 1,
  "duration": 4,
  "videoPrompt": "A young man sitting at computer, dim room, cigarette smoke, slow zoom in, anime style, cel shading",
  "cameraMotion": "zoom_in",
  "characterAction": "breathing, smoking",
  "transition": "none",
  "audio": {
    "sfx": "keyboard_typing",
    "dialogue": null,
    "bgm": "tense_ambient"
  }
}
```

**镜头二**
```json
{
  "shotId": 2,
  "duration": 3,
  "videoPrompt": "Close-up of ashtray, hand flicking cigarette ash, smoke rising, static shot, anime style",
  "cameraMotion": "static",
  "characterAction": "hand_movement",
  "transition": "none",
  "audio": {
    "sfx": "ash_falling",
    "dialogue": null,
    "bgm": "tense_ambient"
  }
}
```

---

## 5. 界面设计

### 5.1 视频合成台布局
```
┌─────────────────────────────────────────────────────┐
│  [项目名称]                    [保存] [导出] [设置] │
├──────────────────────┬──────────────────────────────┤
│   时间轴编辑器       │      视频预览区              │
│   ┌─────────────────┐│   ┌────────────────────┐    │
│   │ 镜头1 │ 镜头2 │ ││   │                    │    │
│   │ 4s    │ 3s    │ ││   │   [播放预览]       │    │
│   └─────────────────┘│   │                    │    │
│                      │   └────────────────────┘    │
│   音频轨道           │                              │
│   ┌─────────────────┐│   比例：[9:16 ▼]           │
│   │ 🔊 对白         ││   分辨率：1080x1920         │
│   │ 🎵 BGM          ││                              │
│   └─────────────────┘│   [生成视频]  [导出]        │
└──────────────────────┴──────────────────────────────┘
```

### 5.2 镜头编辑面板
```
┌─────────────────────────────────────────────────────┐
│  镜头 1 编辑                              [删除]    │
├─────────────────────────────────────────────────────┤
│  素材：                                             │
│  ┌────────┐ ┌────────┐                             │
│  │ 场景图 │ │ 角色图 │  [更换素材]                 │
│  └────────┘ └────────┘                             │
├─────────────────────────────────────────────────────┤
│  镜头运动：[推镜 ▼]     时长：[4] 秒               │
│  角色动作：[呼吸 ▼] [说话 ▼]                       │
│  转场效果：[无 ▼]                                  │
├─────────────────────────────────────────────────────┤
│  视频 Prompt（可编辑）：                            │
│  ┌─────────────────────────────────────────────┐   │
│  │ A young man sitting at computer...          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [重新生成 Prompt]  [预览此镜头]                   │
└─────────────────────────────────────────────────────┘
```

### 5.3 音频设置面板
```
┌─────────────────────────────────────────────────────┐
│  音频设置                                           │
├─────────────────────────────────────────────────────┤
│  配音（TTS）：                                      │
│  角色：[苏烬 ▼]  音色：[成熟男声 ▼]               │
│  对白："老李？公司没我跑不动了？"                  │
│  情绪：[嘲讽 ▼]   语速：[正常 ▼]                  │
│  [试听]  [重新生成]                                │
├─────────────────────────────────────────────────────┤
│  背景音乐：                                         │
│  风格：[紧张氛围 ▼]   音量：[━━━━━○━━] 60%        │
│  [选择音乐库]  [上传自定义]                        │
├─────────────────────────────────────────────────────┤
│  音效：                                             │
│  [+添加音效]  键盘声 ✕  手机震动 ✕                │
└─────────────────────────────────────────────────────┘
```

### 5.4 用户交互操作

**时间轴操作**：
| 操作 | 说明 |
|------|------|
| 拖拽镜头 | 调整镜头顺序 |
| 拖拽边缘 | 调整镜头时长 |
| 双击镜头 | 打开编辑面板 |
| 右键菜单 | 复制/删除/插入 |

**预览操作**：
| 操作 | 说明 |
|------|------|
| 空格键 | 播放/暂停 |
| 单镜头预览 | 仅预览当前镜头 |
| 全片预览 | 预览完整视频 |
| 导出草稿 | 低分辨率快速导出 |

---

## 6. API 接口设计

### 6.1 生成视频 Prompt（LLM）
```
POST /api/video/generate-prompt

Request:
{
  "shotId": 1,
  "scene": "昏暗的出租屋，电脑屏幕冷光",
  "character": "苏烬坐在电脑前，表情疲惫",
  "camera": { "type": "medium", "movement": "push" },
  "mood": "压抑"
}

Response:
{
  "videoPrompt": "A young man sitting at computer...",
  "duration": 4,
  "cameraMotion": "zoom_in",
  "characterAction": ["breathing", "smoking"]
}
```

### 6.2 生成单镜头视频（视频模型）
```
POST /api/video/generate-shot

Request:
{
  "shotId": 1,
  "prompt": "A young man sitting at computer...",
  "duration": 4,
  "aspectRatio": "9:16",
  "model": "runway"  // runway | pika | kling
}

Response:
{
  "taskId": "task_xxx",
  "status": "processing",
  "estimatedTime": 60
}
```

### 6.3 查询生成状态
```
GET /api/video/status/:taskId

Response:
{
  "taskId": "task_xxx",
  "status": "completed",  // pending | processing | completed | failed
  "progress": 100,
  "videoUrl": "https://...",
  "thumbnailUrl": "https://..."
}
```

### 6.4 生成配音（TTS）
```
POST /api/video/tts

Request:
{
  "text": "老李？公司没我跑不动了？",
  "voice": "mature_male",
  "emotion": "sarcastic",
  "speed": 1.0
}

Response:
{
  "audioUrl": "https://...",
  "duration": 2.5
}
```

### 6.5 合成完整视频
```
POST /api/video/compose

Request:
{
  "projectId": "xxx",
  "shots": ["shot_1", "shot_2", "shot_3"],
  "audio": {
    "dialogues": [...],
    "bgmId": "tense_001",
    "bgmVolume": 0.6
  },
  "output": {
    "aspectRatio": "9:16",
    "resolution": "1080x1920",
    "fps": 24
  }
}

Response:
{
  "taskId": "compose_xxx",
  "status": "processing"
}
```

### 6.6 口型同步（Lip Sync）
```
POST /api/video/lipsync

Request:
{
  "videoUrl": "https://...",
  "audioUrl": "https://...",
  "characterFace": "front"
}

Response:
{
  "taskId": "lipsync_xxx",
  "status": "processing"
}
```

### 6.7 导出视频
```
POST /api/video/export

Request:
{
  "projectId": "xxx",
  "format": "mp4",
  "quality": "high"  // draft | medium | high
}

Response:
{
  "downloadUrl": "https://...",
  "fileSize": "45MB",
  "expiresAt": "2026-01-28T00:00:00Z"
}
```

---

## 7. 数据结构

### 7.1 视频项目
```typescript
interface VideoProject {
  id: string;
  episodeId: string;
  shots: VideoShot[];
  audio: AudioConfig;
  output: OutputConfig;
  status: 'draft' | 'processing' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}
```

### 7.2 视频镜头
```typescript
interface VideoShot {
  id: string;
  order: number;
  duration: number;
  prompt: string;
  cameraMotion: CameraMotion;
  characterActions: string[];
  transition: TransitionType;
  videoUrl?: string;
  thumbnailUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

type CameraMotion = 'static' | 'zoom_in' | 'zoom_out' | 
  'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'tracking';

type TransitionType = 'none' | 'fade' | 'flash_white' | 
  'flash_black' | 'wipe' | 'dissolve';
```

### 7.3 音频配置
```typescript
interface AudioConfig {
  dialogues: Dialogue[];
  bgm?: {
    id: string;
    name: string;
    url: string;
    volume: number;
  };
  sfx: SoundEffect[];
}

interface Dialogue {
  shotId: string;
  character: string;
  text: string;
  voice: string;
  emotion: string;
  audioUrl?: string;
  startTime: number;
  duration: number;
}

interface SoundEffect {
  name: string;
  url: string;
  startTime: number;
  duration: number;
  volume: number;
}
```

### 7.4 输出配置
```typescript
interface OutputConfig {
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: string;
  fps: 24 | 30;
  format: 'mp4';
  quality: 'draft' | 'medium' | 'high';
}
```

---

## 8. 技术实现

### 8.1 视频生成流程
```
1. 加载分镜脚本和素材
       ↓
2. [LLM] 为每个镜头生成视频 Prompt
       ↓
3. [视频模型] 逐镜头生成视频片段
       ↓
4. [TTS] 生成角色配音
       ↓
5. [Lip Sync] 口型同步（可选）
       ↓
6. [合成] 拼接视频 + 音频 + 转场
       ↓
7. 导出最终视频
```

### 8.2 第三方服务集成

| 功能 | 推荐服务 | 备选方案 |
|------|----------|----------|
| 图生视频 | Runway Gen-3 | Pika Labs, Kling |
| 语音合成 | Azure TTS | 讯飞 TTS, ElevenLabs |
| 口型同步 | Wav2Lip | SadTalker |
| 视频合成 | FFmpeg | MoviePy |

### 8.3 性能优化
- **并行生成**：多镜头同时生成，提升效率
- **缓存复用**：相同素材的视频片段可复用
- **渐进式预览**：低分辨率快速预览，确认后高清导出
- **断点续传**：支持生成中断后继续

---

## 9. 与其他模块的关联

### 9.1 输入来源
| 来源模块 | 数据 |
|----------|------|
| 分镜设计模块 | 镜头脚本、运镜指示 |
| 角色设计模块 | 角色立绘、表情包 |
| 场景设计模块 | 场景四视图 |

### 9.2 输出去向
- 最终视频文件（MP4）
- 支持直接分享到抖音、B站、小红书

---

## 10. 成本估算

| 操作 | 单次成本（约） |
|------|---------------|
| 单镜头视频生成（4秒） | ¥2-5 |
| TTS 配音（10秒） | ¥0.1-0.5 |
| 口型同步（10秒） | ¥1-2 |
| 视频合成 | 免费（本地处理） |

**单集视频（2分钟，50镜头）预估成本**：¥100-250

---

*文档版本：v1.0*
*更新日期：2026-01-27*
