import { prisma } from '@/lib/db'
import { ProjectSettings } from '@/components/project-settings'
import { Settings } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
  })

  if (!project) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-slate-500 to-slate-700 rounded-xl flex items-center justify-center shadow-md shadow-slate-500/25">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">项目设置</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">全局设置</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">配置项目风格和默认模型</p>
        </div>
      </div>
      <ProjectSettings project={project} />
    </div>
  )
}
