import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { id } = await params
  const characters = await prisma.character.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(characters)
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()
  const character = await prisma.character.create({
    data: {
      projectId: id,
      name: body.name,
      role: body.role || 'supporting',
      description: body.description || '',
      style: body.style || 'cel-shaded',
    },
  })
  return NextResponse.json(character)
}
