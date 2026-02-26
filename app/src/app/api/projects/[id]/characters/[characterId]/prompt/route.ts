import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MODEL, retryWithBackoff, stripThinkingTags, callLLM } from '@/lib/ai'

interface Props {
  params: Promise<{ id: string; characterId: string }>
}

const STYLE_PROMPTS: Record<string, string> = {
  'cel-shaded': '赛璐璐平涂风格，干净线条，硬边阴影，高对比度，2D动漫风格',
  'realistic': '厚涂写实风格，柔和渐变，细腻光影，自然色调',
  'watercolor': '水彩淡雅风格，透明感，柔和边缘，低饱和度',
  'american-comic': '美漫风格，粗犷线条，强烈明暗对比，高饱和度',
}

const SYSTEM_PROMPT = `你是一位资深的二次元漫画监制。根据角色信息生成适合AI绘图的英文Prompt。

输出要求：
1. 全身立绘描述
2. 包含外貌、服装、姿势、表情
3. 纯英文输出
4. 适合Midjourney/Stable Diffusion使用

只输出prompt文本，不要其他内容。`

export async function POST(request: Request, { params }: Props) {
  const { characterId } = await params
  const body = await request.json()
  const { systemPrompt, userPrompt } = body

  const character = await prisma.character.findUnique({
    where: { id: characterId },
  })

  if (!character) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const styleDesc = STYLE_PROMPTS[character.style] || STYLE_PROMPTS['cel-shaded']

  // 如果请求提供了自定义Prompt，使用自定义Prompt；否则使用默认Prompt
  const finalSystemPrompt = systemPrompt || SYSTEM_PROMPT
  const finalUserPrompt = userPrompt || `角色名：${character.name}\n角色类型：${character.role}\n描述：${character.description}\n风格：${styleDesc}`

  try {
    const startTime = Date.now()
    console.log('[Character Prompt] 开始调用AI模型', {
      characterId,
      characterName: character.name,
      model: MODEL,
      maxTokens: 2048,
      style: character.style,
    })
    console.log('[Character Prompt] System Prompt:', finalSystemPrompt)
    console.log('[Character Prompt] User Prompt:', finalUserPrompt)

    const rawPrompt = await retryWithBackoff(
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
          console.log(`[Character Prompt] 重试第 ${attempt} 次`, {
            characterId,
            characterName: character.name,
            error: error.message,
          })
        },
      }
    )

    const duration = Date.now() - startTime
    // 过滤 <thinking> 标签内容
    const prompt = stripThinkingTags(rawPrompt)

    console.log('[Character Prompt] AI模型调用成功', {
      characterId,
      characterName: character.name,
      duration: `${duration}ms`,
      durationSeconds: `${(duration / 1000).toFixed(2)}s`,
      promptLength: rawPrompt.length,
      model: MODEL,
    })
    console.log('[Character Prompt] AI返回的原始内容（前1000字符）:', rawPrompt.substring(0, 1000))
    console.log('[Character Prompt] AI返回的原始内容（后1000字符）:', rawPrompt.substring(Math.max(0, rawPrompt.length - 1000)))
    console.log('[Character Prompt] 提取后的Prompt:', prompt)

    await prisma.character.update({
      where: { id: characterId },
      data: { prompt: prompt },
    })

    return NextResponse.json({ prompt: prompt })
  } catch (error) {
    console.error('[Character Prompt] AI模型调用失败', {
      characterId,
      characterName: character?.name,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
