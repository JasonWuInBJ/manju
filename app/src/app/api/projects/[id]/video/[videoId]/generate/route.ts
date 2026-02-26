import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRunningHubApiKey } from '@/lib/config'

interface Props {
  params: Promise<{ id: string; videoId: string }>
}

export async function POST(request: Request, { params }: Props) {
  const { videoId } = await params
  const body = await request.json()
  const { duration = '15', aspectRatio = '16:9', prompt } = body

  console.log('[Video Generate] Starting generation', { videoId, duration, aspectRatio, hasPrompt: !!prompt })

  try {
    // Get video record
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { script: true },
    })

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Check for composite image first (new workflow), then fall back to storyboard (old workflow)
    const imageUrl = video.compositeImageUrl || video.storyboardUrl || video.storyboardImageBase64

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Please generate composite image first' },
        { status: 400 }
      )
    }

    // Use user-provided prompt if available, otherwise fall back to script content
    const videoPrompt = prompt || video.script?.content || ''

    if (!videoPrompt) {
      return NextResponse.json(
        { error: 'Please provide a prompt or select a script' },
        { status: 400 }
      )
    }

    // RunningHub has a 4000 character limit on prompt
    const MAX_PROMPT_LENGTH = 4000
    const trimmedPrompt = videoPrompt.length > MAX_PROMPT_LENGTH
      ? videoPrompt.slice(0, MAX_PROMPT_LENGTH)
      : videoPrompt

    if (videoPrompt.length > MAX_PROMPT_LENGTH) {
      console.log(`[Video Generate] Prompt truncated from ${videoPrompt.length} to ${MAX_PROMPT_LENGTH} chars`)
    }

    // Call RunningHub API
    const apiUrl = 'https://www.runninghub.cn/openapi/v2/rhart-video-s/image-to-video-pro'

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getRunningHubApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: trimmedPrompt,
        imageUrl: imageUrl,
        duration,
        aspectRatio,
      }),
    })

    const responseText = await response.text()
    console.log('[Video Generate] Raw response:', responseText.substring(0, 500))

    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('[Video Generate] Failed to parse response:', responseText.substring(0, 500))
      return NextResponse.json(
        { error: 'Invalid response from video service' },
        { status: 500 }
      )
    }

    console.log('[Video Generate] API response', {
      status: data.status,
      taskId: data.taskId,
    })

    if (!response.ok || data.errorCode) {
      return NextResponse.json(
        { error: data.errorMessage || 'Video generation failed' },
        { status: 500 }
      )
    }

    // Handle different statuses
    if (data.status === 'FAILED') {
      return NextResponse.json(
        { error: data.errorMessage || 'Video generation failed' },
        { status: 500 }
      )
    }

    if (data.status === 'QUEUED' || data.status === 'RUNNING') {
      // Save task ID for polling
      await prisma.video.update({
        where: { id: videoId },
        data: {
          videoTaskId: data.taskId,
          videoPrompt: videoPrompt,
        },
      })

      return NextResponse.json({
        status: data.status,
        taskId: data.taskId,
        message: data.status === 'QUEUED' ? 'Task queued...' : 'Generating video...',
      })
    }

    // Success - extract video URL
    const videoUrl = data.results?.[0]?.url

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'No video URL in response' },
        { status: 500 }
      )
    }

    // Update database
    await prisma.video.update({
      where: { id: videoId },
      data: {
        videoUrl,
        videoTaskId: null,
        videoPrompt: videoPrompt,
      },
    })

    return NextResponse.json({
      status: 'SUCCESS',
      videoUrl,
    })
  } catch (error) {
    console.error('[Video Generate] Error', error)
    return NextResponse.json(
      { error: 'Video generation service error' },
      { status: 500 }
    )
  }
}
