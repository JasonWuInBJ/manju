import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string }>
}

// List videos with optional episodeId filter
export async function GET(request: Request, { params }: Props) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const episodeId = searchParams.get('episodeId')

  const where: Record<string, unknown> = { projectId: id }
  if (episodeId) {
    where.episodeId = episodeId
  }

  const videos = await prisma.video.findMany({
    where,
    include: {
      assets: {
        orderBy: [
          { type: 'asc' },
          { version: 'desc' }
        ]
      },
      script: {
        select: { id: true, title: true, episode: true }
      },
      episode: {
        select: { id: true, name: true }
      }
    },
    orderBy: [
      { order: 'asc' },
      { createdAt: 'desc' }
    ],
  })

  return NextResponse.json(videos)
}

// Create a new video
export async function POST(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()

  // Get current max order for the episode (if specified)
  let order = 0
  if (body.episodeId) {
    const existingVideos = await prisma.video.findMany({
      where: { episodeId: body.episodeId },
      select: { order: true },
    })
    order = existingVideos.length > 0
      ? Math.max(...existingVideos.map(v => v.order)) + 1
      : 0
  }

  const video = await prisma.video.create({
    data: {
      projectId: id,
      episodeId: body.episodeId || null,
      scriptId: body.scriptId || null,
      name: body.name,
      order,
      startTime: body.startTime,
      endTime: body.endTime,
      prompt: body.prompt,
      selectedCharacterIds: body.selectedCharacterIds ? JSON.stringify(body.selectedCharacterIds) : null,
      selectedSceneIds: body.selectedSceneIds ? JSON.stringify(body.selectedSceneIds) : null,
      selectedShotIds: body.selectedShotIds ? JSON.stringify(body.selectedShotIds) : null,
    },
    include: {
      assets: true,
      script: {
        select: { id: true, title: true, episode: true }
      }
    }
  })

  return NextResponse.json(video)
}
