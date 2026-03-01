'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface StylePreset {
  id?: string
  name: string
  keywords: string
  category: 'popular' | 'artistic' | '3d'
  icon: string
  description: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset?: StylePreset | null
  projectId: string
  onSuccess: () => void
}

const CATEGORY_OPTIONS = [
  { value: 'popular', label: '主流商业漫剧风' },
  { value: 'artistic', label: '特色艺术风格' },
  { value: '3d', label: '3D与渲染风格' },
]

export function StylePresetDialog({
  open,
  onOpenChange,
  preset,
  projectId,
  onSuccess,
}: Props) {
  const [formData, setFormData] = useState<StylePreset>({
    name: '',
    keywords: '',
    category: 'popular',
    icon: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (preset) {
      setFormData(preset)
    } else {
      setFormData({
        name: '',
        keywords: '',
        category: 'popular',
        icon: '',
        description: '',
      })
    }
  }, [preset, open])

  const handleSave = async () => {
    if (!formData.name || !formData.keywords || !formData.icon || !formData.description) {
      toast.error('请填写所有必填字段')
      return
    }

    setSaving(true)
    try {
      const url = preset?.id
        ? `/api/projects/${projectId}/style-presets/${preset.id}`
        : `/api/projects/${projectId}/style-presets`
      const method = preset?.id ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '保存失败')
      }

      toast.success(preset?.id ? '预设已更新' : '预设已创建')
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{preset?.id ? '编辑风格预设' : '新建风格预设'}</DialogTitle>
          <DialogDescription>
            创建自定义风格预设，仅在此项目中可用
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">名称 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="如：赛博朋克风"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="icon">图标 *</Label>
            <Input
              id="icon"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="如：🌃"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">类别 *</Label>
            <Select
              value={formData.category}
              onValueChange={(value: 'popular' | 'artistic' | '3d') =>
                setFormData({ ...formData, category: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="keywords">关键词 *</Label>
            <Input
              id="keywords"
              value={formData.keywords}
              onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
              placeholder="英文关键词，如：Cyberpunk style, neon lights..."
              className="font-mono text-sm"
            />
            <p className="text-xs text-slate-500">用于 AI 生成的英文风格关键词</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述 *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="中文描述，如：霓虹光影，机械元素，适合科幻动作"
            />
            <p className="text-xs text-slate-500">简短描述风格特点和适用场景</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {preset?.id ? '更新' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}