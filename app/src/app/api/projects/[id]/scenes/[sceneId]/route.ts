import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string; sceneId: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { sceneId } = await params
  const scene = await prisma.scene.findUnique({ where: { id: sceneId } })
  return NextResponse.json(scene)
}

export async function PUT(request: Request, { params }: Props) {
  const { sceneId } = await params
  const body = await request.json()
  const scene = await prisma.scene.update({
    where: { id: sceneId },
    data: {
      name: body.name,
      description: body.description,
      time: body.time,
      mood: body.mood,
      weather: body.weather,
      prompt: body.prompt,
      negativePrompt: body.negativePrompt,
      imageUrl: body.imageUrl,
    },
  })
  return NextResponse.json(scene)
}

export async function DELETE(request: Request, { params }: Props) {
  const { sceneId } = await params
  await prisma.scene.delete({ where: { id: sceneId } })
  return NextResponse.json({ success: true })
}
