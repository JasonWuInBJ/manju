'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Film, ChevronLeft, Check } from 'lucide-react'

interface Project {
  id: string
  title: string
}

interface Props {
  project: Project
}

const steps = [
  { name: '设置', path: 'settings', step: 1, color: 'slate' },
  { name: '剧本', path: 'script', step: 2, color: 'violet' },
  { name: '角色', path: 'character', step: 3, color: 'purple' },
  { name: '场景', path: 'scene', step: 4, color: 'fuchsia' },
  { name: '道具', path: 'prop', step: 5, color: 'amber' },
  { name: '分镜', path: 'storyboard', step: 6, color: 'indigo' },
  { name: '视频', path: 'video', step: 7, color: 'pink' },
]

export function ProjectNav({ project }: Props) {
  const pathname = usePathname()
  const currentStep = steps.find(s => pathname.includes(s.path))?.step || 0

  return (
    <header className="border-b border-violet-100/60 dark:border-violet-900/30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl sticky top-0 z-50 shadow-sm shadow-violet-100/40 dark:shadow-violet-950/20">
      <div className="container mx-auto px-4">
        {/* 顶部行：返回 + 项目标题 */}
        <div className="flex items-center gap-4 pt-3 pb-2">
          <Link
            href="/"
            className="group flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>返回</span>
          </Link>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-md flex items-center justify-center shadow-sm shadow-violet-500/30">
              <Film className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="font-bold text-base text-slate-900 dark:text-white truncate max-w-[300px]">
              {project.title}
            </h1>
          </div>
        </div>

        {/* 步骤导航 */}
        <nav className="flex items-center gap-1 pb-3 overflow-x-auto">
          {steps.map((step, index) => {
            const isActive = pathname.includes(step.path)
            const isPast = step.step < currentStep
            const href = `/project/${project.id}/${step.path}`
            const isLast = index === steps.length - 1

            return (
              <div key={step.path} className="flex items-center gap-1">
                <Link href={href} className="group flex-shrink-0">
                  <div
                    className={cn(
                      'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer',
                      isActive && 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/30 step-active-glow',
                      isPast && !isActive && 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
                      !isActive && !isPast && 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                    )}
                  >
                    {/* 步骤数字/勾 */}
                    <span
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all',
                        isActive && 'bg-white/20',
                        isPast && !isActive && 'bg-emerald-100 dark:bg-emerald-900/40',
                        !isActive && !isPast && 'bg-slate-100 dark:bg-slate-800',
                      )}
                    >
                      {isPast && !isActive ? (
                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <span className={isActive ? 'text-white' : ''}>{step.step}</span>
                      )}
                    </span>
                    <span>{step.name}</span>
                  </div>
                </Link>

                {/* 连接线 */}
                {!isLast && (
                  <div className={cn(
                    'w-5 h-px flex-shrink-0 mx-0.5 transition-colors duration-300',
                    step.step < currentStep
                      ? 'bg-gradient-to-r from-emerald-400 to-emerald-300 dark:from-emerald-600 dark:to-emerald-700'
                      : 'bg-slate-200 dark:bg-slate-700'
                  )} />
                )}
              </div>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
