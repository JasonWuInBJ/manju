import { prisma } from '@/lib/db'
import { VideoPageClient } from './client'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function VideoPage({ params }: Props) {
  const { id } = await params

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      scripts: {
        orderBy: { episode: 'asc' },
        include: {
          shots: {
            orderBy: { order: 'asc' },
          },
        },
      },
      characters: {
        where: { imageUrl: { not: null } },
        orderBy: { createdAt: 'asc' },
      },
      scenes: {
        where: { imageUrl: { not: null } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!project) {
    notFound()
  }

  return <VideoPageClient project={project} />
}
