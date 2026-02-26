import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreateProjectDialog } from '@/components/create-project-dialog'
import { Film, FileText, Users, Image, Clock, Sparkles, ArrowRight, Settings } from 'lucide-react'

export default async function HomePage() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      scripts: { select: { id: true } },
      characters: { select: { id: true } },
      scenes: { select: { id: true } },
    },
  })

  const totalScripts = projects.reduce((sum, p) => sum + p.scripts.length, 0)
  const totalCharacters = projects.reduce((sum, p) => sum + p.characters.length, 0)
  const totalScenes = projects.reduce((sum, p) => sum + p.scenes.length, 0)

  return (
    <main className="min-h-screen">
      {/* 头部 */}
      <header className="border-b border-violet-100/60 dark:border-violet-900/30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50 shadow-sm shadow-violet-100/50 dark:shadow-violet-950/20">
        <div className="container mx-auto py-3.5 px-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Film className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">漫剧工坊</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-none mt-0.5">AI 辅助短视频漫剧创作</p>
              </div>
            </div>
            <Link
              href="/settings"
              className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-8 px-4">
        {projects.length === 0 ? (
          /* 空状态 */
          <div className="max-w-md mx-auto mt-20">
            <div className="glass-card rounded-3xl p-12 text-center shadow-xl shadow-violet-100/40 dark:shadow-violet-950/30">
              <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/40 dark:to-indigo-900/40 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-float">
                <Film className="w-10 h-10 text-violet-500 dark:text-violet-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                开始你的创作
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                创建第一个漫剧项目，让 AI 帮你从小说到视频一步到位
              </p>
              <CreateProjectDialog />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: '项目',
                  value: projects.length,
                  icon: Film,
                  gradient: 'from-violet-500 to-indigo-600',
                  bg: 'bg-violet-50 dark:bg-violet-950/40',
                  iconColor: 'text-violet-600 dark:text-violet-400',
                },
                {
                  label: '剧本',
                  value: totalScripts,
                  icon: FileText,
                  gradient: 'from-emerald-500 to-teal-600',
                  bg: 'bg-emerald-50 dark:bg-emerald-950/40',
                  iconColor: 'text-emerald-600 dark:text-emerald-400',
                },
                {
                  label: '角色',
                  value: totalCharacters,
                  icon: Users,
                  gradient: 'from-rose-500 to-pink-600',
                  bg: 'bg-rose-50 dark:bg-rose-950/40',
                  iconColor: 'text-rose-600 dark:text-rose-400',
                },
                {
                  label: '场景',
                  value: totalScenes,
                  icon: Image,
                  gradient: 'from-amber-500 to-orange-600',
                  bg: 'bg-amber-50 dark:bg-amber-950/40',
                  iconColor: 'text-amber-600 dark:text-amber-400',
                },
              ].map(({ label, value, icon: Icon, bg, iconColor }) => (
                <Card key={label} className="glass-card border-0 shadow-md shadow-slate-100/80 dark:shadow-slate-900/40 overflow-hidden group">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
                        <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{value}</p>
                      </div>
                      <div className={`w-12 h-12 ${bg} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                        <Icon className={`w-6 h-6 ${iconColor}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 项目列表标题 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-500" />
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">我的项目</h2>
                <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 font-semibold text-xs">
                  {projects.length}
                </Badge>
              </div>
              <CreateProjectDialog />
            </div>

            {/* 项目卡片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((project) => (
                <Link key={project.id} href={`/project/${project.id}`} className="group block">
                  <div className="glass-card hover-glow rounded-2xl overflow-hidden cursor-pointer h-full">
                    {/* 顶部彩色装饰条 */}
                    <div className="h-1.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500" />
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                            {project.title}
                          </h3>
                          {project.synopsis && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                              {project.synopsis}
                            </p>
                          )}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 dark:group-hover:bg-violet-800/40 transition-colors">
                          <ArrowRight className="w-4 h-4 text-violet-500 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        <Badge className="bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-0 text-xs font-medium">
                          <FileText className="w-3 h-3 mr-1" />
                          {project.scripts.length} 剧本
                        </Badge>
                        <Badge className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-0 text-xs font-medium">
                          <Users className="w-3 h-3 mr-1" />
                          {project.characters.length} 角色
                        </Badge>
                        <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-0 text-xs font-medium">
                          <Image className="w-3 h-3 mr-1" />
                          {project.scenes.length} 场景
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 pt-3 border-t border-slate-100 dark:border-white/5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>更新于 {project.updatedAt.toLocaleDateString('zh-CN')}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
