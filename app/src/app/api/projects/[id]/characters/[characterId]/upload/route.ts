import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRunningHubApiKey } from '@/lib/config'

interface Props {
  params: Promise<{ id: string; characterId: string }>
}

// 上传角色视频获取 Sora 角色 ID
export async function POST(request: Request, { params }: Props) {
  const { characterId } = await params

  console.log('[Character Upload] 开始上传角色', { characterId })

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

    if (!character.characterVideoUrl) {
      return NextResponse.json(
        { error: '请先生成角色视频' },
        { status: 400 }
      )
    }

    const apiUrl = 'https://www.runninghub.cn/openapi/v2/rhart-video-s/sora-upload-character'

    console.log('[Character Upload] 调用 RunningHub API', {
      apiUrl,
      videoUrl: character.characterVideoUrl,
    })

    const startTime = Date.now()

    // 调用 RunningHub 角色上传 API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getRunningHubApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoUrl: character.characterVideoUrl,
      }),
    })

    const duration = Date.now() - startTime

    console.log('[Character Upload] API 响应状态', {
      status: response.status,
      statusText: response.statusText,
      duration: `${duration}ms`,
      headers: {
        contentType: response.headers.get('content-type'),
      },
    })

    if (!response.ok) {
      console.error('[Character Upload] HTTP 响应失败', {
        status: response.status,
        statusText: response.statusText,
      })
    }

    const responseText = await response.text()
    console.log('[Character Upload] API 原始响应文本', {
      responseText,
      length: responseText.length,
    })

    let data
    try {
      data = JSON.parse(responseText)
    } catch (error) {
      console.error('[Character Upload] JSON 解析失败', {
        error: error instanceof Error ? error.message : String(error),
        responseText: responseText.substring(0, 500),
      })
      throw new Error('API 返回的数据格式错误')
    }

    console.log('[Character Upload] API 响应数据（完整）', {
      status: data.status,
      taskId: data.taskId,
      errorMessage: data.errorMessage,
      errorCode: data.errorCode,
      results: data.results,
      clientId: data.clientId,
      promptTips: data.promptTips,
      failedReason: data.failedReason,
      usage: data.usage,
      allKeys: Object.keys(data),
      fullResponse: JSON.stringify(data, null, 2),
    })

    // 检查 HTTP 响应状态
    if (!response.ok) {
      console.error('[Character Upload] HTTP 请求失败', {
        httpStatus: response.status,
        data,
      })
      return NextResponse.json(
        { error: data.errorMessage || data.message || data.error || '角色上传请求失败' },
        { status: 500 }
      )
    }

    // 检查状态
    if (data.status === 'FAILED') {
      console.error('[Character Upload] 角色上传失败', {
        errorMessage: data.errorMessage,
        errorCode: data.errorCode,
      })
      return NextResponse.json(
        { error: data.errorMessage || '角色上传失败' },
        { status: 500 }
      )
    }

    // 如果是排队或运行中，返回任务 ID 让前端轮询
    if (data.status === 'QUEUED' || data.status === 'RUNNING') {
      console.log('[Character Upload] 任务进行中', {
        status: data.status,
        taskId: data.taskId,
      })
      return NextResponse.json({
        status: data.status,
        taskId: data.taskId,
        message: data.status === 'QUEUED' ? '任务排队中...' : '上传中...',
      })
    }

    // 成功，提取角色 ID
    const soraCharacterId = data.results?.[0]?.text

    console.log('[Character Upload] 尝试提取角色 ID', {
      hasResults: !!data.results,
      resultsLength: data.results?.length,
      firstResult: data.results?.[0],
      soraCharacterId,
    })

    if (!soraCharacterId) {
      console.error('[Character Upload] 未获取到角色 ID', {
        results: data.results,
        fullResponse: data,
      })
      return NextResponse.json(
        { error: '未获取到角色 ID' },
        { status: 500 }
      )
    }

    console.log('[Character Upload] 角色上传成功', { soraCharacterId })

    // 更新数据库
    await prisma.character.update({
      where: { id: characterId },
      data: { soraCharacterId },
    })

    return NextResponse.json({
      status: 'SUCCESS',
      soraCharacterId,
    })
  } catch (error) {
    console.error('[Character Upload] 异常错误', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
    })

    // 返回更详细的错误信息
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: '角色上传服务异常',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}
