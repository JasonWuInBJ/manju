import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string }>
}

// GET: List all videos for project
export async function GET(request: Request, { params }: Props) {
  const { id } = await params

  const videos = await prisma.video.findMany({
    where: { projectId: id },
    include: { script: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(videos)
}

// POST: Create new video record
export async function POST(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()
  const { scriptId, selectedShotIds, name } = body

  const video = await prisma.video.create({
    data: {
      projectId: id,
      scriptId: scriptId || null,
      selectedShotIds: selectedShotIds || null,
      name: name || null,
    },
  })

  return NextResponse.json(video)
}
