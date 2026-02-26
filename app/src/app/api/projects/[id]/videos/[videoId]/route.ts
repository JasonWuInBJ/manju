import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string; videoId: string }>
}

// Get video details
export async function GET(request: Request, { params }: Props) {
  const { videoId } = await params

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: {
      assets: {
        orderBy: [
          { type: 'asc' },
          { version: 'desc' }
        ]
      },
      script: {
        select: { id: true, title: true, episode: true, content: true, shots: true }
      },
      episode: {
        select: { id: true, name: true }
      }
    }
  })

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  return NextResponse.json(video)
}

// Update video
export async function PATCH(request: Request, { params }: Props) {
  const { videoId } = await params
  const body = await request.json()

  const updateData: Record<string, unknown> = {}

  if (body.name !== undefined) updateData.name = body.name
  if (body.episodeId !== undefined) updateData.episodeId = body.episodeId
  if (body.scriptId !== undefined) updateData.scriptId = body.scriptId
  if (body.order !== undefined) updateData.order = body.order
  if (body.startTime !== undefined) updateData.startTime = body.startTime
  if (body.endTime !== undefined) updateData.endTime = body.endTime
  if (body.prompt !== undefined) updateData.prompt = body.prompt
  if (body.selectedCharacterIds !== undefined) {
    updateData.selectedCharacterIds = Array.isArray(body.selectedCharacterIds)
      ? JSON.stringify(body.selectedCharacterIds)
      : body.selectedCharacterIds
  }
  if (body.selectedSceneIds !== undefined) {
    updateData.selectedSceneIds = Array.isArray(body.selectedSceneIds)
      ? JSON.stringify(body.selectedSceneIds)
      : body.selectedSceneIds
  }
  if (body.selectedShotIds !== undefined) {
    updateData.selectedShotIds = Array.isArray(body.selectedShotIds)
      ? JSON.stringify(body.selectedShotIds)
      : body.selectedShotIds
  }

  const video = await prisma.video.update({
    where: { id: videoId },
    data: updateData,
    include: {
      assets: true,
      script: {
        select: { id: true, title: true, episode: true }
      }
    }
  })

  return NextResponse.json(video)
}

// Delete video
export async function DELETE(request: Request, { params }: Props) {
  const { videoId } = await params

  // Assets will be cascade deleted due to schema relation
  await prisma.video.delete({
    where: { id: videoId }
  })

  return NextResponse.json({ success: true })
}
