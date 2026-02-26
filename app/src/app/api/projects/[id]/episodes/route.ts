import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { id } = await params
  const episodes = await prisma.episode.findMany({
    where: { projectId: id },
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
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(episodes)
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()

  const episode = await prisma.episode.create({
    data: {
      projectId: id,
      name: body.name,
      description: body.description,
      scriptIds: body.scriptIds ? JSON.stringify(body.scriptIds) : null,
    },
    include: {
      videos: true
    }
  })

  return NextResponse.json(episode)
}
