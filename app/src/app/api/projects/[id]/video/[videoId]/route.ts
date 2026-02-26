import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string; videoId: string }>
}

// GET: Get single video
export async function GET(request: Request, { params }: Props) {
  const { videoId } = await params

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { script: true },
  })

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  return NextResponse.json(video)
}

// PATCH: Update video name
export async function PATCH(request: Request, { params }: Props) {
  const { videoId } = await params
  const body = await request.json()
  const video = await prisma.video.update({
    where: { id: videoId },
    data: { name: body.name },
  })
  return NextResponse.json(video)
}

// DELETE: Delete video
export async function DELETE(request: Request, { params }: Props) {
  const { videoId } = await params

  await prisma.video.delete({
    where: { id: videoId },
  })

  return NextResponse.json({ success: true })
}
