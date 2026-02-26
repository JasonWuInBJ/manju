import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string; propId: string }>
}

export async function PUT(request: Request, { params }: Props) {
  return PATCH(request, { params })
}

export async function PATCH(request: Request, { params }: Props) {
  const { propId } = await params
  const body = await request.json()
  const prop = await prisma.prop.update({
    where: { id: propId },
    data: {
      name: body.name,
      description: body.description,
      prompt: body.prompt,
      imageUrl: body.imageUrl,
      imageTaskId: body.imageTaskId,
    },
  })
  return NextResponse.json(prop)
}

export async function DELETE(request: Request, { params }: Props) {
  const { propId } = await params
  await prisma.prop.delete({ where: { id: propId } })
  return NextResponse.json({ success: true })
}
