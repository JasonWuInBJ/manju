import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRunningHubApiKey } from '@/lib/config'

interface Props {
  params: Promise<{ id: string; videoId: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { videoId } = await params

  try {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    })

    if (!video || !video.compositeImageTaskId) {
      return NextResponse.json({ error: 'No task found' }, { status: 404 })
    }

    const apiKey = await getRunningHubApiKey()
    const taskId = video.compositeImageTaskId

    // 1. Query task status
    const statusUrl = 'https://www.runninghub.cn/task/openapi/status'

    console.log('[Composite Image Status] Querying task status', { taskId })

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

    console.log('[Composite Image Status] Status response', {
      taskId,
      code: statusData.code,
      status: statusData.data,
      msg: statusData.msg,
    })

    if (statusData.code !== 0) {
      return NextResponse.json({
        status: 'FAILED',
        error: statusData.msg || 'Failed to query task status',
      })
    }

    const taskStatus = statusData.data // "QUEUED", "RUNNING", "FAILED", "SUCCESS"

    // If queued or running
    if (taskStatus === 'QUEUED' || taskStatus === 'RUNNING') {
      return NextResponse.json({
        status: taskStatus,
        taskId,
        message: taskStatus === 'QUEUED' ? 'Task queued...' : 'Generating composite image...',
      })
    }

    // If failed
    if (taskStatus === 'FAILED') {
      return NextResponse.json({
        status: 'FAILED',
        error: 'Composite image generation failed',
      })
    }

    // If success, get outputs
    if (taskStatus === 'SUCCESS') {
      const outputsUrl = 'https://www.runninghub.cn/task/openapi/outputs'

      console.log('[Composite Image Status] Getting task outputs', { taskId })

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

      console.log('[Composite Image Status] Outputs response', {
        taskId,
        code: outputsData.code,
        msg: outputsData.msg,
        dataCount: outputsData.data?.length || 0,
      })

      if (outputsData.code !== 0) {
        return NextResponse.json({
          status: 'FAILED',
          error: outputsData.msg || 'Failed to get task outputs',
        })
      }

      // Extract image URL
      const compositeImageUrl = outputsData.data?.[0]?.fileUrl

      if (!compositeImageUrl) {
        return NextResponse.json({
          status: 'FAILED',
          error: 'No image URL in response',
        })
      }

      console.log('[Composite Image Status] Success, URL:', compositeImageUrl)

      // Update database
      await prisma.video.update({
        where: { id: videoId },
        data: {
          compositeImageUrl,
          compositeImageTaskId: null,
        },
      })

      return NextResponse.json({
        status: 'SUCCESS',
        compositeImageUrl,
        usage: {
          consumeCoins: outputsData.data?.[0]?.consumeCoins,
          taskCostTime: outputsData.data?.[0]?.taskCostTime,
        },
      })
    }

    // Unknown status
    return NextResponse.json({
      status: taskStatus,
      message: 'Unknown status',
    })
  } catch (error) {
    console.error('[Composite Image Status] Error', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
