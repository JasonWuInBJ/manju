import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { id } = await params
  const scenes = await prisma.scene.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(scenes)
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()
  const scene = await prisma.scene.create({
    data: {
      projectId: id,
      scriptId: body.scriptId || null,
      name: body.name,
      description: body.description || '',
      time: body.time || 'day',
      mood: body.mood || 'neutral',
      weather: body.weather || 'Clear',
      prompt: body.prompt || null,
      negativePrompt: body.negativePrompt || null,
    },
  })
  return NextResponse.json(scene)
}
