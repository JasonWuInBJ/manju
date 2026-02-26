import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MODEL, retryWithBackoff, callLLM } from '@/lib/ai'

interface Props {
  params: Promise<{ id: string }>
}

const SYSTEM_PROMPT = `# Role
你是一位专业的影视概念设计师和AI绘图提示词专家。你擅长从剧本文字中提炼场景环境，并将其转化为用于生成高质量背景美术资产的英文提示词。

# Task
分析提供的【剧本内容】，提取出所有独立的"关键场景"，并为每个场景生成用于Stable Diffusion/Midjourney生成的英文提示词。

# Constraints & Logic
1. **去重与合并**：识别剧本中的地点名称，合并相同地点。如果同一地点在不同时间段（日/夜）视觉差异巨大，则分开提取。
2. **视觉转化**：
   - **环境主体**：建筑结构、室内布局（如：dirty cheap apartment room）。
   - **细节填充**：根据剧本描述自动脑补合理的道具细节（如：剧本写"满地烟头"，Prompt需补充 \`floor littered with cigarette butts, messy desk\`）。
   - **氛围光影**：提取时间（Night）、情绪（Gloomy），转化为光线描述（\`dim lighting, cold blue tone, cinematic shadows\`）。
3. **构图标准**：默认添加 \`scenery, background art, no humans, wide shot, highly detailed\`，确保生成的是干净的背景图，无人物干扰。
4. **输出控制**：输出为标准JSON格式，不要包含Markdown标记或其他废话。

# Output Schema
{
  "scenes": [
    {
      "scene_id": "unique_id (如 scene_01)",
      "scene_name": "场景中文名",
      "description": "场景描述",
      "time": "时间 (Day/Night/Dawn/Dusk)",
      "weather": "天气 (Clear/Cloudy/Rain/Heavy Rain/Snow/Fog/Storm)",
      "mood": "氛围 (warm/tense/mysterious/neutral)",
      "prompt": "High-quality English prompt. Structure: [Environment Subject] + [Props & Details] + [Lighting & Atmosphere] + [Style & Quality]. Must include 'no humans'.",
      "negative_prompt": "people, humans, character, text, signature, watermark, low quality, blurry"
    }
  ]
}

只输出JSON，不要其他内容。`

// 从 LLM 响应中提取 JSON
function extractJSON(text: string): string {
  // 移除 <thinking> 标签及其内容
  let cleaned = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
  
  // 尝试提取 JSON 代码块
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim()
  }
  
  // 尝试提取 { } 包裹的内容
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return jsonMatch[0]
  }
  
  return cleaned.trim()
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()
  const { scriptId, scriptContent, systemPrompt: customSystemPrompt, userPrompt: customUserPrompt } = body

  try {
    // 如果提供了 scriptId，从数据库获取剧本内容
    let content = scriptContent
    if (scriptId && !scriptContent) {
      const script = await prisma.script.findUnique({ where: { id: scriptId } })
      if (!script) {
        return NextResponse.json({ error: 'Script not found' }, { status: 404 })
      }
      content = script.content
    }

    if (!content) {
      return NextResponse.json({ error: 'No script content provided' }, { status: 400 })
    }

    const startTime = Date.now()
    const effectiveSystemPrompt = customSystemPrompt || SYSTEM_PROMPT
    const effectiveUserPrompt = customUserPrompt
      ? customUserPrompt.replace('{script}', content)
      : `请从以下剧本中提取场景：\n\n${content}`
    console.log('[Scenes Extract] 开始调用AI模型', {
      projectId: id,
      scriptId,
      model: MODEL,
      maxTokens: 4096,
      scriptContentLength: content?.length || 0,
    })
    console.log('[Scenes Extract] System Prompt:', effectiveSystemPrompt)
    console.log('[Scenes Extract] User Prompt:', effectiveUserPrompt)

    const message = await retryWithBackoff(
      () => callLLM({
        model: MODEL,
        systemPrompt: effectiveSystemPrompt,
        userPrompt: effectiveUserPrompt,
        maxTokens: 4096,
      }),
      {
        maxRetries: 3,
        initialDelay: 2000,
        onRetry: (error, attempt) => {
          console.log(`[Scenes Extract] 重试第 ${attempt} 次`, {
            projectId: id,
            scriptId,
            error: error.message,
          })
        },
      }
    )

    const duration = Date.now() - startTime
    const jsonText = extractJSON(message)
    const data = JSON.parse(jsonText)

    console.log('[Scenes Extract] AI模型调用成功', {
      projectId: id,
      scriptId,
      duration: `${duration}ms`,
      durationSeconds: `${(duration / 1000).toFixed(2)}s`,
      scenesCount: data.scenes?.length || 0,
      model: MODEL,
    })
    console.log('[Scenes Extract] AI返回的原始内容（前1000字符）:', message.substring(0, 1000))
    console.log('[Scenes Extract] AI返回的原始内容（后1000字符）:', message.substring(Math.max(0, message.length - 1000)))
    console.log('[Scenes Extract] 解析后的JSON:', JSON.stringify(data, null, 2))

    // 删除该剧集的现有场景（如果指定了 scriptId）
    if (scriptId) {
      await prisma.scene.deleteMany({ where: { projectId: id, scriptId } })
    } else {
      // 兼容旧逻辑：删除项目下所有未关联剧集的场景
      await prisma.scene.deleteMany({ where: { projectId: id, scriptId: null } })
    }

    // 创建新场景，关联到剧集
    const scenes = await Promise.all(
      data.scenes.map((s: { scene_name?: string; name?: string; description?: string; time?: string; weather?: string; mood?: string; prompt?: string; negative_prompt?: string }) =>
        prisma.scene.create({
          data: {
            projectId: id,
            scriptId: scriptId || null,
            name: s.scene_name || s.name || '',
            description: s.description || '',
            time: (s.time || 'day').toLowerCase(),
            mood: s.mood || 'neutral',
            weather: s.weather || 'Clear',
            prompt: s.prompt || null,
            negativePrompt: s.negative_prompt || null,
          },
        })
      )
    )

    return NextResponse.json({ scenes })
  } catch (error) {
    console.error('[Scenes Extract] AI模型调用失败', {
      projectId: id,
      scriptId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ error: 'Failed to extract' }, { status: 500 })
  }
}
