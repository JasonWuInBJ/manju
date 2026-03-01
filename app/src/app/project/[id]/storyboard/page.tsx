import { prisma } from '@/lib/db'
import { StoryboardEditor } from '@/components/storyboard-editor'
import { Film } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default async function StoryboardPage({ params }: Props) {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      scripts: { include: { shots: true } },
      characters: { select: { id: true, name: true } },
      scenes: { select: { id: true, name: true } },
      props: { select: { id: true, name: true } },
    },
  })

  if (!project) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/25">
          <Film className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">步骤 2</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">分镜设计</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">基于剧本生成分镜脚本，定义每个镜头</p>
        </div>
      </div>
      <StoryboardEditor project={project} />
    </div>
  )
}
