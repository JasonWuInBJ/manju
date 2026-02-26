import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRunningHubApiKey } from '@/lib/config'

interface Props {
  params: Promise<{ id: string; propId: string }>
}

export async function POST(request: Request, { params }: Props) {
  const { propId } = await params
  const body = await request.json()
  const { prompt, aspectRatio = '1:1' } = body

  console.log('[Prop Image] 开始生成图片', {
    propId,
    aspectRatio,
    promptLength: prompt?.length || 0,
    promptPreview: prompt?.substring(0, 200) || '',
  })

  if (!prompt) {
    return NextResponse.json({ error: '请先生成绘图 Prompt' }, { status: 400 })
  }

  try {
    const apiUrl = 'https://www.runninghub.cn/openapi/v2/rhart-image-n-pro-official/text-to-image'
    const apiKey = await getRunningHubApiKey()

    console.log('[Prop Image] 调用 RunningHub API', {
      apiUrl,
      hasApiKey: !!apiKey,
      requestBody: {
        prompt: prompt.substring(0, 100) + '...',
        resolution: '1k',
        aspectRatio,
      },
    })

    const startTime = Date.now()

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        resolution: '1k',
        aspectRatio,
      }),
    })

    const duration = Date.now() - startTime
    console.log('[Prop Image] API 响应状态', {
      status: response.status,
      duration: `${duration}ms`,
    })

    const data = await response.json()
    console.log('[Prop Image] API 响应数据', {
      status: data.status,
      taskId: data.taskId,
      rawData: JSON.stringify(data).substring(0, 500),
    })

    if (data.status === 'FAILED') {
      return NextResponse.json(
        { error: data.errorMessage || data.failedReason || '图片生成失败' },
        { status: 500 }
      )
    }

    if (data.status === 'QUEUED' || data.status === 'RUNNING') {
      await prisma.prop.update({
        where: { id: propId },
        data: { imageTaskId: data.taskId },
      })

      return NextResponse.json({
        status: data.status,
        taskId: data.taskId,
        message: data.status === 'QUEUED' ? '任务排队中...' : '图片生成中...',
      })
    }

    const imageUrl = data.results?.[0]?.url

    if (!imageUrl) {
      return NextResponse.json({ error: '未获取到图片 URL' }, { status: 500 })
    }

    await prisma.prop.update({
      where: { id: propId },
      data: { imageUrl, imageTaskId: null },
    })

    console.log('[Prop Image] 图片生成成功', { propId, imageUrl })

    return NextResponse.json({ status: 'SUCCESS', imageUrl, usage: data.usage })
  } catch (error) {
    console.error('[Prop Image] 异常错误', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: '图片生成服务异常' }, { status: 500 })
  }
}
