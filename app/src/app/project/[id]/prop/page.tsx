import { prisma } from '@/lib/db'
import { PropDesigner } from '@/components/prop-designer'
import { Package } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PropPage({ params }: Props) {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    include: { props: true },
  })

  if (!project) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md shadow-amber-500/25">
          <Package className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-xs font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-wider">步骤 4</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">道具设计</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">从剧本提取道具资产，生成道具参考图</p>
        </div>
      </div>
      <PropDesigner project={project} />
    </div>
  )
}
