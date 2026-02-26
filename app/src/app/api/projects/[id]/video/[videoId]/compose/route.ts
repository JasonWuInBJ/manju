import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRunningHubApiKey } from '@/lib/config'
import { generateStoryboardPrompt } from '@/lib/storyboard-prompt-generator'

interface Props {
  params: Promise<{ id: string; videoId: string }>
}

export async function POST(request: Request, { params }: Props) {
  const { id, videoId } = await params
  const body = await request.json()
  const { characterIds, sceneIds, layoutType } = body

  console.log('[Video Compose] Starting composition', {
    projectId: id,
    videoId,
    characterIds,
    sceneIds,
    layoutType,
  })

  try {
    // Fetch video with script
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { script: true },
    })

    // Fetch character data
    const characters = await prisma.character.findMany({
      where: { id: { in: characterIds }, projectId: id },
      select: { id: true, name: true, description: true, imageUrl: true },
    })

    // Fetch scene data
    const scenes = await prisma.scene.findMany({
      where: { id: { in: sceneIds }, projectId: id },
      select: { id: true, name: true, description: true, imageUrl: true },
    })

    // Collect image URLs
    const imageUrls: string[] = []
    characterIds.forEach((id: string) => {
      const char = characters.find(c => c.id === id)
      if (char?.imageUrl) imageUrls.push(char.imageUrl)
    })
    sceneIds.forEach((id: string) => {
      const scene = scenes.find(s => s.id === id)
      if (scene?.imageUrl) imageUrls.push(scene.imageUrl)
    })

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'No images found for selected characters/scenes' },
        { status: 400 }
      )
    }

    // Generate prompt
    const prompt = generateStoryboardPrompt({
      characters,
      scenes,
      style: 'cel-shaded anime style',
    })

    console.log('[Video Compose] Generated prompt:', prompt)

    // Call RunningHub API
    const response = await fetch('https://www.runninghub.cn/openapi/v2/rhart-image-n-pro/edit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getRunningHubApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        resolution: '1k',
        aspectRatio: '3:2',
        imageUrls,
      }),
    })

    const data = await response.json()

    console.log('[Video Compose] RunningHub response:', data)

    if (!response.ok) {
      return NextResponse.json(
        { error: data.errorMessage || 'Storyboard generation failed' },
        { status: 500 }
      )
    }

    // Handle different statuses
    if (data.status === 'FAILED') {
      return NextResponse.json(
        { error: data.errorMessage || data.failedReason || 'Failed' },
        { status: 500 }
      )
    }

    if (data.status === 'QUEUED' || data.status === 'RUNNING') {
      // Save task ID for polling
      await prisma.video.update({
        where: { id: videoId },
        data: {
          storyboardTaskId: data.taskId,
          selectedCharacterIds: JSON.stringify(characterIds),
          selectedSceneIds: JSON.stringify(sceneIds),
          layoutType,
        },
      })

      console.log('[Video Compose] Task queued/running:', data.taskId)

      return NextResponse.json({
        status: data.status,
        taskId: data.taskId,
        message: data.status === 'QUEUED' ? 'Task queued...' : 'Generating storyboard...',
      })
    }

    // SUCCESS - extract storyboard URL
    const storyboardUrl = data.results?.[0]?.url

    if (!storyboardUrl) {
      return NextResponse.json({ error: 'No storyboard URL in response' }, { status: 500 })
    }

    // Update database
    const updatedVideo = await prisma.video.update({
      where: { id: videoId },
      data: {
        storyboardUrl,
        storyboardTaskId: null,
        selectedCharacterIds: JSON.stringify(characterIds),
        selectedSceneIds: JSON.stringify(sceneIds),
        layoutType,
      },
    })

    console.log('[Video Compose] Composition successful', {
      videoId,
      storyboardUrl,
    })

    return NextResponse.json(updatedVideo)
  } catch (error) {
    console.error('[Video Compose] Error', error)
    return NextResponse.json(
      { error: 'Failed to compose storyboard' },
      { status: 500 }
    )
  }
}
