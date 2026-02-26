import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string; scriptId: string }>
}

export async function DELETE(request: Request, { params }: Props) {
  const { scriptId } = await params

  await prisma.script.delete({
    where: { id: scriptId },
  })

  return NextResponse.json({ success: true })
}

export async function PUT(request: Request, { params }: Props) {
  const { scriptId } = await params
  const body = await request.json()
  const { title, content, novelText, episode } = body

  const script = await prisma.script.update({
    where: { id: scriptId },
    data: {
      ...(title && { title }),
      ...(content !== undefined && { content }),
      ...(novelText !== undefined && { novelText }),
      ...(episode && { episode }),
    },
  })

  return NextResponse.json(script)
}
