import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MODEL, retryWithBackoff, callLLM } from '@/lib/ai'

interface Props {
  params: Promise<{ id: string }>
}

const SYSTEM_PROMPT = `# Role
你是一位专业的影视道具设计师和AI绘图提示词专家。你擅长从剧本文字中提炼关键道具，并将其转化为用于生成高质量道具参考图的英文提示词。

# Task
分析提供的【剧本内容】，提取出所有重要的"道具资产"，并为每个道具生成用于AI绘图的英文提示词。

# Constraints & Logic
1. **道具定义**：道具是剧情中出现的具体物品，如武器、交通工具、重要物件、标志性器物等。
2. **排除项**：不包括人物、地点/场景、抽象概念、普通背景物品（椅子、桌子等通用家具）。
3. **去重**：相同道具只提取一次，合并同类项。
4. **视觉转化**：生成的 prompt 需要描述道具的外观特征、材质、状态、风格。
5. **输出控制**：输出为标准JSON格式，不要包含Markdown标记或其他废话。

# Output Schema
{
  "props": [
    {
      "name": "道具中文名",
      "description": "道具中文描述，包括外观、材质、状态等",
      "prompt": "High-quality English prompt for the prop. Structure: [Object] + [Material & Texture] + [Condition & Details] + [Style & Quality]. No humans, isolated object or in context."
    }
  ]
}

只输出JSON，不要其他内容。`

function extractJSON(text: string): string {
  let cleaned = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
  const jsonBlockMatch = cleaned.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/)
  if (jsonBlockMatch) return jsonBlockMatch[1].trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return cleaned.trim()
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()
  const { scriptId, systemPrompt: customSystemPrompt, userPrompt: customUserPrompt } = body

  try {
    // 获取剧本内容
    let content: string
    if (scriptId) {
      const script = await prisma.script.findUnique({ where: { id: scriptId } })
      if (!script) return NextResponse.json({ error: 'Script not found' }, { status: 404 })
      content = script.content
    } else {
      // 获取项目下所有剧本
      const scripts = await prisma.script.findMany({ where: { projectId: id }, orderBy: { episode: 'asc' } })
      if (!scripts.length) return NextResponse.json({ error: 'No scripts found' }, { status: 400 })
      content = scripts.map(s => `【第${s.episode}集】\n${s.content}`).join('\n\n')
    }

    // 获取现有角色和场景，注入 prompt 避免误识别
    const [characters, scenes] = await Promise.all([
      prisma.character.findMany({ where: { projectId: id }, select: { name: true } }),
      prisma.scene.findMany({ where: { projectId: id }, select: { name: true } }),
    ])

    const existingAssets = [
      characters.length ? `## 已有角色（不要提取为道具）\n${characters.map(c => `- ${c.name}`).join('\n')}` : '',
      scenes.length ? `## 已有场景（不要提取为道具）\n${scenes.map(s => `- ${s.name}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n')

    const effectiveSystemPrompt = customSystemPrompt || (existingAssets ? `${SYSTEM_PROMPT}\n\n${existingAssets}` : SYSTEM_PROMPT)
    const effectiveUserPrompt = customUserPrompt
      ? customUserPrompt.replace('{script}', content)
      : `请从以下剧本中提取道具资产：\n\n${content}`

    console.log('[Props Extract] System Prompt:', effectiveSystemPrompt)
    console.log('[Props Extract] User Prompt:', effectiveUserPrompt)

    const message = await retryWithBackoff(
      () => callLLM({ model: MODEL, systemPrompt: effectiveSystemPrompt, userPrompt: effectiveUserPrompt, maxTokens: 4096 }),
      { maxRetries: 3, initialDelay: 2000, onRetry: (error, attempt) => console.log(`[Props Extract] 重试第 ${attempt} 次`, error.message) }
    )

    const data = JSON.parse(extractJSON(message))

    // 删除现有道具（如果指定了 scriptId 则只删除项目级，否则全删）
    await prisma.prop.deleteMany({ where: { projectId: id } })

    const props = await Promise.all(
      (data.props || []).map((p: { name?: string; description?: string; prompt?: string }) =>
        prisma.prop.create({
          data: {
            projectId: id,
            name: p.name || '',
            description: p.description || '',
            prompt: p.prompt || null,
          },
        })
      )
    )

    return NextResponse.json({ props })
  } catch (error) {
    console.error('[Props Extract] 失败', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Failed to extract props' }, { status: 500 })
  }
}
