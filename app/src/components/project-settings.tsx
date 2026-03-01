'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ModelSelector } from './model-selector'
import { Loader2, Palette, Check, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { StylePresetDialog } from './style-preset-dialog'

interface StylePreset {
  id: string
  name: string
  keywords: string
  category: 'popular' | 'artistic' | '3d'
  icon: string
  description: string
  isDefault: boolean
  order: number
}

const CATEGORY_LABELS: Record<string, string> = {
  popular: '主流商业漫剧风',
  artistic: '特色艺术风格',
  '3d': '3D 与渲染风格',
}

interface Project {
  id: string
  title: string
  style: string | null
  model: string | null
}

interface Props {
  project: Project
}

export function ProjectSettings({ project }: Props) {
  const [style, setStyle] = useState(project.style ?? 'Anime style, cel shading, flat colors, clean lines, vibrant')
  const [model, setModel] = useState(project.model ?? 'glm-5')
  const [saving, setSaving] = useState(false)
  const [presets, setPresets] = useState<StylePreset[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<StylePreset | null>(null)

  useEffect(() => {
    loadPresets()
  }, [project.id])

  const loadPresets = async () => {
    try {
      const res = await fetch(`/api/style-presets?projectId=${project.id}`)
      if (!res.ok) throw new Error('加载失败')
      const data = await res.json()
      setPresets(data.presets)
    } catch (error) {
      toast.error('加载风格预设失败')
    } finally {
      setLoading(false)
    }
  }

  const selectedPreset = presets.find(p => p.keywords === style)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style, model }),
      })
      if (!res.ok) throw new Error('保存失败')
      toast.success('设置已保存')
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePreset = async (presetId: string) => {
    if (!confirm('确定要删除这个预设吗？')) return

    try {
      const res = await fetch(`/api/projects/${project.id}/style-presets/${presetId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '删除失败')
      }

      toast.success('预设已删除')
      loadPresets()
    } catch (error: any) {
      toast.error(error.message || '删除失败')
    }
  }

  const handleEditPreset = (preset: StylePreset) => {
    setEditingPreset(preset)
    setDialogOpen(true)
  }

  const handleCreatePreset = () => {
    setEditingPreset(null)
    setDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-slate-500" />
              <div>
                <CardTitle className="text-lg font-semibold">画风设定</CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">选择全局画风，用于各模块 Prompt 生成</p>
              </div>
            </div>
            <Button onClick={handleCreatePreset} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              新建预设
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-6">
          {(['popular', 'artistic', '3d'] as const).map(category => (
            <div key={category}>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{CATEGORY_LABELS[category]}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {presets.filter(p => p.category === category).map(preset => {
                  const isSelected = selectedPreset?.id === preset.id
                  return (
                    <div
                      key={preset.id}
                      className={`
                        relative p-4 rounded-lg border transition-all group
                        ${isSelected
                          ? 'border-2 border-violet-500 bg-violet-50 dark:bg-violet-950/30 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950'
                        }
                      `}
                    >
                      <button
                        onClick={() => setStyle(preset.keywords)}
                        className="w-full text-left"
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-2xl">{preset.icon}</span>
                        </div>
                        <div className="font-medium text-slate-900 dark:text-white mb-1">{preset.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{preset.description}</div>
                      </button>

                      {!preset.isDefault && (
                        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditPreset(preset)
                            }}
                            className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeletePreset(preset.id)
                            }}
                            className="w-6 h-6 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/50"
                          >
                            <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Label htmlFor="custom-style" className="text-sm font-medium">自定义风格关键词</Label>
            <Input
              id="custom-style"
              value={style}
              onChange={e => setStyle(e.target.value)}
              placeholder="输入英文风格关键词..."
              className="font-mono text-sm"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              选择预设会自动填入，也可直接编辑自定义
            </p>
          </div>
        </CardContent>
      </Card>

      <ModelSelector
        selectedModel={model}
        onModelChange={setModel}
        title="默认模型"
        description="选择各模块 AI 生成时默认使用的模型"
      />

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</> : '保存设置'}
      </Button>

      <StylePresetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        preset={editingPreset}
        projectId={project.id}
        onSuccess={loadPresets}
      />
    </div>
  )
}
