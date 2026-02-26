import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string }>
}

// 创建新剧集
export async function POST(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()
  const { episode, title } = body

  const script = await prisma.script.create({
    data: {
      projectId: id,
      episode: episode || 1,
      title: title || `第${episode}集`,
      content: '',
    },
  })

  return NextResponse.json(script)
}

// 更新剧本
export async function PUT(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()
  const { novelText, synopsis, content, scriptId } = body

  if (novelText !== undefined || synopsis !== undefined) {
    await prisma.project.update({
      where: { id },
      data: { novelText, synopsis },
    })
  }

  if (scriptId && content !== undefined) {
    const script = await prisma.script.update({
      where: { id: scriptId },
      data: { content },
    })
    return NextResponse.json(script)
  }

  return NextResponse.json({ success: true })
}
