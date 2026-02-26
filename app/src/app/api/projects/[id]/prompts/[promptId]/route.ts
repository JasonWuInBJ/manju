import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string; promptId: string }>
}

// PUT /api/projects/[id]/prompts/[promptId] - 更新Prompt配置
export async function PUT(request: Request, { params }: Props) {
  const { id, promptId } = await params
  const body = await request.json()
  const { name, systemPrompt, userPrompt, isDefault } = body

  try {
    const existingConfig = await prisma.promptConfig.findUnique({
      where: { id: promptId },
    })

    if (!existingConfig) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // 如果设置为默认，取消该类型的其他默认配置
    if (isDefault && !existingConfig.isDefault) {
      await prisma.promptConfig.updateMany({
        where: { projectId: id, type: existingConfig.type, id: { not: promptId } },
        data: { isDefault: false },
      })
    }

    const config = await prisma.promptConfig.update({
      where: { id: promptId },
      data: {
        name: name !== undefined ? name : existingConfig.name,
        systemPrompt: systemPrompt !== undefined ? systemPrompt : existingConfig.systemPrompt,
        userPrompt: userPrompt !== undefined ? userPrompt : existingConfig.userPrompt,
        isDefault: isDefault !== undefined ? isDefault : existingConfig.isDefault,
      },
    })
    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to update prompt config:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/prompts/[promptId] - 删除Prompt配置
export async function DELETE(request: Request, { params }: Props) {
  const { promptId } = await params

  try {
    await prisma.promptConfig.delete({
      where: { id: promptId },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete prompt config:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
