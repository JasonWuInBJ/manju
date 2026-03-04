import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateCompositeImagePrompt } from '@/lib/composite-image-prompt-generator'
import { getRunningHubApiKey } from '@/lib/config'

interface Props {
  params: Promise<{ id: string; videoId: string }>
}

// List all assets for a video
export async function GET(request: Request, { params }: Props) {
  const { videoId } = await params

  const assets = await prisma.videoAsset.findMany({
    where: { videoId },
    orderBy: [
      { type: 'asc' },
      { version: 'desc' }
    ]
  })

  return NextResponse.json(assets)
}

// Create/generate an asset
export async function POST(request: Request, { params }: Props) {
  const { id: projectId, videoId } = await params
  const body = await request.json()
  const { type, duration, aspectRatio, prompt, propIds } = body

  console.log('[Asset Create] Starting', {
    projectId,
    videoId,
    type,
    duration,
    aspectRatio,
    hasPrompt: !!prompt,
  })

  if (!type || !['composite_image', 'video'].includes(type)) {
    return NextResponse.json(
      { error: 'Invalid type. Must be "composite_image" or "video"' },
      { status: 400 }
    )
  }

  try {
    // Fetch video with relations
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { script: true },
    })

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Get current max version for this type
    const existingAssets = await prisma.videoAsset.findMany({
      where: { videoId, type },
      select: { version: true },
    })
    const nextVersion = existingAssets.length > 0
      ? Math.max(...existingAssets.map(a => a.version)) + 1
      : 1

    if (type === 'composite_image') {
      return await handleCompositeImageGeneration(
        projectId, videoId, video, prompt, nextVersion, aspectRatio, propIds
      )
    } else if (type === 'video') {
      return await handleVideoGeneration(
        videoId, video, prompt, duration || 15, aspectRatio || '16:9', nextVersion
      )
    }
  } catch (error) {
    console.error('[Asset Create] Error', error)
    return NextResponse.json(
      { error: 'Asset generation failed' },
      { status: 500 }
    )
  }
}

async function handleCompositeImageGeneration(
  projectId: string,
  videoId: string,
  video: { selectedCharacterIds: string | null; selectedSceneIds: string | null; script: { content: string } | null },
  customPrompt: string | undefined,
  version: number,
  aspectRatio: string | undefined,
  propIds: string[] | undefined
) {
  // Get API key from config
  const apiKey = await getRunningHubApiKey()

  // Parse selected IDs
  const characterIds = video.selectedCharacterIds ? JSON.parse(video.selectedCharacterIds) : []
  const sceneIds = video.selectedSceneIds ? JSON.parse(video.selectedSceneIds) : []
  const selectedPropIds = propIds || []

  if (characterIds.length === 0 && sceneIds.length === 0) {
    return NextResponse.json(
      { error: 'No characters or scenes selected' },
      { status: 400 }
    )
  }

  // Fetch character and scene data
  const characters = await prisma.character.findMany({
    where: { id: { in: characterIds }, projectId },
    select: { id: true, name: true, description: true, imageUrl: true },
  })

  const scenes = await prisma.scene.findMany({
    where: { id: { in: sceneIds }, projectId },
    select: { id: true, name: true, description: true, imageUrl: true },
  })

  // Fetch selected props (with images) or all props (for prompt context)
  const propsWithImages = selectedPropIds.length > 0
    ? await prisma.prop.findMany({
        where: { id: { in: selectedPropIds }, projectId },
        select: { id: true, name: true, description: true, imageUrl: true },
      })
    : []

  const allProps = await prisma.prop.findMany({
    where: { projectId },
    select: { name: true, description: true },
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
  propsWithImages.forEach(prop => {
    if (prop.imageUrl) imageUrls.push(prop.imageUrl)
  })

  if (imageUrls.length === 0) {
    return NextResponse.json(
      { error: 'No images found for selected characters/scenes' },
      { status: 400 }
    )
  }

  // Generate prompt
  let promptToUse: string
  if (customPrompt) {
    promptToUse = customPrompt
  } else {
    promptToUse = generateCompositeImagePrompt({
      characters,
      scenes,
      props: allProps,
      script: video.script || undefined,
      style: 'cel-shaded anime style',
    })
  }

  console.log('[Asset Create] Generated prompt:', promptToUse)

  // Call RunningHub API
  const apiUrl = 'https://www.runninghub.cn/openapi/v2/rhart-image-n-pro/edit'

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: promptToUse,
      resolution: '1k',
      aspectRatio: aspectRatio || '16:9',
      imageUrls,
    }),
  })

  const responseText = await response.text()
  console.log('[Asset Create] RunningHub response:', responseText.substring(0, 500))

  let data
  try {
    data = JSON.parse(responseText)
  } catch {
    return NextResponse.json(
      { error: 'Invalid response from image service' },
      { status: 500 }
    )
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: data.errorMessage || 'Composite image generation failed' },
      { status: 500 }
    )
  }

  if (data.status === 'FAILED') {
    return NextResponse.json(
      { error: data.errorMessage || data.failedReason || 'Failed' },
      { status: 500 }
    )
  }

  // Create asset record
  if (data.status === 'QUEUED' || data.status === 'RUNNING') {
    const asset = await prisma.videoAsset.create({
      data: {
        videoId,
        type: 'composite_image',
        taskId: data.taskId,
        aspectRatio: aspectRatio || '16:9',
        prompt: promptToUse,
        version,
      },
    })

    return NextResponse.json({
      assetId: asset.id,
      status: data.status,
      taskId: data.taskId,
      message: data.status === 'QUEUED' ? 'Task queued...' : 'Generating composite image...',
    })
  }

  // SUCCESS
  const imageUrl = data.results?.[0]?.url
  if (!imageUrl) {
    return NextResponse.json({ error: 'No image URL in response' }, { status: 500 })
  }

  const asset = await prisma.videoAsset.create({
    data: {
      videoId,
      type: 'composite_image',
      url: imageUrl,
      aspectRatio: aspectRatio || '16:9',
      prompt: promptToUse,
      version,
    },
  })

  return NextResponse.json({
    assetId: asset.id,
    status: 'SUCCESS',
    url: imageUrl,
  })
}

