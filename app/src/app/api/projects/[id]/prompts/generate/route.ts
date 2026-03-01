import { NextResponse } from 'next/server'
import { MODEL, retryWithBackoff, callLLM } from '@/lib/ai'

interface Props {
  params: Promise<{ id: string }>
}

// 各类型的元提示词 - 指导 AI 如何生成高质量的 Prompt
const META_PROMPTS: Record<string, string> = {
  script: `你是一位专业的 Prompt 工程师，专门设计用于 AI 剧本生成的提示词。

用户会描述他们想要的剧本风格或特点，你需要生成两部分内容：

1. System Prompt：定义 AI 编剧的角色、能力和输出格式要求
2. User Prompt 模板：包含占位符的用户输入模板

占位符说明（必须包含）：
- {novelText}: 原始小说文本
- {synopsis}: 剧集简介（可选）

输出格式（JSON）：
{
  "systemPrompt": "系统提示词内容...",
  "userPrompt": "用户提示词模板，包含 {novelText} 和 {synopsis} 占位符..."
}

只输出 JSON，不要其他内容。`,

  character: `你是一位专业的 Prompt 工程师，专门设计用于 AI 角色图像生成的提示词。

用户会描述他们想要的角色设计风格，你需要生成两部分内容：

1. System Prompt：定义 AI 的角色（如概念艺术家）、输出要求（英文、适合 Midjourney/SD）
2. User Prompt 模板：包含占位符的用户输入模板

占位符说明（必须包含）：
- {name}: 角色名称
- {role}: 角色类型（主角/配角/反派等）
- {description}: 角色描述
- {style}: 艺术风格

输出格式（JSON）：
{
  "systemPrompt": "系统提示词内容...",
  "userPrompt": "用户提示词模板，包含 {name}、{role}、{description}、{style} 占位符..."
}

只输出 JSON，不要其他内容。`,

  scene: `你是一位专业的 Prompt 工程师，专门设计用于 AI 场景图像生成的提示词。

用户会描述他们想要的场景设计风格，你需要生成两部分内容：

1. System Prompt：定义 AI 的角色（如美术总监）、输出要求（英文、适合 Midjourney/SD、不含人物）
2. User Prompt 模板：包含占位符的用户输入模板

占位符说明（必须包含）：
- {name}: 场景名称
- {description}: 场景描述
- {time}: 时间（如 dawn/day/dusk/night）
- {mood}: 氛围（如 warm/tense/mysterious/neutral）

输出格式（JSON）：
{
  "systemPrompt": "系统提示词内容...",
  "userPrompt": "用户提示词模板，包含 {name}、{description}、{time}、{mood} 占位符..."
}

只输出 JSON，不要其他内容。`,

  scene_extract: `你是一位专业的 Prompt 工程师，专门设计用于 AI 场景提取和绘图提示词生成的提示词。

用户会描述他们想要的场景提取风格或侧重点，你需要生成两部分内容：

1. System Prompt：定义 AI 影视概念设计师的角色，说明如何从剧本中识别和提取场景，并为每个场景生成英文绘图 prompt 和 negative_prompt，以及输出格式要求（JSON）
2. User Prompt 模板：包含占位符的用户输入模板

占位符说明（必须包含）：
- {script}: 剧本内容

输出的场景 JSON 格式应包含：scene_id, scene_name, description, time (Day/Night/Dawn/Dusk), weather (Clear/Cloudy/Rain/Heavy Rain/Snow/Fog/Storm), mood (warm/tense/mysterious/neutral), prompt (英文绘图提示词，必须包含 no humans), negative_prompt

输出格式（JSON）：
{
  "systemPrompt": "系统提示词内容...",
  "userPrompt": "用户提示词模板，包含 {script} 占位符..."
}

只输出 JSON，不要其他内容。`,

  storyboard: `你是一位专业的 Prompt 工程师，专门设计用于 AI 分镜脚本生成的提示词。

用户会描述他们想要的分镜风格，你需要生成两部分内容：

1. System Prompt：定义 AI 分镜师的角色、输出格式（JSON，包含镜头信息）
2. User Prompt 模板：包含占位符的用户输入模板

占位符说明（必须包含）：
- {script}: 剧本内容

分镜输出格式应包含：order, camera, scene, character, lighting, audio 字段

输出格式（JSON）：
{
  "systemPrompt": "系统提示词内容...",
  "userPrompt": "用户提示词模板，包含 {script} 占位符..."
}

只输出 JSON，不要其他内容。`,

  video: `You are a professional video prompt engineer specializing in AI video generation.

Generate a prompt configuration for video generation with the following requirements:

1. System Prompt: Instructions for generating cinematic video prompts from script content
2. User Prompt Template: A template with these placeholders:
   - {script}: The script content
   - {characters}: Character names and descriptions
   - {scenes}: Scene descriptions
   - {duration}: Video duration in seconds
   - {aspectRatio}: Video aspect ratio

The prompts should focus on:
- Camera movements and cinematography
- Scene transitions and pacing
- Visual storytelling elements
- Mood and atmosphere
- Character actions and interactions

Output in English, optimized for AI video generation models.

Output format (JSON):
{
  "systemPrompt": "System prompt content...",
  "userPrompt": "User prompt template with {script}, {characters}, {scenes}, {duration}, {aspectRatio} placeholders..."
}

Only output JSON, nothing else.`,

  image: `你是一位专业的 Prompt 工程师，专门设计用于 AI 关键帧图像生成的提示词。

用户会描述他们想要的关键帧风格或侧重点，你需要生成两部分内容：

1. System Prompt：定义 AI 电影美术指导的角色，说明如何将角色设定、场景环境与分镜指令融合，生成用于 AI 视频生成的关键帧提示词。需要包含构图逻辑、光影融合、动作可视化等约束。
2. User Prompt 模板：包含占位符的用户输入模板

占位符说明（必须包含）：
- {characters}: 角色信息（名称、外貌、服饰等）
- {scenes}: 场景信息（名称、描述、时间、氛围、天气等）
- {shots}: 分镜指令（镜头类型、运镜、动作等）

输出格式（JSON）：
{
  "systemPrompt": "系统提示词内容...",
  "userPrompt": "用户提示词模板，包含 {characters}、{scenes}、{shots} 占位符..."
}

只输出 JSON，不要其他内容。`,

  prop_extract: `你是一位专业的 Prompt 工程师，专门设计用于 AI 道具提取和绘图提示词生成的提示词。

用户会描述他们想要的道具提取风格或侧重点，你需要生成两部分内容：

1. System Prompt：定义 AI 影视道具设计师的角色，说明如何从剧本中识别和提取关键道具（武器、交通工具、重要物件、标志性器物等），排除人物、场景、抽象概念和普通家具，并为每个道具生成中文描述和英文绘图 prompt，以及输出格式要求（JSON）
2. User Prompt 模板：包含占位符的用户输入模板

占位符说明（必须包含）：
- {script}: 剧本内容

输出的道具 JSON 格式应包含：name (道具中文名), description (道具中文描述，包括外观、材质、状态等), prompt (英文绘图提示词，结构：[Object] + [Material & Texture] + [Condition & Details] + [Style & Quality])

输出格式（JSON）：
{
  "systemPrompt": "系统提示词内容...",
  "userPrompt": "用户提示词模板，包含 {script} 占位符..."
}

只输出 JSON，不要其他内容。`,
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()
  const { type, description } = body

  if (!type || !description) {
    return NextResponse.json(
      { error: 'Missing type or description' },
      { status: 400 }
    )
  }

  const metaPrompt = META_PROMPTS[type]
  if (!metaPrompt) {
    return NextResponse.json(
      { error: 'Invalid type' },
      { status: 400 }
    )
  }

  try {
    const startTime = Date.now()
    const userPrompt = `请根据以下描述生成 Prompt 配置：\n\n${description}`
    console.log('[Prompts Generate] 开始调用AI模型', {
      projectId: id,
      type,
      model: MODEL,
      maxTokens: 4096,
      descriptionLength: description?.length || 0,
    })
    console.log('[Prompts Generate] System Prompt:', metaPrompt)
    console.log('[Prompts Generate] User Prompt:', userPrompt)

    const message = await retryWithBackoff(
      () => callLLM({
        model: MODEL,
        maxTokens: 4096,
        systemPrompt: metaPrompt,
        userPrompt: userPrompt,
      }),
      {
        maxRetries: 3,
        initialDelay: 2000,
        onRetry: (error, attempt) => {
          console.log(`[Prompts Generate] 重试第 ${attempt} 次`, {
            projectId: id,
            type,
            error: error.message,
          })
        },
      }
    )

    const duration = Date.now() - startTime

    // 提取 JSON - 支持多种格式
    let jsonText = ''

    // 1. 尝试提取 markdown 代码块中的 JSON
    const codeBlockMatch = message.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim()
    } else {
      // 2. 尝试使用非贪婪匹配提取 JSON 对象
      const jsonMatch = message.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        jsonText = jsonMatch[0]
      }
    }

    if (!jsonText) {
      console.error('[Prompts Generate] 无法解析AI响应', {
        projectId: id,
        type,
        responseText: message.substring(0, 500),
        fullResponse: message,
      })
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }

    let result
    try {
      result = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('[Prompts Generate] JSON解析失败', {
        projectId: id,
        type,
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
        extractedJson: jsonText.substring(0, 500),
        fullResponse: message,
      })
      return NextResponse.json(
        { error: 'Failed to parse JSON from AI response' },
        { status: 500 }
      )
    }

    console.log('[Prompts Generate] AI模型调用成功', {
      projectId: id,
      type,
      duration: `${duration}ms`,
      durationSeconds: `${(duration / 1000).toFixed(2)}s`,
      hasSystemPrompt: !!result.systemPrompt,
      hasUserPrompt: !!result.userPrompt,
      model: MODEL,
    })
    console.log('[Prompts Generate] AI返回的原始内容（前1000字符）:', message.substring(0, 1000))
    console.log('[Prompts Generate] AI返回的原始内容（后1000字符）:', message.substring(Math.max(0, message.length - 1000)))
    console.log('[Prompts Generate] 解析后的JSON:', JSON.stringify(result, null, 2))

    return NextResponse.json({
      systemPrompt: result.systemPrompt || '',
      userPrompt: result.userPrompt || '',
    })
  } catch (error) {
    console.error('[Prompts Generate] AI模型调用失败', {
      projectId: id,
      type,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Failed to generate prompt' },
      { status: 500 }
    )
  }
}
