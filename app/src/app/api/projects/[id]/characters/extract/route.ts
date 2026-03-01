import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MODEL, retryWithBackoff, callLLM } from '@/lib/ai'
import { extractJsonFromThinkingModel } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

const SYSTEM_PROMPT = `你是一位专业的剧本分析师。请从剧本中提取所有角色信息。

输出JSON格式：
{
  "characters": [
    {
      "name": "角色名",
      "role": "protagonist/antagonist/supporting",
      "description": "外貌、性格描述"
    }
  ]
}

只输出JSON，不要其他内容。`

export async function POST(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()
  const { scriptContent } = body

  try {
    const startTime = Date.now()
    const userPrompt = `请从以下剧本中提取角色：\n\n${scriptContent}`
    console.log('[Characters Extract] 开始调用AI模型', {
      projectId: id,
      model: MODEL,
      maxTokens: 4096,
      scriptContentLength: scriptContent?.length || 0,
    })
    console.log('[Characters Extract] System Prompt:', SYSTEM_PROMPT)
    console.log('[Characters Extract] User Prompt:', userPrompt)

    const message = await retryWithBackoff(
      () => callLLM({
        model: MODEL,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: userPrompt,
        maxTokens: 4096,
      }),
      {
        maxRetries: 3,
        initialDelay: 2000,
        onRetry: (error, attempt) => {
          console.log(`[Characters Extract] 重试第 ${attempt} 次`, {
            projectId: id,
            error: error.message,
          })
        },
      }
    )

    const duration = Date.now() - startTime
    const data = extractJsonFromThinkingModel(message)

    console.log('[Characters Extract] AI模型调用成功', {
      projectId: id,
      duration: `${duration}ms`,
      durationSeconds: `${(duration / 1000).toFixed(2)}s`,
      charactersCount: data.characters?.length || 0,
      model: MODEL,
    })
    console.log('[Characters Extract] AI返回的原始内容（前1000字符）:', message.substring(0, 1000))
    console.log('[Characters Extract] AI返回的原始内容（后1000字符）:', message.substring(Math.max(0, message.length - 1000)))
    console.log('[Characters Extract] 解析后的JSON:', JSON.stringify(data, null, 2))

    // 删除现有角色
    await prisma.character.deleteMany({ where: { projectId: id } })

    // 创建新角色，同时设置 characterGroupId（平级换装分组用）
    const characters = await Promise.all(
      data.characters.map(async (char: { name: string; role: string; description: string }) => {
        const character = await prisma.character.create({
          data: {
            projectId: id,
            name: char.name,
            role: char.role || 'supporting',
            description: char.description || '',
          },
        })
        // 用自身 ID 作为 groupId
        return prisma.character.update({
          where: { id: character.id },
          data: { characterGroupId: character.id },
        })
      })
    )

    return NextResponse.json({ characters })
  } catch (error) {
    console.error('[Characters Extract] AI模型调用失败', {
      projectId: id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ error: 'Failed to extract' }, { status: 500 })
  }
}
