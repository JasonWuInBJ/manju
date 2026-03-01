import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 更新项目自定义预设
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; presetId: string }> }
) {
  try {
    const { id: projectId, presetId } = await params
    const body = await request.json()

    // 检查预设是否存在且属于该项目
    const existing = await prisma.stylePreset.findFirst({
      where: {
        id: presetId,
        projectId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: '预设不存在或无权修改' }, { status: 404 })
    }

    // 不允许修改系统预设
    if (existing.isDefault) {
      return NextResponse.json({ error: '系统预设不可修改' }, { status: 403 })
    }

    const { name, keywords, category, icon, description } = body

    const preset = await prisma.stylePreset.update({
      where: { id: presetId },
      data: {
        ...(name && { name }),
        ...(keywords && { keywords }),
        ...(category && { category }),
        ...(icon && { icon }),
        ...(description && { description }),
      },
    })

    return NextResponse.json({ preset })
  } catch (error) {
    console.error('更新风格预设失败:', error)
    return NextResponse.json({ error: '更新风格预设失败' }, { status: 500 })
  }
}

// 删除项目自定义预设
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; presetId: string }> }
) {
  try {
    const { id: projectId, presetId } = await params

    // 检查预设是否存在且属于该项目
    const existing = await prisma.stylePreset.findFirst({
      where: {
        id: presetId,
        projectId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: '预设不存在或无权删除' }, { status: 404 })
    }

    // 不允许删除系统预设
    if (existing.isDefault) {
      return NextResponse.json({ error: '系统预设不可删除' }, { status: 403 })
    }

    await prisma.stylePreset.delete({
      where: { id: presetId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除风格预设失败:', error)
    return NextResponse.json({ error: '删除风格预设失败' }, { status: 500 })
  }
}