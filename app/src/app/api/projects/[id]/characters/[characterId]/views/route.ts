import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRunningHubApiKey } from '@/lib/config'

interface Props {
  params: Promise<{ id: string; characterId: string }>
}

export async function POST(request: Request, { params }: Props) {
  const { characterId } = await params

  console.log('[Four View] 开始生成四视图', { characterId })

  try {
    // 获取角色信息，确保有概念图
    const character = await prisma.character.findUnique({
      where: { id: characterId },
    })

    if (!character) {
      console.log('[Four View] 错误: 角色不存在')
      return NextResponse.json(
        { error: '角色不存在' },
        { status: 404 }
      )
    }

    if (!character.imageUrl) {
      console.log('[Four View] 错误: 缺少概念图')
      return NextResponse.json(
        { error: '请先生成角色概念图' },
        { status: 400 }
      )
    }

    const apiUrl = 'https://www.runninghub.cn/openapi/v2/rhart-image-n-pro/edit'
    const hasApiKey = !!await getRunningHubApiKey()

    // 固定的四视图提示词
    const prompt = '生成一张16:9画幅的4K超高清四视图角色设计图，背景为白色。内容必须包含：胸部以上近景、正面全身、背面全身、左侧全身。严格确保所有视角的形象、服装、身体比例与参考图绝对一致，并以专业、均衡的布局呈现，角色居中，画面饱满。'

    console.log('[Four View] 调用 RunningHub 图生图 API', {
      apiUrl,
      hasApiKey,
      apiKeyPrefix: (await getRunningHubApiKey())?.substring(0, 8) + '...',
      imageUrl: character.imageUrl,
      requestBody: {
        prompt: prompt.substring(0, 100) + '...',
        resolution: '4k',
        aspectRatio: '16:9',
      },
    })

    const startTime = Date.now()

    // 调用 RunningHub 图生图 API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getRunningHubApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        resolution: '4k',
        aspectRatio: '16:9',
        imageUrls: [character.imageUrl],
      }),
    })

    const duration = Date.now() - startTime

    console.log('[Four View] API 响应状态', {
      status: response.status,
      statusText: response.statusText,
      duration: `${duration}ms`,
      headers: {
        contentType: response.headers.get('content-type'),
      },
    })

    const data = await response.json()

    console.log('[Four View] API 响应数据', {
      status: data.status,
      taskId: data.taskId,
      errorMessage: data.errorMessage,
      failedReason: data.failedReason,
      resultsCount: data.results?.length || 0,
      usage: data.usage,
      rawData: JSON.stringify(data).substring(0, 500),
    })

    // 检查状态
    if (data.status === 'FAILED') {
      console.error('[Four View] 四视图生成失败', {
        errorMessage: data.errorMessage,
        failedReason: data.failedReason,
        fullResponse: data,
      })
      return NextResponse.json(
        { error: data.errorMessage || data.failedReason || '四视图生成失败' },
        { status: 500 }
      )
    }

    // 如果是排队或运行中，返回任务 ID 让前端轮询
    if (data.status === 'QUEUED' || data.status === 'RUNNING') {
      console.log('[Four View] 任务进行中', {
        status: data.status,
        taskId: data.taskId,
      })
      return NextResponse.json({
        status: data.status,
        taskId: data.taskId,
        message: data.status === 'QUEUED' ? '任务排队中...' : '四视图生成中...',
      })
    }

    // 成功，提取图片 URL
    const fourViewImageUrl = data.results?.[0]?.url

    if (!fourViewImageUrl) {
      console.error('[Four View] 未获取到四视图 URL', {
        results: data.results,
        fullResponse: data,
      })
      return NextResponse.json(
        { error: '未获取到四视图 URL' },
        { status: 500 }
      )
    }

    console.log('[Four View] 四视图生成成功', {
      fourViewImageUrl,
      usage: data.usage,
    })

    // 更新数据库
    await prisma.character.update({
      where: { id: characterId },
      data: { fourViewImageUrl },
    })

    console.log('[Four View] 数据库更新成功', { characterId, fourViewImageUrl })

    return NextResponse.json({
      status: 'SUCCESS',
      fourViewImageUrl,
      usage: data.usage,
    })
  } catch (error) {
    console.error('[Four View] 异常错误', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: '四视图生成服务异常' },
      { status: 500 }
    )
  }
}
