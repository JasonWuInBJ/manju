import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { ProjectNav } from '@/components/project-nav'

interface Props {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function ProjectLayout({ children, params }: Props) {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
  })

  if (!project) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <ProjectNav project={project} />
      <main className="container mx-auto py-7 px-4 max-w-7xl">
        {children}
      </main>
    </div>
  )
}
