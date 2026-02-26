import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { id } = await params
  const props = await prisma.prop.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(props)
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()
  const prop = await prisma.prop.create({
    data: {
      projectId: id,
      name: body.name,
      description: body.description || '',
      prompt: body.prompt || null,
    },
  })
  return NextResponse.json(prop)
}
