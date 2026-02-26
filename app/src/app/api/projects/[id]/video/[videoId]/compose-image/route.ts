import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRunningHubApiKey } from '@/lib/config'
import { generateCompositeImagePrompt } from '@/lib/composite-image-prompt-generator'

interface Props {
  params: Promise<{ id: string; videoId: string }>
}

export async function POST(request: Request, { params }: Props) {
  const { id, videoId } = await params
  const body = await request.json()
  const { characterIds, sceneIds, customPrompt, systemPrompt } = body

  console.log('[Compose Image] Starting composition', {
    projectId: id,
    videoId,
    characterIds,
    sceneIds,
    hasCustomPrompt: !!customPrompt,
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

    if (characters.length === 0 || scenes.length === 0) {
      return NextResponse.json(
        { error: 'No characters or scenes found' },
        { status: 400 }
      )
    }

    // Collect image URLs from characters and scenes
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

    // Generate prompt for composite image - use custom prompt if provided, otherwise auto-generate
    let prompt: string
    if (customPrompt) {
      // If systemPrompt exists, prepend it to customPrompt
      prompt = systemPrompt
        ? `${systemPrompt}\n\n${customPrompt}`
        : customPrompt
    } else {
      prompt = generateCompositeImagePrompt({
        characters,
        scenes,
        script: video?.script || undefined,
        style: 'cel-shaded anime style',
      })
    }

    console.log('[Compose Image] Using prompt:', customPrompt ? 'Custom' : 'Auto-generated')
    console.log('[Compose Image] Generated prompt:', prompt)
    console.log('[Compose Image] Image URLs:', imageUrls)

    // Call RunningHub image-to-image API (图生图)
    const apiUrl = 'https://www.runninghub.cn/openapi/v2/rhart-image-n-pro/edit'

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getRunningHubApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        resolution: '1k',
        aspectRatio: '16:9',
        imageUrls,
      }),
    })

    const responseText = await response.text()
    console.log('[Compose Image] Raw response:', responseText.substring(0, 500))

    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('[Compose Image] Failed to parse response:', responseText.substring(0, 500))
      return NextResponse.json(
        { error: 'Invalid response from image service' },
        { status: 500 }
      )
    }

    console.log('[Compose Image] RunningHub response:', {
      status: data.status,
      taskId: data.taskId,
      errorMessage: data.errorMessage,
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: data.errorMessage || 'Composite image generation failed' },
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
          compositeImageTaskId: data.taskId,
          selectedCharacterIds: JSON.stringify(characterIds),
          selectedSceneIds: JSON.stringify(sceneIds),
        },
      })

      console.log('[Compose Image] Task queued/running:', data.taskId)

      return NextResponse.json({
        status: data.status,
        taskId: data.taskId,
        message: data.status === 'QUEUED' ? 'Task queued...' : 'Generating composite image...',
      })
    }

    // SUCCESS - extract composite image URL
    const compositeImageUrl = data.results?.[0]?.url

    if (!compositeImageUrl) {
      return NextResponse.json({ error: 'No image URL in response' }, { status: 500 })
    }

    // Update database
    const updatedVideo = await prisma.video.update({
      where: { id: videoId },
      data: {
        compositeImageUrl,
        compositeImageTaskId: null,
        selectedCharacterIds: JSON.stringify(characterIds),
        selectedSceneIds: JSON.stringify(sceneIds),
      },
    })

    console.log('[Compose Image] Composition successful', {
      videoId,
      compositeImageUrl,
    })

    return NextResponse.json(updatedVideo)
  } catch (error) {
    console.error('[Compose Image] Error', error)
    return NextResponse.json(
      { error: 'Failed to compose image' },
      { status: 500 }
    )
  }
}
