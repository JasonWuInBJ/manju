import { prisma } from '@/lib/db'
import { ScriptEditor } from '@/components/script-editor'
import { FileText } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ScriptPage({ params }: Props) {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    include: { scripts: true },
  })

  if (!project) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-violet-500/25">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-violet-500 dark:text-violet-400 uppercase tracking-wider">步骤 1</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">剧本生成</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">粘贴网络小说原文，AI 自动生成分镜剧本</p>
        </div>
      </div>
      <ScriptEditor project={project} />
    </div>
  )
}
