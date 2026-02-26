import { prisma } from '@/lib/db'
import { CharacterDesigner } from '@/components/character-designer'
import { Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CharacterPage({ params }: Props) {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    include: { characters: true, scripts: true },
  })

  if (!project) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-md shadow-purple-500/25">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-xs font-semibold text-purple-500 dark:text-purple-400 uppercase tracking-wider">步骤 3</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">角色设计</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">设计角色形象，生成角色立绘</p>
        </div>
      </div>
      <CharacterDesigner project={project} />
    </div>
  )
}
