import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRunningHubApiKey } from '@/lib/config'

interface Props {
  params: Promise<{ id: string; propId: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { propId } = await params
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json({ error: '缺少 taskId 参数' }, { status: 400 })
  }

  const apiKey = await getRunningHubApiKey()

  try {
    const statusUrl = 'https://www.runninghub.cn/task/openapi/status'
    console.log('[Prop Image] 查询任务状态', { taskId })

    const statusResponse = await fetch(statusUrl, {
      method: 'POST',
      headers: {
        'Host': 'www.runninghub.cn',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey, taskId }),
    })

    const statusData = await statusResponse.json()
    console.log('[Prop Image] 任务状态响应', {
      taskId,
      code: statusData.code,
      status: statusData.data,
    })

    if (statusData.code !== 0) {
      return NextResponse.json({
        status: 'FAILED',
        error: statusData.msg || '查询任务状态失败',
      })
    }

    const taskStatus = statusData.data

    if (taskStatus === 'QUEUED' || taskStatus === 'RUNNING') {
      return NextResponse.json({
        status: taskStatus,
        taskId,
        message: taskStatus === 'QUEUED' ? '任务排队中...' : '图片生成中...',
      })
    }

    if (taskStatus === 'FAILED') {
      return NextResponse.json({ status: 'FAILED', error: '图片生成失败' })
    }

    if (taskStatus === 'SUCCESS') {
      const outputsUrl = 'https://www.runninghub.cn/task/openapi/outputs'
      console.log('[Prop Image] 获取任务结果', { taskId })

      const outputsResponse = await fetch(outputsUrl, {
        method: 'POST',
        headers: {
          'Host': 'www.runninghub.cn',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey, taskId }),
      })

      const outputsData = await outputsResponse.json()
      console.log('[Prop Image] 任务结果响应', {
        taskId,
        code: outputsData.code,
        dataCount: outputsData.data?.length || 0,
      })

      if (outputsData.code !== 0) {
        return NextResponse.json({
          status: 'FAILED',
          error: outputsData.msg || '获取任务结果失败',
        })
      }

      const imageUrl = outputsData.data?.[0]?.fileUrl

      if (!imageUrl) {
        return NextResponse.json({ status: 'FAILED', error: '未获取到图片 URL' })
      }

      console.log('[Prop Image] 图片生成成功', { imageUrl })

      await prisma.prop.update({
        where: { id: propId },
        data: { imageUrl, imageTaskId: null },
      })

      return NextResponse.json({
        status: 'SUCCESS',
        imageUrl,
        usage: {
          consumeCoins: outputsData.data?.[0]?.consumeCoins,
          taskCostTime: outputsData.data?.[0]?.taskCostTime,
        },
      })
    }

    return NextResponse.json({ status: taskStatus, message: '未知状态' })
  } catch (error) {
    console.error('[Prop Image] 查询任务状态异常', error)
    return NextResponse.json({ error: '查询任务状态失败' }, { status: 500 })
  }
}
