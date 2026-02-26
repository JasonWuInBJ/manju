import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MODEL, retryWithBackoff, callLLM } from '@/lib/ai'
import { extractJsonFromThinkingModel } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

function buildSystemPrompt(
  characters: { id: string; name: string; description: string }[],
  scenes: { id: string; name: string; description: string }[]
): string {
  const charSection = characters.length > 0
    ? characters.map(c => `- ${c.id} (${c.name}): ${c.description}`).join('\n')
    : '（暂无角色资产）'

  const sceneSection = scenes.length > 0
    ? scenes.map(s => `- ${s.id} (${s.name}): ${s.description}`).join('\n')
    : '（暂无场景资产）'

  return `你是一位专业的AI视频分镜师。根据剧本内容生成分镜数据。

## 可用角色资产
${charSection}

## 可用场景资产
${sceneSection}

## 输出要求
- visual_prompt 必须为英文，格式：主体 + 动作 + 环境 + 光影 + 镜头语言，要求高质量、电影感
- ref_character_ids 引用上方角色ID（数组），系统会自动将角色外貌描述注入到视频模型的prompt中
- camera_shot_type 使用标准值：wide, medium, close, extreme-close
- camera_movement 使用标准值：static, slow_push_in, slow_pull_out, pan_left, pan_right, tilt_up, tilt_down, dynamic_follow, slight_handheld_shake, orbit
- duration 单位为秒，建议 3-6 秒/镜头
- negative_prompt 只在需要额外约束时填写（可选），系统有全局默认值
- scene_setting 和 character_action 用中文描述，供用户阅读理解
- character_action 可选，纯场景镜头可以不填

输出纯JSON，不要其他内容。格式：
{
  "shots": [
    {
      "order": 1,
      "duration": 4,
      "camera_shot_type": "wide/medium/close/extreme-close",
      "camera_movement": "static/slow_push_in/...",
      "scene_setting": "中文场景描述",
      "character_action": "中文角色动作描述（可选）",
      "visual_prompt": "English visual prompt for video model",
      "negative_prompt": "optional negative prompt",
      "ref_character_ids": ["character_id"],
      "audio": "对白或音效"
    }
  ]
}`
}

interface ShotFromAI {
  order: number
  duration: number
  camera_shot_type: string
  camera_movement: string
  scene_setting: string
  character_action?: string
  visual_prompt: string
  negative_prompt?: string
  ref_character_ids?: string[]
  audio: string
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()
  const { scriptContent, scriptId, systemPrompt, userPrompt, model } = body

  try {
    // 从 DB 拉取角色和场景资产
    const [characters, scenes] = await Promise.all([
      prisma.character.findMany({
        where: { projectId: id },
        select: { id: true, name: true, description: true },
      }),
      prisma.scene.findMany({
        where: { projectId: id },
        select: { id: true, name: true, description: true },
      }),
    ])

    const defaultSystemPrompt = buildSystemPrompt(characters, scenes)

    // 如果前端传了自定义 systemPrompt，替换其中的占位符
    let finalSystemPrompt = defaultSystemPrompt
    if (systemPrompt) {
      const charSection = characters.length > 0
        ? characters.map(c => `- ${c.id} (${c.name}): ${c.description}`).join('\n')
        : '（暂无角色资产）'
      const sceneSection = scenes.length > 0
        ? scenes.map(s => `- ${s.id} (${s.name}): ${s.description}`).join('\n')
        : '（暂无场景资产）'
      finalSystemPrompt = systemPrompt
        .replace('{characters}', charSection)
        .replace('{scenes}', sceneSection)
    }

    const finalUserPrompt = userPrompt || `请将以下剧本转换为分镜：\n\n${scriptContent}`
    const finalModel = model || MODEL

    const startTime = Date.now()
    console.log('[Storyboard Generate] 开始调用AI模型', {
      projectId: id,
      scriptId,
      model: finalModel,
      charactersCount: characters.length,
      scenesCount: scenes.length,
    })

    const message = await retryWithBackoff(
      () => callLLM({
        model: finalModel,
        systemPrompt: finalSystemPrompt,
        userPrompt: finalUserPrompt,
        maxTokens: 8192,
      }),
      {
        maxRetries: 3,
        initialDelay: 2000,
        onRetry: (error, attempt) => {
          console.log(`[Storyboard Generate] 重试第 ${attempt} 次`, {
            error: error.message,
          })
        },
      }
    )

    const duration = Date.now() - startTime
    const data = extractJsonFromThinkingModel(message)

    console.log('[Storyboard Generate] AI模型调用成功', {
      duration: `${(duration / 1000).toFixed(2)}s`,
      shotsCount: data.shots?.length || 0,
    })

    // 确定目标 scriptId
    let targetScriptId = scriptId
    if (!targetScriptId) {
      const script = await prisma.script.findFirst({ where: { projectId: id } })
      if (!script) {
        return NextResponse.json({ error: 'No script' }, { status: 404 })
      }
      targetScriptId = script.id
    }

    // 清除旧 shots 并写入新数据
    await prisma.shot.deleteMany({ where: { scriptId: targetScriptId } })

    const shots = data.shots as ShotFromAI[]
    await Promise.all(
      shots.map((s) =>
        prisma.shot.create({
          data: {
            scriptId: targetScriptId,
            order: s.order,
            duration: s.duration,
            cameraShotType: s.camera_shot_type,
            cameraMovement: s.camera_movement,
            sceneSetting: s.scene_setting,
            characterAction: s.character_action || null,
            visualPrompt: s.visual_prompt,
            negativePrompt: s.negative_prompt || null,
            refCharacterIds: s.ref_character_ids ? JSON.stringify(s.ref_character_ids) : null,
            audio: s.audio,
          },
        })
      )
    )

    return NextResponse.json({ shots: data.shots })
  } catch (error) {
    console.error('[Storyboard Generate] AI模型调用失败', {
      projectId: id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
