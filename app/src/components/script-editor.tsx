'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ModelSelector } from './model-selector'
import { PromptConfigPanel } from './prompt-config-panel'
import { CheckCircle2, Circle, Loader2, FileText, BookOpen, Sparkles, Settings, Plus, Trash2, Eye, Edit3 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'

interface Script {
  id: string
  episode: number
  title: string
  novelText: string | null
  content: string
  summary?: string | null
}

interface Project {
  id: string
  title: string
  novelText: string | null
  synopsis: string | null
  scripts: Script[]
}

interface Props {
  project: Project
}

const DEFAULT_SYSTEM_PROMPT = `你是一位拥有深厚网文改编经验的短剧金牌编剧。

任务：将网络小说片段改编为短剧剧本。

参数约束：
1. 时长：2分钟左右
2. 字数：1000字左右
3. 镜头：50个左右

改编原则：
1. 以网文原文时间线顺序为基础
2. 紧扣核心矛盾推动剧情
3. 前五秒锚定强冲突点
4. 结尾设置悬念钩子

剧本格式：
- 标题：# 第X集 标题名
- 场景：## 场号-场景名（日/夜/内/外）
- 画面：【画面】描述
- 对白：角色名："对白"
- 内心：角色名 OS："独白"
- 转场：跳切/转场标识`

const DEFAULT_USER_PROMPT_TEMPLATE = `请将以下网络小说片段改编为短剧剧本：

{novelText}

剧集简介：{synopsis}`

export function ScriptEditor({ project }: Props) {
  const [scripts, setScripts] = useState<Script[]>(project.scripts || [])
  const [activeEpisode, setActiveEpisode] = useState<string>(project.scripts[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview')
  const [selectedPromptConfig, setSelectedPromptConfig] = useState<any>(null)
  const [selectedModel, setSelectedModel] = useState<string>('glm-5')
  const [synopsis] = useState(project.synopsis || '')

  const activeScript = scripts.find(s => s.id === activeEpisode)

  // 计算当前剧本的状态
  const getScriptStatus = (script: Script) => {
    if (script.content) return 'done'
    if (script.novelText) return 'ready'
    return 'empty'
  }

  const handleGenerate = async (scriptId: string) => {
    const script = scripts.find(s => s.id === scriptId)
    if (!script?.novelText?.trim()) return

    setLoading(true)
    try {
      let systemPrompt = DEFAULT_SYSTEM_PROMPT
      let userPrompt = DEFAULT_USER_PROMPT_TEMPLATE

      if (selectedPromptConfig) {
        systemPrompt = selectedPromptConfig.systemPrompt
        userPrompt = selectedPromptConfig.userPrompt || DEFAULT_USER_PROMPT_TEMPLATE
      }

      const finalUserPrompt = userPrompt
        .replace('{novelText}', script.novelText || '')
        .replace('{synopsis}', synopsis || '无')

      const res = await fetch(`/api/projects/${project.id}/script/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novelText: script.novelText,
          synopsis,
          systemPrompt,
          userPrompt: finalUserPrompt,
          model: selectedModel,
          scriptId,
        }),
      })
      const data = await res.json()
      if (data.id) {
        setScripts(scripts.map(s => s.id === data.id ? {
          ...s,
          title: data.title,
          content: data.content,
          summary: data.summary,
        } : s))
      }
    } catch (error) {
      console.error('Failed to generate script:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!activeScript) return
    setSaving(true)
    try {
      await fetch(`/api/projects/${project.id}/script/${activeScript.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novelText: activeScript.novelText,
          content: activeScript.content,
        }),
      })
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }

  const updateScriptNovelText = (scriptId: string, novelText: string) => {
    setScripts(scripts.map(s => s.id === scriptId ? { ...s, novelText } : s))
  }

  const updateScriptContent = (scriptId: string, content: string) => {
    setScripts(scripts.map(s => s.id === scriptId ? { ...s, content } : s))
  }

  const handleAddEpisode = async () => {
    const newEpisode = scripts.length + 1
    try {
      const res = await fetch(`/api/projects/${project.id}/script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episode: newEpisode, title: `第${newEpisode}集` }),
      })
      const data = await res.json()
      if (data.id) {
        const newScript: Script = {
          id: data.id,
          episode: data.episode,
          title: data.title,
          novelText: null,
          content: '',
          summary: null,
        }
        setScripts([...scripts, newScript])
        setActiveEpisode(data.id)
      }
    } catch (error) {
      console.error('Failed to add episode:', error)
    }
  }

  const handleDeleteEpisode = async (scriptId: string) => {
    if (!confirm('确定要删除这一集吗？')) return
    try {
      await fetch(`/api/projects/${project.id}/script/${scriptId}`, {
        method: 'DELETE',
      })
      const updated = scripts.filter(s => s.id !== scriptId)
      setScripts(updated)
      if (activeEpisode === scriptId) {
        setActiveEpisode(updated[0]?.id || '')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  return (
    <Tabs defaultValue="design" className="w-full">
      <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
        <TabsTrigger value="design" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md rounded-lg transition-all">
          <FileText className="w-4 h-4 mr-2" />
          剧本编辑
        </TabsTrigger>
        <TabsTrigger value="config" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md rounded-lg transition-all">
          <Settings className="w-4 h-4 mr-2" />
          配置
        </TabsTrigger>
      </TabsList>

      <TabsContent value="design" className="mt-4 space-y-4">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{scripts.length} 集</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAddEpisode}>
              <Plus className="w-4 h-4 mr-1" />
              新增剧集
            </Button>
          </div>
        </div>

        {/* 主内容区 */}
      {scripts.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 dark:bg-slate-900 rounded-xl">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/40 dark:to-indigo-900/40 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <FileText className="w-8 h-8 text-violet-500" />
          </div>
          <p className="text-slate-600 dark:text-slate-300 mb-1">开始创建你的剧本</p>
          <p className="text-sm text-slate-400 mb-6">点击上方「新增剧集」按钮</p>
          <Button onClick={handleAddEpisode} size="lg" className="bg-gradient-to-r from-violet-600 to-indigo-600">
            <Plus className="w-4 h-4 mr-2" />
            新增第一集
          </Button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-hidden">
          {/* 左侧剧集列表 */}
          <nav className="w-44 shrink-0 overflow-y-auto h-[calc(100vh-280px)] space-y-1">
            {scripts.sort((a, b) => a.episode - b.episode).map((script) => {
              const status = getScriptStatus(script)
              const isActive = activeEpisode === script.id
              return (
                <div
                  key={script.id}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                    isActive
                      ? 'bg-violet-50 dark:bg-violet-950/50 border-2 border-violet-300 dark:border-violet-700'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-2 border-transparent'
                  }`}
                  onClick={() => setActiveEpisode(script.id)}
                >
                  <div className="flex items-center gap-2">
                    {status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ) : status === 'ready' ? (
                      <Circle className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                    )}
                    <span className="font-medium text-sm text-slate-700 dark:text-slate-200 truncate">
                      第{script.episode}集
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 pl-6 truncate">
                    {script.title || '未命名'}
                  </div>
                  {!isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                      onClick={(e) => { e.stopPropagation(); handleDeleteEpisode(script.id) }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )
            })}
          </nav>

          {/* 右侧编辑区 */}
          <div className="flex-1 min-w-0">
            {activeScript ? (
              <div className="space-y-4">
                {/* 步骤指示 */}
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      activeScript.novelText ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300'
                    }`}>1</div>
                    <span className={activeScript.novelText ? 'text-green-600 dark:text-green-400' : 'text-violet-600 dark:text-violet-400'}>
                      输入原文
                    </span>
                  </div>
                  <div className="w-8 h-px bg-slate-200 dark:bg-slate-700" />
                  <div className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      activeScript.content ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                    }`}>2</div>
                    <span className={activeScript.content ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}>
                      生成剧本
                    </span>
                  </div>
                </div>

                {/* 步骤1：输入小说原文 */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-violet-500" />
                      <span className="text-sm font-medium">小说原文</span>
                    </div>
                    <Button
                      onClick={() => handleGenerate(activeScript.id)}
                      disabled={loading || !activeScript.novelText?.trim()}
                      size="sm"
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-1.5" />
                          生成剧本
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={activeScript.novelText || ''}
                    onChange={(e) => updateScriptNovelText(activeScript.id, e.target.value)}
                    placeholder="粘贴本集的小说原文内容..."
                    className="min-h-[120px] border-0 rounded-none resize-none text-sm focus-visible:ring-0 bg-transparent"
                  />
                </div>

                {/* 步骤2：剧本内容 */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-500" />
                      <span className="text-sm font-medium">剧本内容</span>
                      {activeScript.content && (
                        <Badge variant="secondary" className="text-xs ml-2">
                          {activeScript.content.length} 字
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded p-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewMode('preview')}
                          className={`h-7 px-2 text-xs ${viewMode === 'preview' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}`}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          预览
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewMode('edit')}
                          className={`h-7 px-2 text-xs ${viewMode === 'edit' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}`}
                        >
                          <Edit3 className="w-3 h-3 mr-1" />
                          编辑
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="h-7 w-7 p-0"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                  {activeScript.content ? (
                    viewMode === 'edit' ? (
                      <Textarea
                        value={activeScript.content}
                        onChange={(e) => updateScriptContent(activeScript.id, e.target.value)}
                        className="min-h-[500px] border-0 rounded-none resize-none text-sm font-mono focus-visible:ring-0 bg-transparent"
                        placeholder="剧本内容..."
                      />
                    ) : (
                      <ScrollArea className="h-[500px]">
                        <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                          >
                            {activeScript.content}
                          </ReactMarkdown>
                        </div>
                      </ScrollArea>
                    )
                  ) : (
                    <div className="h-[120px] flex items-center justify-center text-slate-400 text-sm">
                      剧本将在上方输入原文后生成
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">选择左侧剧集开始编辑</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </TabsContent>

      <TabsContent value="config" className="mt-4">
        <div className="space-y-4 p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            title="模型选择"
          />
          <PromptConfigPanel
            projectId={project.id}
            type="script"
            defaultSystemPrompt={DEFAULT_SYSTEM_PROMPT}
            defaultUserPrompt={DEFAULT_USER_PROMPT_TEMPLATE}
            onPromptSelect={setSelectedPromptConfig}
            selectedPromptId={selectedPromptConfig?.id}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}
