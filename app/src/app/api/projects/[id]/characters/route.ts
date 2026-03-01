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
      prompt: body.prompt || null,
      characterGroupId: body.characterGroupId || null,
      costumeName: body.costumeName || null,
    },
  })
  // 如果没有传入 characterGroupId，用自身 ID 作为 groupId（原版角色）
  if (!body.characterGroupId) {
    await prisma.character.update({
      where: { id: character.id },
      data: { characterGroupId: character.id },
    })
    character.characterGroupId = character.id
  }
  return NextResponse.json(character)
}