async function handleVideoGeneration(
  videoId: string,
  video: { prompt: string | null; script: { content: string } | null },
  customPrompt: string | undefined,
  duration: number,
  aspectRatio: string,
  version: number
) {
  // Get API key from config
  const apiKey = await getRunningHubApiKey()

  // Get the latest composite image asset
  const compositeImageAsset = await prisma.videoAsset.findFirst({
    where: { videoId, type: 'composite_image', url: { not: null } },
    orderBy: { version: 'desc' },
  })

  if (!compositeImageAsset?.url) {
    return NextResponse.json(
      { error: 'No composite image found. Please generate one first.' },
      { status: 400 }
    )
  }

  const videoPrompt = customPrompt || video.prompt || video.script?.content || ''

  if (!videoPrompt) {
    return NextResponse.json(
      { error: 'Please provide a prompt or set video prompt' },
      { status: 400 }
    )
  }

  // Truncate prompt if too long
  const MAX_PROMPT_LENGTH = 4000
  const trimmedPrompt = videoPrompt.length > MAX_PROMPT_LENGTH
    ? videoPrompt.slice(0, MAX_PROMPT_LENGTH)
    : videoPrompt

  // Call RunningHub video API
  const apiUrl = 'https://www.runninghub.cn/openapi/v2/rhart-video-s-official/image-to-video-pro'

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: trimmedPrompt,
      imageUrl: compositeImageAsset.url,
      duration: String(duration),
      resolution: '1080p',
    }),
  })

  const responseText = await response.text()
  console.log('[Asset Create] Video API response:', responseText.substring(0, 500))

  let data
  try {
    data = JSON.parse(responseText)
  } catch {
    return NextResponse.json(
      { error: 'Invalid response from video service' },
      { status: 500 }
    )
  }

  if (!response.ok || data.errorCode) {
    return NextResponse.json(
      { error: data.errorMessage || 'Video generation failed' },
      { status: 500 }
    )
  }

  if (data.status === 'FAILED') {
    return NextResponse.json(
      { error: data.errorMessage || 'Video generation failed' },
      { status: 500 }
    )
  }

  // Create asset record
  if (data.status === 'QUEUED' || data.status === 'RUNNING') {
    const asset = await prisma.videoAsset.create({
      data: {
        videoId,
        type: 'video',
        taskId: data.taskId,
        duration,
        aspectRatio,
        prompt: trimmedPrompt,
        version,
      },
    })

    return NextResponse.json({
      assetId: asset.id,
      status: data.status,
      taskId: data.taskId,
      message: data.status === 'QUEUED' ? 'Task queued...' : 'Generating video...',
    })
  }

  // SUCCESS
  const videoUrl = data.results?.[0]?.url
  if (!videoUrl) {
    return NextResponse.json({ error: 'No video URL in response' }, { status: 500 })
  }

  const asset = await prisma.videoAsset.create({
    data: {
      videoId,
      type: 'video',
      url: videoUrl,
      duration,
      aspectRatio,
      prompt: trimmedPrompt,
      version,
    },
  })

  return NextResponse.json({
    assetId: asset.id,
    status: 'SUCCESS',
    url: videoUrl,
  })
}
