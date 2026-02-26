import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRunningHubApiKey } from '@/lib/config'

interface Props {
  params: Promise<{ id: string; sceneId: string }>
}

export async function POST(request: Request, { params }: Props) {
  const { sceneId } = await params
  const body = await request.json()
  const { prompt, aspectRatio = '16:9' } = body

  console.log('[Scene Image] 开始生成图片', {
    sceneId,
    aspectRatio,
    promptLength: prompt?.length || 0,
    promptPreview: prompt?.substring(0, 200) || '',
  })

  if (!prompt) {
    console.log('[Scene Image] 错误: 缺少 prompt')
    return NextResponse.json(
      { error: '请先生成绘图 Prompt' },
      { status: 400 }
    )
  }

  try {
    const apiUrl = 'https://www.runninghub.cn/openapi/v2/rhart-image-n-pro-official/text-to-image'
    const hasApiKey = !!await getRunningHubApiKey()

    console.log('[Scene Image] 调用 RunningHub API', {
      apiUrl,
      hasApiKey,
      apiKeyPrefix: (await getRunningHubApiKey())?.substring(0, 8) + '...',
      requestBody: {
        prompt: prompt.substring(0, 100) + '...',
        resolution: '1k',
        aspectRatio,
      },
    })

    const startTime = Date.now()

    // 调用 RunningHub API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getRunningHubApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        resolution: '1k',
        aspectRatio,
      }),
    })

    const duration = Date.now() - startTime

    console.log('[Scene Image] API 响应状态', {
      status: response.status,
      statusText: response.statusText,
      duration: `${duration}ms`,
      headers: {
        contentType: response.headers.get('content-type'),
      },
    })

    const data = await response.json()

    console.log('[Scene Image] API 响应数据', {
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
      console.error('[Scene Image] 图片生成失败', {
        errorMessage: data.errorMessage,
        failedReason: data.failedReason,
        fullResponse: data,
      })
      return NextResponse.json(
        { error: data.errorMessage || data.failedReason || '图片生成失败' },
        { status: 500 }
      )
    }

    // 如果是排队或运行中，返回任务 ID 让前端轮询
    if (data.status === 'QUEUED' || data.status === 'RUNNING') {
      console.log('[Scene Image] 任务进行中', {
        status: data.status,
        taskId: data.taskId,
      })

      // 保存 taskId 到数据库，以便恢复轮询
      await prisma.scene.update({
        where: { id: sceneId },
        data: { imageTaskId: data.taskId },
      })

      return NextResponse.json({
        status: data.status,
        taskId: data.taskId,
        message: data.status === 'QUEUED' ? '任务排队中...' : '图片生成中...',
      })
    }

    // 成功，提取图片 URL
    const imageUrl = data.results?.[0]?.url

    if (!imageUrl) {
      console.error('[Scene Image] 未获取到图片 URL', {
        results: data.results,
        fullResponse: data,
      })
      return NextResponse.json(
        { error: '未获取到图片 URL' },
        { status: 500 }
      )
    }

    console.log('[Scene Image] 图片生成成功', {
      imageUrl,
      usage: data.usage,
    })

    // 更新数据库
    await prisma.scene.update({
      where: { id: sceneId },
      data: {
        imageUrl,
        imageTaskId: null,  // 清除 taskId
      },
    })

    console.log('[Scene Image] 数据库更新成功', { sceneId, imageUrl })

    return NextResponse.json({
      status: 'SUCCESS',
      imageUrl,
      usage: data.usage,
    })
  } catch (error) {
    console.error('[Scene Image] 异常错误', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: '图片生成服务异常' },
      { status: 500 }
    )
  }
}
