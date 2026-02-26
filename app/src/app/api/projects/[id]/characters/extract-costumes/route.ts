import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MODEL, retryWithBackoff, callLLM } from '@/lib/ai'
import { extractJsonFromThinkingModel } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

const SYSTEM_PROMPT = `你是一位专业的剧本分析师。分析剧本中角色的服装/装扮变化，提取有明显视觉差异的换装版本。

# 换装定义
只提取有明显视觉差异的装扮，例如：
- 日常服装 vs 战斗装备
- 便服 vs 正装
- 现代装 vs 古装
- 受伤/特殊状态造型

# 排除项
- 细微的颜色差异
- 同款不同颜色
- 无法从剧本文字判断的装扮

# Output Schema
{
  "costumes": [
    {
      "characterId": "角色ID（从提供的角色列表中选取）",
      "costumeName": "装扮名称，如'日常便服'、'战斗装'",
      "description": "装扮的中文描述，包括服装款式、颜色、配件等",
      "prompt": "English prompt describing ONLY the costume/outfit, to be appended to the character's base prompt. Focus on clothing details."
    }
  ]
}

只输出JSON，不要其他内容。`

export async function POST(request: Request, { params }: Props) {
  const { id } = await params

  try {
    // 获取项目下所有剧本内容
    const scripts = await prisma.script.findMany({
      where: { projectId: id },
      orderBy: { episode: 'asc' },
    })
    if (!scripts.length) {
      return NextResponse.json({ error: 'No scripts found' }, { status: 400 })
    }
    const content = scripts.map(s => `【第${s.episode}集】\n${s.content}`).join('\n\n')

    // 获取现有角色（只取原版，即 costumeName 为 null 的）
    const characters = await prisma.character.findMany({
      where: { projectId: id, costumeName: null },
    })
    if (!characters.length) {
      return NextResponse.json({ error: 'No characters found' }, { status: 400 })
    }

    const characterList = characters
      .map(c => `- ID: ${c.id} | 名称: ${c.name} | 描述: ${c.description}`)
      .join('\n')

    const userPrompt = `## 角色列表\n${characterList}\n\n## 剧本内容\n${content}`

    const message = await retryWithBackoff(
      () => callLLM({ model: MODEL, systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 4096 }),
      {
        maxRetries: 3,
        initialDelay: 2000,
        onRetry: (error, attempt) => console.log(`[Extract Costumes] 重试第 ${attempt} 次`, error.message),
      }
    )

    const data = extractJsonFromThinkingModel(message)
    const costumes: { characterId: string; costumeName: string; description: string; prompt?: string }[] = data.costumes || []

    // 为每套装扮创建新的 Character 记录
    const created = await Promise.all(
      costumes.map(async (c) => {
        const parent = characters.find(ch => ch.id === c.characterId)
        if (!parent) return null
        return prisma.character.create({
          data: {
            projectId: id,
            name: parent.name,
            role: parent.role,
            description: parent.description,
            style: parent.style,
            prompt: parent.prompt ? `${parent.prompt}, ${c.prompt || ''}` : (c.prompt || null),
            characterGroupId: parent.characterGroupId || parent.id,
            costumeName: c.costumeName,
          },
        })
      })
    )

    return NextResponse.json({ costumes: created.filter(Boolean) })
  } catch (error) {
    console.error('[Extract Costumes] 失败', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Failed to extract costumes' }, { status: 500 })
  }
}
