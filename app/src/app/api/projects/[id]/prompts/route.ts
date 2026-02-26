import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string }>
}

// GET /api/projects/[id]/prompts - 获取项目的所有Prompt配置
export async function GET(request: Request, { params }: Props) {
  const { id } = await params

  try {
    const configs = await prisma.promptConfig.findMany({
      where: { projectId: id },
      orderBy: { type: 'asc' },
    })
    return NextResponse.json(configs)
  } catch (error) {
    console.error('Failed to fetch prompt configs:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST /api/projects/[id]/prompts - 创建新的Prompt配置
export async function POST(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()
  const { type, name, systemPrompt, userPrompt, isDefault } = body

  try {
    // 如果设置为默认，取消该类型的其他默认配置
    if (isDefault) {
      await prisma.promptConfig.updateMany({
        where: { projectId: id, type },
        data: { isDefault: false },
      })
    }

    const config = await prisma.promptConfig.create({
      data: {
        projectId: id,
        type,
        name,
        systemPrompt,
        userPrompt: userPrompt || null,
        isDefault: isDefault || false,
      },
    })
    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to create prompt config:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
