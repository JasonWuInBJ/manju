import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string; episodeId: string }>
}

// Reorder videos within an episode
export async function POST(request: Request, { params }: Props) {
  const { episodeId } = await params
  const body = await request.json()

  // body.videoOrders: [{ videoId: string, order: number }, ...]
  const { videoOrders } = body

  if (!Array.isArray(videoOrders)) {
    return NextResponse.json({ error: 'videoOrders must be an array' }, { status: 400 })
  }

  // Update each video's order in a transaction
  await prisma.$transaction(
    videoOrders.map((item: { videoId: string; order: number }) =>
      prisma.video.update({
        where: { id: item.videoId },
        data: { order: item.order }
      })
    )
  )

  // Return updated episode with videos
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      videos: {
        include: { assets: true },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
      }
    }
  })

  return NextResponse.json(episode)
}
