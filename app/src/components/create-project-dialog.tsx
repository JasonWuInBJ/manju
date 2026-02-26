'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Sparkles, Film, Loader2, Plus } from 'lucide-react'

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, synopsis }),
      })
      const project = await res.json()
      setOpen(false)
      setTitle('')
      setSynopsis('')
      router.push(`/project/${project.id}`)
      router.refresh()
    } catch (error) {
      console.error('Failed to create project:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-200 rounded-xl gap-1.5">
          <Plus className="w-4 h-4" />
          新建项目
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] rounded-2xl border border-violet-100/50 dark:border-violet-900/30 shadow-2xl shadow-violet-500/10 dark:shadow-violet-950/40 p-0 overflow-hidden">
        {/* 顶部渐变装饰 */}
        <div className="h-1.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500" />
        <form onSubmit={handleSubmit} className="p-6">
          <DialogHeader className="space-y-4 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-500/30">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">新建漫剧项目</DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400 mt-1">
                开始你的 AI 漫剧创作之旅
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="title" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                项目名称 <span className="text-red-400">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：我的第一部漫剧"
                className="h-11 border-slate-200 dark:border-slate-700 focus:border-violet-500 dark:focus:border-violet-500 focus-visible:ring-violet-500/20 transition-all rounded-xl"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="synopsis" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                剧集简介 <span className="text-slate-400 font-normal">(可选)</span>
              </Label>
              <Textarea
                id="synopsis"
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                placeholder="简要描述故事核心，帮助 AI 更好地理解剧情走向..."
                rows={3}
                className="border-slate-200 dark:border-slate-700 focus:border-violet-500 dark:focus:border-violet-500 focus-visible:ring-violet-500/20 transition-all rounded-xl resize-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 h-11 font-bold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Film className="w-4 h-4 mr-2" />
                  创建项目
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
