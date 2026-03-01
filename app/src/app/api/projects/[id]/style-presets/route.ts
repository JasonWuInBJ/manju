import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 获取项目的所有风格预设（系统 + 项目自定义）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    const presets = await prisma.stylePreset.findMany({
      where: {
        OR: [{ projectId: null }, { projectId }],
      },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    })

    return NextResponse.json({ presets })
  } catch (error) {
    console.error('获取风格预设失败:', error)
    return NextResponse.json({ error: '获取风格预设失败' }, { status: 500 })
  }
}

// 创建项目自定义预设
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()

    const { name, keywords, category, icon, description } = body

    // 验证必填字段
    if (!name || !keywords || !category || !icon || !description) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    }

    // 验证 category 是否有效
    const validCategories = ['popular', 'artistic', '3d']
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: '无效的分类' }, { status: 400 })
    }

    // 获取当前类别中的最大 order 值
    const maxOrderPreset = await prisma.stylePreset.findFirst({
      where: {
        OR: [{ projectId: null }, { projectId }],
        category,
      },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const nextOrder = (maxOrderPreset?.order ?? 0) + 1

    const preset = await prisma.stylePreset.create({
      data: {
        name,
        keywords,
        category,
        icon,
        description,
        isDefault: false,
        order: nextOrder,
        projectId,
      },
    })

    return NextResponse.json({ preset })
  } catch (error) {
    console.error('创建风格预设失败:', error)
    return NextResponse.json({ error: '创建风格预设失败' }, { status: 500 })
  }
}