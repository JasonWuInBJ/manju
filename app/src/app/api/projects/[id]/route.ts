import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()

  const project = await prisma.project.update({
    where: { id },
    data: body,
  })

  return NextResponse.json(project)
}
