import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    // 获取系统预设 + 项目自定义预设
    const presets = await prisma.stylePreset.findMany({
      where: {
        OR: [
          { projectId: null }, // 系统全局预设
          ...(projectId ? [{ projectId }] : []), // 项目自定义预设
        ],
      },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    })

    return NextResponse.json({ presets })
  } catch (error) {
    console.error('获取风格预设失败:', error)
    return NextResponse.json({ error: '获取风格预设失败' }, { status: 500 })
  }
}