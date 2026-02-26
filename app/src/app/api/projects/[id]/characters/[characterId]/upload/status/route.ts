import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRunningHubApiKey } from '@/lib/config'

interface Props {
  params: Promise<{ id: string; characterId: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { characterId } = await params
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json(
      { error: '缺少 taskId 参数' },
      { status: 400 }
    )
  }

  const apiKey = await getRunningHubApiKey()

  try {
    // 使用正确的查询接口
    const queryUrl = 'https://www.runninghub.cn/openapi/v2/query'

    console.log('[Character Upload] 查询任务状态', { taskId, queryUrl })

    const queryResponse = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId,
      }),
    })

    const responseText = await queryResponse.text()
    console.log('[Character Upload] 查询响应原始文本', {
      taskId,
      responseText,
      responseLength: responseText.length,
    })

    let data
    try {
      data = JSON.parse(responseText)
    } catch (error) {
      console.error('[Character Upload] JSON 解析失败', {
        error: error instanceof Error ? error.message : String(error),
        responseText: responseText.substring(0, 500),
      })
      return NextResponse.json({
        status: 'FAILED',
        error: 'API 返回数据格式错误',
      })
    }

    console.log('[Character Upload] 查询响应数据（完整）', {
      taskId,
      status: data.status,
      results: data.results,
      errorMessage: data.errorMessage,
      errorCode: data.errorCode,
      fullResponse: JSON.stringify(data, null, 2),
    })

    // 检查状态
    if (data.status === 'FAILED') {
      console.error('[Character Upload] 任务失败', {
        errorMessage: data.errorMessage,
        errorCode: data.errorCode,
      })
      return NextResponse.json({
        status: 'FAILED',
        error: data.errorMessage || '角色上传失败',
      })
    }

    // 如果是排队或运行中
    if (data.status === 'QUEUED' || data.status === 'RUNNING') {
      return NextResponse.json({
        status: data.status,
        taskId,
        message: data.status === 'QUEUED' ? '任务排队中...' : '上传中...',
      })
    }

    // 如果成功，提取角色 ID
    if (data.status === 'SUCCESS') {
      const soraCharacterId = data.results?.[0]?.text

      console.log('[Character Upload] 提取角色 ID', {
        soraCharacterId,
        hasResults: !!data.results,
        resultsLength: data.results?.length,
        firstResult: data.results?.[0],
      })

      if (!soraCharacterId) {
        console.error('[Character Upload] 未获取到角色 ID', {
          results: data.results,
          fullResponse: data,
        })
        return NextResponse.json({
          status: 'FAILED',
          error: '未获取到角色 ID',
        })
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
    }

    // 未知状态
    return NextResponse.json({
      status: data.status,
      message: '未知状态',
    })
  } catch (error) {
    console.error('[Character Upload] 查询任务状态异常', error)
    return NextResponse.json(
      { error: '查询任务状态失败' },
      { status: 500 }
    )
  }
}
