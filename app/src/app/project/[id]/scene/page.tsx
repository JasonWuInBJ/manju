import { prisma } from '@/lib/db'
import { SceneDesigner } from '@/components/scene-designer'
import { MapPin } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ScenePage({ params }: Props) {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    include: { scenes: true, scripts: true },
  })

  if (!project) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-fuchsia-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md shadow-fuchsia-500/25">
          <MapPin className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-xs font-semibold text-fuchsia-500 dark:text-fuchsia-400 uppercase tracking-wider">步骤 4</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">场景设计</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">设计场景背景，生成场景概念图</p>
        </div>
      </div>
      <SceneDesigner project={project} />
    </div>
  )
}
