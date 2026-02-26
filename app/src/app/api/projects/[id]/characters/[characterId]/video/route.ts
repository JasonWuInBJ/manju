import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRunningHubApiKey } from '@/lib/config'

interface Props {
  params: Promise<{ id: string; characterId: string }>
}

// 图生视频 API
export async function POST(request: Request, { params }: Props) {
  const { characterId } = await params
  const body = await request.json()
  const { prompt = '', duration = '15', aspectRatio = '9:16' } = body

  console.log('[Character Video] 开始生成视频', {
    characterId,
    duration,
    aspectRatio,
    promptLength: prompt?.length || 0,
  })

  try {
    // 获取角色信息
    const character = await prisma.character.findUnique({
      where: { id: characterId },
    })

    if (!character) {
      return NextResponse.json(
        { error: '角色不存在' },
        { status: 404 }
      )
    }

    if (!character.imageUrl) {
      return NextResponse.json(
        { error: '请先生成角色图片' },
        { status: 400 }
      )
    }

    const apiUrl = 'https://www.runninghub.cn/openapi/v2/rhart-video-s/image-to-video-pro'

    console.log('[Character Video] 调用 RunningHub API', {
      apiUrl,
      imageUrl: character.imageUrl,
      prompt,
      duration,
      aspectRatio,
    })

    const startTime = Date.now()

    // 调用 RunningHub 图生视频 API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getRunningHubApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        imageUrl: character.imageUrl,
        duration,
        aspectRatio,
      }),
    })

    const durationMs = Date.now() - startTime

    console.log('[Character Video] API 响应状态', {
      status: response.status,
      statusText: response.statusText,
      duration: `${durationMs}ms`,
    })

    const data = await response.json()

    console.log('[Character Video] API 响应数据', {
      status: data.status,
      taskId: data.taskId,
      errorMessage: data.errorMessage,
      failedReason: data.failedReason,
      fullResponse: JSON.stringify(data),
    })

    // 检查 HTTP 响应状态
    if (!response.ok) {
      console.error('[Character Video] HTTP 请求失败', {
        httpStatus: response.status,
        data,
      })
      return NextResponse.json(
        { error: data.errorMessage || data.message || data.error || '视频生成请求失败' },
        { status: 500 }
      )
    }

    // 检查状态
    if (data.status === 'FAILED') {
      console.error('[Character Video] 视频生成失败', {
        errorMessage: data.errorMessage,
        failedReason: data.failedReason,
      })
      return NextResponse.json(
        { error: data.errorMessage || data.failedReason || '视频生成失败' },
        { status: 500 }
      )
    }

    // 如果是排队或运行中，返回任务 ID 让前端轮询
    if (data.status === 'QUEUED' || data.status === 'RUNNING') {
      console.log('[Character Video] 任务进行中', {
        status: data.status,
        taskId: data.taskId,
      })

      // 保存 taskId 到数据库，以便页面刷新后恢复轮询
      await prisma.character.update({
        where: { id: characterId },
        data: { characterVideoTaskId: data.taskId },
      })

      return NextResponse.json({
        status: data.status,
        taskId: data.taskId,
        message: data.status === 'QUEUED' ? '任务排队中...' : '视频生成中...',
      })
    }

    // 成功，提取视频 URL
    const videoUrl = data.results?.[0]?.url

    if (!videoUrl) {
      console.error('[Character Video] 未获取到视频 URL', {
        results: data.results,
      })
      return NextResponse.json(
        { error: '未获取到视频 URL' },
        { status: 500 }
      )
    }

    console.log('[Character Video] 视频生成成功', { videoUrl })

    // 更新数据库，清除 taskId
    await prisma.character.update({
      where: { id: characterId },
      data: {
        characterVideoUrl: videoUrl,
        characterVideoTaskId: null,
      },
    })

    return NextResponse.json({
      status: 'SUCCESS',
      videoUrl,
    })
  } catch (error) {
    console.error('[Character Video] 异常错误', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
    })

    // 返回更详细的错误信息
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: '视频生成服务异常',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}
