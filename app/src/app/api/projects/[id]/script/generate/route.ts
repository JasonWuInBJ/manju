import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MODEL, retryWithBackoff, callLLM } from '@/lib/ai'
import { extractTextFromThinkingModel } from '@/lib/utils'

const SYSTEM_PROMPT = `你是一位拥有深厚网文改编经验的短剧金牌编剧。

任务：将网络小说片段改编为短剧剧本。

参数约束：
1. 时长：2分钟左右
2. 字数：1000字左右
3. 镜头：50个左右

改编原则：
1. 以网文原文时间线顺序为基础
2. 紧扣核心矛盾推动剧情
3. 前五秒锚定强冲突点
4. 结尾设置悬念钩子

剧本格式：
- 标题：# 第X集 标题名
- 场景：## 场号-场景名（日/夜/内/外）
- 画面：【画面】描述
- 对白：角色名："对白"
- 内心：角色名 OS："独白"
- 转场：跳切/转场标识`

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()
  const { novelText, synopsis, systemPrompt, userPrompt, model, scriptId } = body

  // 使用自定义 Prompt 或默认 Prompt
  const finalSystemPrompt = systemPrompt || SYSTEM_PROMPT
  let finalUserPrompt = userPrompt

  if (!finalUserPrompt) {
    finalUserPrompt = `请将以下网络小说片段改编为短剧剧本：\n\n${novelText}`
    if (synopsis) {
      finalUserPrompt = `剧集简介：${synopsis}\n\n${finalUserPrompt}`
    }
  }

  // 使用请求中指定的模型或默认模型
  const selectedModel = model || MODEL

  try {
    const startTime = Date.now()
    console.log('[Script Generate] 开始调用AI模型', {
      projectId: id,
      scriptId,
      model: selectedModel,
      maxTokens: 8192,
      novelTextLength: novelText?.length || 0,
      hasSynopsis: !!synopsis,
    })
    console.log('[Script Generate] System Prompt:', finalSystemPrompt)
    console.log('[Script Generate] User Prompt:', finalUserPrompt)

    const rawText = await retryWithBackoff(
      () => callLLM({
        model: selectedModel,
        systemPrompt: finalSystemPrompt,
        userPrompt: finalUserPrompt,
        maxTokens: 8192,
      }),
      {
        maxRetries: 3,
        initialDelay: 2000,
        onRetry: (error, attempt) => {
          console.log(`[Script Generate] 重试第 ${attempt} 次`, {
            projectId: id,
            error: error.message,
          })
        },
      }
    )

    console.log('[Script Generate] AI 原始返回:', rawText)
    const duration = Date.now() - startTime
    const content = extractTextFromThinkingModel(rawText)

    console.log('[Script Generate] AI模型调用成功', {
      projectId: id,
      scriptId,
      duration: `${duration}ms`,
      contentLength: content.length,
    })
    console.log('[Script Generate] 提取后的内容:', content)

    // 从剧本内容中提取标题（第一行通常是标题）
    const titleMatch = content.match(/^#\s*(.+)$/m)
    const extractedTitle = titleMatch ? titleMatch[1].trim() : '未命名'

    // 更新或创建剧本
    let script
    if (scriptId) {
      // 更新现有剧本
      script = await prisma.script.update({
        where: { id: scriptId },
        data: {
          novelText,
          content,
          title: extractedTitle,
        },
      })
    } else {
      // 获取当前集数
      const existingScripts = await prisma.script.findMany({
        where: { projectId: id },
        select: { episode: true },
      })
      const nextEpisode = existingScripts.length > 0
        ? Math.max(...existingScripts.map(s => s.episode)) + 1
        : 1

      // 创建新剧本
      script = await prisma.script.create({
        data: {
          projectId: id,
          episode: nextEpisode,
          title: extractedTitle,
          novelText,
          content,
        },
      })
    }

    return NextResponse.json(script)
  } catch (error) {
    console.error('[Script Generate] AI模型调用失败', {
      projectId: id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to generate script' },
      { status: 500 }
    )
  }
}
