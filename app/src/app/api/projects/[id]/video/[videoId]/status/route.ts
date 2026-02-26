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

    if (!video || !video.videoTaskId) {
      return NextResponse.json({ error: 'No task found' }, { status: 404 })
    }

    // Poll RunningHub status
    const statusUrl = `https://www.runninghub.cn/task/openapi/status?taskId=${video.videoTaskId}`

    const response = await fetch(statusUrl, {
      headers: {
        'Authorization': `Bearer ${await getRunningHubApiKey()}`,
      },
    })

    const data = await response.json()

    // If success, get outputs
    if (data.status === 'SUCCESS') {
      const outputsUrl = `https://www.runninghub.cn/task/openapi/outputs?taskId=${video.videoTaskId}`
      const outputsResponse = await fetch(outputsUrl, {
        headers: {
          'Authorization': `Bearer ${await getRunningHubApiKey()}`,
        },
      })

      const outputsData = await outputsResponse.json()
      const videoUrl = outputsData.results?.[0]?.url

      if (videoUrl) {
        // Update database
        await prisma.video.update({
          where: { id: videoId },
          data: {
            videoUrl,
            videoTaskId: null,
          },
        })

        return NextResponse.json({
          status: 'SUCCESS',
          videoUrl,
        })
      }
    }

    return NextResponse.json({
      status: data.status,
      taskId: video.videoTaskId,
    })
  } catch (error) {
    console.error('[Video Status] Error', error)
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    )
  }
}
