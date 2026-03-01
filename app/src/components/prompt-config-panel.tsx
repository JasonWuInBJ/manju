'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, Plus, Sparkles, Loader2, Check, X, FileText, ChevronDown, ChevronUp } from 'lucide-react'

interface PromptConfig {
  id: string
  type: 'script' | 'character' | 'scene' | 'scene_extract' | 'storyboard' | 'video' | 'image' | 'prop' | 'prop_extract'
  name: string
  systemPrompt: string
  userPrompt: string | null
  isDefault: boolean
}

interface Props {
  projectId: string
  type: 'script' | 'character' | 'scene' | 'scene_extract' | 'storyboard' | 'video' | 'image' | 'prop' | 'prop_extract'
  defaultSystemPrompt: string
  defaultUserPrompt?: string
  onPromptSelect?: (config: PromptConfig | null) => void
  selectedPromptId?: string | null
}

const TYPE_LABELS: Record<string, string> = {
  script: '剧本生成',
  character: '角色设计',
  scene: '场景设计',
  scene_extract: '场景提取',
  storyboard: '分镜生成',
  video: '视频生成',
  image: '图片生成',
  prop: '道具设计',
  prop_extract: '道具提取',
}

export function PromptConfigPanel({
  projectId,
  type,
  defaultSystemPrompt,
  defaultUserPrompt = '',
  onPromptSelect,
  selectedPromptId,
}: Props) {
  const [configs, setConfigs] = useState<PromptConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [aiDescription, setAiDescription] = useState('')
  const [generating, setGenerating] = useState(false)

  // 加载 Prompt 配置列表
  useEffect(() => {
    fetchConfigs()
  }, [projectId, type])

  const fetchConfigs = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/prompts`)
      const data = await res.json()
      const filtered = data.filter((c: PromptConfig) => c.type === type)
      setConfigs(filtered)

      // 自动选中第一个或默认配置
      if (filtered.length > 0 && !selectedPromptId) {
        const defaultConfig = filtered.find((c: PromptConfig) => c.isDefault) || filtered[0]
        onPromptSelect?.(defaultConfig)
        setEditingId(defaultConfig.id)
      }
    } catch (error) {
      console.error('Failed to fetch configs:', error)
    }
  }

  const handleCreate = async () => {
    const newConfig: Omit<PromptConfig, 'id'> = {
      type,
      name: `${TYPE_LABELS[type]} - ${configs.length + 1}`,
      systemPrompt: defaultSystemPrompt,
      userPrompt: defaultUserPrompt || null,
      isDefault: configs.length === 0,
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      })
      const config = await res.json()
      setConfigs([...configs, config])
      setEditingId(config.id)
      onPromptSelect?.(config)
    } catch (error) {
      console.error('Failed to create:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (id: string, configData: Omit<PromptConfig, 'id'>) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/prompts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      })
      const updatedConfig = await res.json()
      setConfigs(configs.map(c => c.id === id ? updatedConfig : c))
      setEditingId(null)
      onPromptSelect?.(updatedConfig)
    } catch (error) {
      console.error('Failed to update:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个 Prompt 配置吗？')) return
    try {
      await fetch(`/api/projects/${projectId}/prompts/${id}`, { method: 'DELETE' })
      const newConfigs = configs.filter(c => c.id !== id)
      setConfigs(newConfigs)

      if (selectedPromptId === id) {
        const nextConfig = newConfigs[0] || null
        if (nextConfig) onPromptSelect?.(nextConfig)
      }
      if (editingId === id) setEditingId(null)
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const handleAIGenerate = async (config: PromptConfig) => {
    if (!aiDescription.trim()) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/prompts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, description: aiDescription }),
      })
      if (!res.ok) throw new Error('Failed to generate')
      const { systemPrompt, userPrompt } = await res.json()

      // 更新配置
      const updatedConfig = {
        ...config,
        systemPrompt: systemPrompt || config.systemPrompt,
        userPrompt: userPrompt || config.userPrompt,
      }
      setConfigs(configs.map(c => c.id === config.id ? updatedConfig : c))
      onPromptSelect?.(updatedConfig)
    } catch (error) {
      console.error('Failed to generate prompt:', error)
    } finally {
      setGenerating(false)
    }
  }

  const updateConfig = (id: string, updates: Partial<PromptConfig>) => {
    setConfigs(configs.map(c => c.id === id ? { ...c, ...updates } : c))
  }

  const handleToggleDefault = async (config: PromptConfig) => {
    if (config.isDefault) return

    // 更新本地状态
    const updatedConfigs = configs.map(c => ({
      ...c,
      isDefault: c.id === config.id ? true : false
    }))
    setConfigs(updatedConfigs)

    // 保存到服务器
    setLoading(true)
    try {
      await fetch(`/api/projects/${projectId}/prompts/${config.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: config.type,
          name: config.name,
          systemPrompt: config.systemPrompt,
          userPrompt: config.userPrompt,
          isDefault: true,
        }),
      })
      onPromptSelect?.({ ...config, isDefault: true })
    } catch (error) {
      console.error('Failed to update:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCardClick = (config: PromptConfig) => {
    onPromptSelect?.(config)
  }

  const handleEditClick = (e: React.MouseEvent, configId: string) => {
    e.stopPropagation()
    setEditingId(editingId === configId ? null : configId)
  }

  const editingConfig = configs.find(c => c.id === editingId)

  return (
    <Card className="border border-slate-200 dark:border-slate-800">
      {/* 简洁头部 */}
      <CardHeader className="border-b border-slate-200 dark:border-slate-800 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" />
            <div>
              <CardTitle className="text-lg font-semibold">{TYPE_LABELS[type]} Prompt 配置</CardTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">管理和自定义 AI 提示词</p>
            </div>
          </div>
          <Button
            onClick={handleCreate}
            disabled={loading}
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            新建
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* 配置卡片网格 */}
        {configs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 mb-4">暂无 Prompt 配置</p>
            <Button onClick={handleCreate} disabled={loading} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1.5" />
              创建第一个配置
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 卡片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {configs.map(config => {
                const isSelected = selectedPromptId === config.id
                const isEditing = editingId === config.id
                return (
                  <div
                    key={config.id}
                    onClick={() => handleCardClick(config)}
                    className={`
                      relative p-4 rounded-lg border text-left transition-all cursor-pointer
                      ${isSelected
                        ? 'border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950'
                      }
                      ${isEditing ? 'ring-2 ring-blue-500/20' : ''}
                    `}
                  >
                    {/* 选中勾选 */}
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}

                    {/* 配置名称 */}
                    <div className="flex items-center gap-2 mb-2 pr-6">
                      <span className="font-medium text-slate-900 dark:text-white truncate">
                        {config.name}
                      </span>
                      {config.isDefault && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shrink-0">
                          默认
                        </Badge>
                      )}
                    </div>

                    {/* 系统提示词预览 */}
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                      {config.systemPrompt.slice(0, 80)}...
                    </p>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={isEditing ? "default" : "ghost"}
                        className={`h-7 px-2 text-xs ${isEditing ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                        onClick={(e) => handleEditClick(e, config.id)}
                      >
                        {isEditing ? (
                          <>
                            <ChevronUp className="w-3 h-3 mr-1" />
                            收起
                          </>
                        ) : (
                          <>
                            <Pencil className="w-3 h-3 mr-1" />
                            编辑
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(config.id)
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 编辑面板 */}
            {editingConfig && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                {/* 编辑头部 */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-slate-500" />
                    <span className="font-medium">编辑配置</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      className="h-8"
                    >
                      <X className="w-4 h-4 mr-1" />
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSave(editingConfig.id, editingConfig)}
                      disabled={loading}
                      className="h-8 bg-blue-500 hover:bg-blue-600"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-1" />
                      )}
                      保存
                    </Button>
                  </div>
                </div>

                {/* 配置名称 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">配置名称</Label>
                    <Input
                      value={editingConfig.name}
                      onChange={e => updateConfig(editingConfig.id, { name: e.target.value })}
                      placeholder="输入配置名称..."
                      className="h-9"
                    />
                  </div>
                  <div className="flex items-center gap-3 md:pt-6">
                    <Switch
                      checked={editingConfig.isDefault}
                      onCheckedChange={() => handleToggleDefault(editingConfig)}
                      disabled={editingConfig.isDefault || loading}
                    />
                    <Label className="text-sm text-slate-600 dark:text-slate-400">设为默认配置</Label>
                  </div>
                </div>

                {/* AI 智能生成 */}
                <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg p-3">
                  <Label className="flex items-center gap-1.5 mb-2 text-sm font-medium text-violet-700 dark:text-violet-300">
                    <Sparkles className="w-4 h-4" />
                    AI 智能生成
                  </Label>
                  <p className="text-xs text-violet-600 dark:text-violet-400 mb-2">
                    描述你想要的 Prompt 风格，AI 将自动生成
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={aiDescription}
                      onChange={e => setAiDescription(e.target.value)}
                      placeholder="如：生成赛博朋克风格，注重细节描写..."
                      className="flex-1 h-9 bg-white dark:bg-slate-950"
                    />
                    <Button
                      onClick={() => handleAIGenerate(editingConfig)}
                      disabled={generating || !aiDescription.trim()}
                      size="sm"
                      className="h-9 bg-violet-600 hover:bg-violet-700"
                    >
                      {generating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* 系统提示词 */}
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">系统提示词</Label>
                  <Textarea
                    value={editingConfig.systemPrompt}
                    onChange={e => updateConfig(editingConfig.id, { systemPrompt: e.target.value })}
                    placeholder="AI 的角色设定和指令..."
                    className="min-h-[100px] font-mono text-sm bg-white dark:bg-slate-950 resize-none overflow-hidden"
                    style={{ height: 'auto', minHeight: '100px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = 'auto'
                      target.style.height = `${target.scrollHeight}px`
                    }}
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto'
                        el.style.height = `${el.scrollHeight}px`
                      }
                    }}
                  />
                </div>

                {/* 用户提示词模板 */}
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">用户提示词模板（可选）</Label>
                  <Textarea
                    value={editingConfig.userPrompt || ''}
                    onChange={e => updateConfig(editingConfig.id, { userPrompt: e.target.value || null })}
                    placeholder="用户输入的提示词模板..."
                    className="min-h-[60px] font-mono text-sm bg-white dark:bg-slate-950 resize-none overflow-hidden"
                    style={{ height: 'auto', minHeight: '60px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = 'auto'
                      target.style.height = `${target.scrollHeight}px`
                    }}
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto'
                        el.style.height = `${el.scrollHeight}px`
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
