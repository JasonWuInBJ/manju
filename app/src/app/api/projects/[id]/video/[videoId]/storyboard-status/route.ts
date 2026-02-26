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

    if (!video || !video.storyboardTaskId) {
      return NextResponse.json({ error: 'No task found' }, { status: 404 })
    }

    // Poll RunningHub status
    const statusUrl = `https://www.runninghub.cn/task/openapi/status?taskId=${video.storyboardTaskId}`

    const response = await fetch(statusUrl, {
      headers: {
        'Authorization': `Bearer ${await getRunningHubApiKey()}`,
      },
    })

    const data = await response.json()

    console.log('[Storyboard Status] Poll result:', data)

    // If success, get outputs
    if (data.status === 'SUCCESS') {
      const outputsUrl = `https://www.runninghub.cn/task/openapi/outputs?taskId=${video.storyboardTaskId}`
      const outputsResponse = await fetch(outputsUrl, {
        headers: {
          'Authorization': `Bearer ${await getRunningHubApiKey()}`,
        },
      })

      const outputsData = await outputsResponse.json()
      const storyboardUrl = outputsData.results?.[0]?.url

      if (storyboardUrl) {
        // Update database
        await prisma.video.update({
          where: { id: videoId },
          data: {
            storyboardUrl,
            storyboardTaskId: null,
          },
        })

        console.log('[Storyboard Status] Success, URL:', storyboardUrl)

        return NextResponse.json({
          status: 'SUCCESS',
          storyboardUrl,
        })
      }
    }

    return NextResponse.json({
      status: data.status,
      taskId: video.storyboardTaskId,
    })
  } catch (error) {
    console.error('[Storyboard Status] Error', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
