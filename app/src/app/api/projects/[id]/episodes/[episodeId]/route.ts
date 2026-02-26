import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string; episodeId: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { episodeId } = await params
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      videos: {
        include: {
          assets: true,
          script: {
            select: { id: true, title: true, episode: true }
          }
        },
        orderBy: [
          { order: 'asc' },
          { createdAt: 'asc' }
        ]
      }
    }
  })

  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
  }

  return NextResponse.json(episode)
}

export async function PATCH(request: Request, { params }: Props) {
  const { episodeId } = await params
  const body = await request.json()

  const updateData: Record<string, unknown> = {}

  if (body.name !== undefined) updateData.name = body.name
  if (body.description !== undefined) updateData.description = body.description
  if (body.scriptIds !== undefined) {
    updateData.scriptIds = Array.isArray(body.scriptIds)
      ? JSON.stringify(body.scriptIds)
      : body.scriptIds
  }

  const episode = await prisma.episode.update({
    where: { id: episodeId },
    data: updateData,
    include: {
      videos: {
        include: { assets: true },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
      }
    }
  })

  return NextResponse.json(episode)
}

export async function DELETE(request: Request, { params }: Props) {
  const { episodeId } = await params

  await prisma.episode.delete({
    where: { id: episodeId }
  })

  return NextResponse.json({ success: true })
}
