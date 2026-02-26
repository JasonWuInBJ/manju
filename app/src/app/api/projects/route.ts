import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(projects)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { title, synopsis } = body

  const project = await prisma.project.create({
    data: { title, synopsis },
  })

  return NextResponse.json(project)
}
