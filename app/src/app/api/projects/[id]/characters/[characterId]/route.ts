import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string; characterId: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { characterId } = await params
  const character = await prisma.character.findUnique({
    where: { id: characterId },
  })
  return NextResponse.json(character)
}

export async function PUT(request: Request, { params }: Props) {
  const { characterId } = await params
  const body = await request.json()
  const character = await prisma.character.update({
    where: { id: characterId },
    data: {
      name: body.name,
      role: body.role,
      description: body.description,
      style: body.style,
      prompt: body.prompt,
      imageUrl: body.imageUrl,
    },
  })
  return NextResponse.json(character)
}

export async function DELETE(request: Request, { params }: Props) {
  const { characterId } = await params
  await prisma.character.delete({ where: { id: characterId } })
  return NextResponse.json({ success: true })
}
