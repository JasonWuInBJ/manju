import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MODEL, retryWithBackoff, callLLM } from '@/lib/ai'

interface Props {
  params: Promise<{ id: string; sceneId: string }>
}

const TIME_MAP: Record<string, string> = {
  dawn: 'early morning, golden hour',
  day: 'daytime, bright natural light',
  dusk: 'sunset, warm orange light',
  night: 'night time, dim lighting',
}

const MOOD_MAP: Record<string, string> = {
  warm: 'cozy, comfortable atmosphere',
  tense: 'tense, suspenseful atmosphere',
  mysterious: 'mysterious, enigmatic atmosphere',
  neutral: 'neutral atmosphere',
}

const SYSTEM_PROMPT = `你是一位专业的影视概念设计师和AI绘图提示词专家。根据场景信息生成用于 AI 绘图的英文提示词。

要求：
1. prompt 结构：[Environment Subject] + [Props & Details] + [Lighting & Atmosphere] + [Style & Quality]
2. 必须包含 'scenery, background art, no humans, wide shot, highly detailed'
3. 纯英文输出

输出 JSON 格式：
{
  "prompt": "scenery, background art, no humans, wide shot, highly detailed, ...",
  "negative_prompt": "people, humans, character, text, signature, watermark, low quality, blurry"
}

只输出 JSON，不要其他内容。`

export async function POST(request: Request, { params }: Props) {
  const { sceneId } = await params
  const body = await request.json()
  const { systemPrompt: customSystemPrompt, userPrompt: customUserPrompt } = body

  const scene = await prisma.scene.findUnique({ where: { id: sceneId } })

  if (!scene) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const timeDesc = TIME_MAP[scene.time] || TIME_MAP['day']
  const moodDesc = MOOD_MAP[scene.mood] || MOOD_MAP['neutral']

  // 使用自定义配置或默认配置
  const finalSystemPrompt = customSystemPrompt || SYSTEM_PROMPT
  const finalUserPrompt = customUserPrompt || `场景名：${scene.name}\n描述：${scene.description}\n时间：${timeDesc}\n氛围：${moodDesc}`

  try {
    const startTime = Date.now()
    console.log('[Scene Prompt] 开始调用AI模型', {
      sceneId,
      sceneName: scene.name,
      model: MODEL,
      maxTokens: 2048,
      time: scene.time,
      mood: scene.mood,
      usingCustomPrompt: !!customSystemPrompt,
    })
    console.log('[Scene Prompt] System Prompt:', finalSystemPrompt)
    console.log('[Scene Prompt] User Prompt:', finalUserPrompt)

    const message = await retryWithBackoff(
      () => callLLM({
        model: MODEL,
        systemPrompt: finalSystemPrompt,
        userPrompt: finalUserPrompt,
        maxTokens: 2048,
      }),
      {
        maxRetries: 3,
        initialDelay: 2000,
        onRetry: (error, attempt) => {
          console.log(`[Scene Prompt] 重试第 ${attempt} 次`, {
            sceneId,
            sceneName: scene.name,
            error: error.message,
          })
        },
      }
    )

    const duration = Date.now() - startTime

    // 解析 JSON 响应
    let cleaned = message.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    let jsonText = ''
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim()
    } else {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonText = jsonMatch[0]
      }
    }

    let prompt = ''
    let negativePrompt = ''
    if (jsonText) {
      try {
        const parsed = JSON.parse(jsonText)
        prompt = parsed.prompt || ''
        negativePrompt = parsed.negative_prompt || ''
      } catch {
        // JSON 解析失败，回退为纯文本
        prompt = cleaned.trim()
      }
    } else {
      prompt = cleaned.trim()
    }

    console.log('[Scene Prompt] AI模型调用成功', {
      sceneId,
      sceneName: scene.name,
      duration: `${duration}ms`,
      durationSeconds: `${(duration / 1000).toFixed(2)}s`,
      promptLength: prompt.length,
      model: MODEL,
    })
    console.log('[Scene Prompt] AI返回的原始内容（前1000字符）:', message.substring(0, 1000))
    console.log('[Scene Prompt] 提取后的Prompt:', prompt)
    console.log('[Scene Prompt] Negative Prompt:', negativePrompt)

    await prisma.scene.update({
      where: { id: sceneId },
      data: { prompt, negativePrompt: negativePrompt || null },
    })

    return NextResponse.json({ prompt, negativePrompt })
  } catch (error) {
    console.error('[Scene Prompt] AI模型调用失败', {
      sceneId,
      sceneName: scene?.name,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
