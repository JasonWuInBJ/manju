import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MODEL, retryWithBackoff, stripThinkingTags, callLLM } from '@/lib/ai'

interface Props {
  params: Promise<{ id: string; propId: string }>
}

const SYSTEM_PROMPT = `# Role
你是一位专业的游戏与动漫道具设计师，擅长设计具有故事感的物品资产。你需要生成用于AI绘图的提示词。
# Task
根据输入的【道具描述】，生成一张高清、背景干净的道具设计图Prompt。
# Constraints & Logic
1. **背景控制（关键）**：
   - 必须包含 \`isolated on white background\`（白底孤立）或 \`simple clean background\`（简单干净背景）。
   - 必须包含 \`sharp edges\`（边缘清晰），方便后期自动抠图去除背景。
   - 绝对禁止复杂的场景背景，以免道具与背景融合无法分离。
2. **视角与构图**：
   - 默认视角：\`Front view\`（正视图）或 \`Side view\`（侧视图）。
   - 构图：道具居中，完整展示，\`centered composition\`。
3. **细节与质感**：
   - 必须强调材质感：如 \`metallic texture\`（金属质感）、\`rusty\`（生锈）、\`glowing\`（发光）。
   - 必须包含 \`highly detailed\`, \`8k resolution\`, \`texture details\`。
4. **风格统一**：
   - 道具风格需与漫剧整体画风保持一致（如：二次元、赛博朋克、写实等）。
   - 默认添加 \`unreal engine 5 render style\` 或 \`anime art style\`（根据你的画风二选一）。
5. **故事感修饰**：
   - 如果道具是旧物，自动添加 \`worn out\`, \`scratches\` 等细节；如果是新物，添加 \`brand new\`, \`shiny\`。
# Prompt Structure
[Subject Description], [Material & Details], [Condition/Story Elements], [Background Requirement], [Lighting], [Style & Quality].
# Input Data
道具描述：
{{Prop_Description}}
# Output
仅输出Prompt文本。
# Example
Input: 苏烬的旧手机，屏幕裂了。
Output:
A broken smartphone, screen with cracked glass and spiderweb patterns, worn-out black metal casing, scratches on the sides, isolated on white background, studio lighting, soft shadows, highly detailed texture, 8k resolution, cinematic prop design, sharp focus.`

export async function POST(request: Request, { params }: Props) {
  const { propId } = await params
  const body = await request.json()
  const { systemPrompt, userPrompt } = body

  const prop = await prisma.prop.findUnique({
    where: { id: propId },
    include: { project: true },
  })

  if (!prop) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 获取项目风格
  const projectStyle = prop.project.style || 'Anime style'

  const finalSystemPrompt = systemPrompt || SYSTEM_PROMPT
  const finalUserPrompt = userPrompt || `道具名：${prop.name}\n描述：${prop.description || '无'}\n项目风格：${projectStyle}`

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
