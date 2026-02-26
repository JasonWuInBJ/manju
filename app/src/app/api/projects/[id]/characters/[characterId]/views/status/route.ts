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
    // 1. 先查询任务状态
    const statusUrl = 'https://www.runninghub.cn/task/openapi/status'

    console.log('[Four View] 查询任务状态', { taskId })

    const statusResponse = await fetch(statusUrl, {
      method: 'POST',
      headers: {
        'Host': 'www.runninghub.cn',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey,
        taskId,
      }),
    })

    const statusData = await statusResponse.json()

    console.log('[Four View] 任务状态响应', {
      taskId,
      code: statusData.code,
      status: statusData.data,
      msg: statusData.msg,
    })

    if (statusData.code !== 0) {
      return NextResponse.json({
        status: 'FAILED',
        error: statusData.msg || '查询任务状态失败',
      })
    }

    const taskStatus = statusData.data // "QUEUED", "RUNNING", "FAILED", "SUCCESS"

    // 如果是排队或运行中
    if (taskStatus === 'QUEUED' || taskStatus === 'RUNNING') {
      return NextResponse.json({
        status: taskStatus,
        taskId,
        message: taskStatus === 'QUEUED' ? '任务排队中...' : '四视图生成中...',
      })
    }

    // 如果失败
    if (taskStatus === 'FAILED') {
      return NextResponse.json({
        status: 'FAILED',
        error: '四视图生成失败',
      })
    }

    // 如果成功，获取任务结果
    if (taskStatus === 'SUCCESS') {
      const outputsUrl = 'https://www.runninghub.cn/task/openapi/outputs'

      console.log('[Four View] 获取任务结果', { taskId })

      const outputsResponse = await fetch(outputsUrl, {
        method: 'POST',
        headers: {
          'Host': 'www.runninghub.cn',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          taskId,
        }),
      })

      const outputsData = await outputsResponse.json()

      console.log('[Four View] 任务结果响应', {
        taskId,
        code: outputsData.code,
        msg: outputsData.msg,
        dataCount: outputsData.data?.length || 0,
      })

      if (outputsData.code !== 0) {
        return NextResponse.json({
          status: 'FAILED',
          error: outputsData.msg || '获取任务结果失败',
        })
      }

      // 提取图片 URL
      const fourViewImageUrl = outputsData.data?.[0]?.fileUrl

      if (!fourViewImageUrl) {
        return NextResponse.json({
          status: 'FAILED',
          error: '未获取到四视图 URL',
        })
      }

      console.log('[Four View] 四视图生成成功', { fourViewImageUrl })

      // 更新数据库
      await prisma.character.update({
        where: { id: characterId },
        data: { fourViewImageUrl },
      })

      return NextResponse.json({
        status: 'SUCCESS',
        fourViewImageUrl,
        usage: {
          consumeCoins: outputsData.data?.[0]?.consumeCoins,
          taskCostTime: outputsData.data?.[0]?.taskCostTime,
        },
      })
    }

    // 未知状态
    return NextResponse.json({
      status: taskStatus,
      message: '未知状态',
    })
  } catch (error) {
    console.error('[Four View] 查询任务状态异常', error)
    return NextResponse.json(
      { error: '查询任务状态失败' },
      { status: 500 }
    )
  }
}
