import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MODEL, retryWithBackoff, stripThinkingTags, callLLM } from '@/lib/ai'

interface Props {
  params: Promise<{ id: string; propId: string }>
}

const SYSTEM_PROMPT = `你是一位资深的AI绘图提示词专家。根据道具信息生成适合AI绘图的英文Prompt。

输出要求：
1. 描述道具的外观、材质、纹理、光影效果
2. 包含道具的颜色、形状、细节特征
3. 纯英文输出
4. 适合Midjourney/Stable Diffusion使用
5. simple pure white background, no text, no watermark

只输出prompt文本，不要其他内容。`

export async function POST(request: Request, { params }: Props) {
  const { propId } = await params
  const body = await request.json()
  const { systemPrompt, userPrompt } = body

  const prop = await prisma.prop.findUnique({
    where: { id: propId },
  })

  if (!prop) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const finalSystemPrompt = systemPrompt || SYSTEM_PROMPT
  const finalUserPrompt = userPrompt || `道具名：${prop.name}\n描述：${prop.description}`

  try {
    const startTime = Date.now()
    console.log('[Prop Prompt] 开始调用AI模型', {
      propId,
      propName: prop.name,
      model: MODEL,
      maxTokens: 2048,
    })

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
          console.log(`[Prop Prompt] 重试第 ${attempt} 次`, {
            propId,
            propName: prop.name,
            error: error.message,
          })
        },
      }
    )

    const duration = Date.now() - startTime
    const prompt = stripThinkingTags(rawPrompt)

    console.log('[Prop Prompt] AI模型调用成功', {
      propId,
      propName: prop.name,
      duration: `${duration}ms`,
      promptLength: prompt.length,
    })

    await prisma.prop.update({
      where: { id: propId },
      data: { prompt },
    })

    return NextResponse.json({ prompt })
  } catch (error) {
    console.error('[Prop Prompt] AI模型调用失败', {
      propId,
      propName: prop?.name,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
