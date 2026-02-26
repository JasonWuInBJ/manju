'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PromptConfigPanel } from './prompt-config-panel'
import { ModelSelector } from './model-selector'
import { Sparkles, Loader2, Image as ImageIcon, Plus, Package, Check, Trash2, Settings2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'

interface Prop {
  id: string
  name: string
  description: string
  prompt: string | null
  imageUrl: string | null
  imageTaskId: string | null
}

interface Project {
  id: string
  title: string
  props: Prop[]
}

interface Props {
  project: Project
}

const DEFAULT_SYSTEM_PROMPT = `你是一位资深的AI绘图提示词专家。根据道具信息生成适合AI绘图的英文Prompt。

输出要求：
1. 描述道具的外观、材质、纹理、光影效果
2. 包含道具的颜色、形状、细节特征
3. 纯英文输出
4. 适合Midjourney/Stable Diffusion使用
5. simple pure white background, no text, no watermark

只输出prompt文本，不要其他内容。`

export function PropDesigner({ project }: Props) {
  const [props, setProps] = useState<Prop[]>(project.props)
  const [selectedId, setSelectedId] = useState<string | null>(project.props[0]?.id || null)
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({ name: '', description: '', prompt: '' })

  const [generatingPrompt, setGeneratingPrompt] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imageStatus, setImageStatus] = useState<string>('')
  const [selectedPromptConfig, setSelectedPromptConfig] = useState<any>(null)
  const [selectedModel, setSelectedModel] = useState<string>('glm-5')

  const pollingImageRef = useRef(false)

  const selected = props.find(p => p.id === selectedId)

  useEffect(() => {
    if (!selected || !selected.imageTaskId || selected.imageUrl || pollingImageRef.current) return

    pollingImageRef.current = true
    setGeneratingImage(true)
    setImageStatus('恢复轮询中...')

    pollTaskStatus(selected.id, selected.imageTaskId)
      .finally(() => {
        setGeneratingImage(false)
        setImageStatus('')
        pollingImageRef.current = false
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected?.imageTaskId])

  const updateSelected = (patch: Partial<Prop>) => {
    setProps(prev => prev.map(p => p.id === selectedId ? { ...p, ...patch } : p))
  }

  const pollTaskStatus = async (propId: string, taskId: string) => {
    while (true) {
      try {
        const res = await fetch(
          `/api/projects/${project.id}/props/${propId}/image/status?taskId=${taskId}`
        )
        const data = await res.json()

        if (data.status === 'QUEUED' || data.status === 'RUNNING') {
          setImageStatus(data.message || '生成中...')
          await new Promise(r => setTimeout(r, 3000))
          continue
        }

        if (data.status === 'SUCCESS') {
          setProps(prev => prev.map(p =>
            p.id === propId ? { ...p, imageUrl: data.imageUrl, imageTaskId: null } : p
          ))
          toast.success('图片生成成功')
          break
        }

        toast.error(data.error || '图片生成失败')
        break
      } catch (error) {
        console.error('Failed to poll image status:', error)
        toast.error('图片生成失败')
        break
      }
    }
  }

  const handleExtract = async () => {
    setExtracting(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/props/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.props) {
        setProps(data.props)
        if (data.props.length > 0) setSelectedId(data.props[0].id)
      }
    } catch (error) {
      console.error('Failed to extract props:', error)
      toast.error('道具提取失败')
    } finally {
      setExtracting(false)
    }
  }

  const handleCreate = async () => {
    if (!addForm.name.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/props`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const prop = await res.json()
      setProps([...props, prop])
      setSelectedId(prop.id)
      setAddForm({ name: '', description: '', prompt: '' })
      setIsAddDialogOpen(false)
    } catch (error) {
      console.error('Failed to create prop:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!selected) return
    setLoading(true)
    try {
      await fetch(`/api/projects/${project.id}/props/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected),
      })
      toast.success('保存成功')
    } catch (error) {
      console.error('Failed to update prop:', error)
      toast.error('保存失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/projects/${project.id}/props/${id}`, { method: 'DELETE' })
      const newProps = props.filter(p => p.id !== id)
      setProps(newProps)
      if (selectedId === id) setSelectedId(newProps[0]?.id || null)
    } catch (error) {
      console.error('Failed to delete prop:', error)
    }
  }

  const handleGeneratePrompt = async () => {
    if (!selected) return
    setGeneratingPrompt(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/props/${selected.id}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: selectedPromptConfig?.systemPrompt,
          userPrompt: selectedPromptConfig?.userPrompt,
        }),
      })
      const data = await res.json()
      if (data.prompt) {
        updateSelected({ prompt: data.prompt })
        toast.success('Prompt 生成成功')
      } else {
        toast.error(data.error || 'Prompt 生成失败')
      }
    } catch (error) {
      console.error('Failed to generate prompt:', error)
      toast.error('Prompt 生成失败')
    } finally {
      setGeneratingPrompt(false)
    }
  }

  const handleGenerateImage = async () => {
    if (!selected) return
    if (!selected.prompt) {
      toast.error('请先生成绘图 Prompt')
      return
    }
    setGeneratingImage(true)
    setImageStatus('提交任务中...')
    try {
      const res = await fetch(`/api/projects/${project.id}/props/${selected.id}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: selected.prompt, aspectRatio: '1:1' }),
      })
      const data = await res.json()

      if (data.status === 'QUEUED' || data.status === 'RUNNING') {
        updateSelected({ imageTaskId: data.taskId })
        setImageStatus(data.message || '生成中...')
        await pollTaskStatus(selected.id, data.taskId)
      } else if (data.status === 'SUCCESS') {
        updateSelected({ imageUrl: data.imageUrl, imageTaskId: null })
        toast.success('图片生成成功')
      } else {
        toast.error(data.error || '图片生成失败')
      }
    } catch (error) {
      console.error('Failed to generate image:', error)
      toast.error('图片生成失败')
    } finally {
      setGeneratingImage(false)
      setImageStatus('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：道具列表 */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              从剧本提取道具
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleExtract} disabled={extracting} className="w-full">
              {extracting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提取中...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />从剧本提取道具</>
              )}
            </Button>
          </CardContent>

          <CardHeader className="pt-2 pb-3 border-t">
            <CardTitle className="text-base flex items-center justify-between">
              <span>道具列表</span>
              <Badge variant="secondary">{props.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[320px]">
              {props.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无道具</p>
                  <p className="text-xs mt-1">从剧本提取或手动添加</p>
                </div>
              ) : (
                <div className="space-y-2 pr-2">
                  {props.map(prop => {
                    const isSelected = selectedId === prop.id
                    return (
                      <div
                        key={prop.id}
                        onClick={() => setSelectedId(prop.id)}
                        className={`p-3 rounded-lg cursor-pointer border transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                            {prop.imageUrl ? (
                              <img src={prop.imageUrl} alt={prop.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{prop.name}</span>
                              {isSelected && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {prop.description || '暂无描述'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
            <Button variant="outline" className="w-full mt-3" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />手动添加道具
            </Button>
          </CardContent>
        </Card>

        {/* 右侧：道具详情 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>道具详情</span>
              {selected && (
                <Button
                  variant="ghost" size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 h-8"
                  onClick={() => handleDelete(selected.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />删除
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selected ? (
              <Tabs defaultValue="design">
                <TabsList className="mb-4">
                  <TabsTrigger value="design" className="gap-1.5">
                    <Wand2 className="w-4 h-4" />道具设计
                  </TabsTrigger>
                  <TabsTrigger value="config" className="gap-1.5">
                    <Settings2 className="w-4 h-4" />配置
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="design" className="space-y-4 mt-0">
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">道具名</Label>
                    <Input
                      value={selected.name}
                      onChange={e => updateSelected({ name: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">描述</Label>
                    <Textarea
                      value={selected.description}
                      onChange={e => updateSelected({ description: e.target.value })}
                      placeholder="道具外观、材质、状态..."
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-sm font-medium">绘图 Prompt</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGeneratePrompt}
                        disabled={generatingPrompt}
                        className="h-7 text-xs"
                      >
                        {generatingPrompt ? (
                          <><Loader2 className="w-3 h-3 mr-1 animate-spin" />生成中...</>
                        ) : (
                          <><Sparkles className="w-3 h-3 mr-1" />AI 生成 Prompt</>
                        )}
                      </Button>
                    </div>
                    <Textarea
                      value={selected.prompt || ''}
                      onChange={e => updateSelected({ prompt: e.target.value })}
                      placeholder="English prompt for image generation..."
                      className="min-h-[100px] font-mono text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">道具图片</Label>
                    <div className="flex gap-4">
                      <div className="w-[160px] h-[160px] bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                        {selected.imageUrl ? (
                          <img
                            src={selected.imageUrl}
                            alt={selected.name}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setPreviewImage(selected.imageUrl)}
                          />
                        ) : generatingImage ? (
                          <div className="text-center text-muted-foreground p-2">
                            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                            <p className="text-xs">{imageStatus || '生成中...'}</p>
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground">
                            <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-xs">暂无图片</p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleGenerateImage}
                          disabled={generatingImage || !selected.prompt}
                          className="h-8 text-xs"
                        >
                          {generatingImage ? (
                            <><Loader2 className="w-3 h-3 mr-1 animate-spin" />{imageStatus || '生成中...'}</>
                          ) : (
                            <><ImageIcon className="w-3 h-3 mr-1" />生成图片</>
                          )}
                        </Button>
                        {!selected.prompt && (
                          <p className="text-xs text-muted-foreground">请先生成 Prompt</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button onClick={handleUpdate} disabled={loading}>
                      {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</> : '保存'}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="config" className="space-y-4 mt-0">
                  <PromptConfigPanel
                    projectId={project.id}
                    type="prop"
                    defaultSystemPrompt={DEFAULT_SYSTEM_PROMPT}
                    onPromptSelect={setSelectedPromptConfig}
                    selectedPromptId={selectedPromptConfig?.id}
                  />
                  <ModelSelector
                    value={selectedModel}
                    onChange={setSelectedModel}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>选择一个道具查看详情</p>
                <p className="text-sm mt-1">或从剧本提取 / 手动添加道具</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加道具</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">道具名</Label>
              <Input
                value={addForm.name}
                onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="如：破旧手机"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">描述</Label>
              <Textarea
                value={addForm.description}
                onChange={e => setAddForm({ ...addForm, description: e.target.value })}
                placeholder="道具外观、材质、状态..."
                className="min-h-[80px]"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">绘图 Prompt（可选）</Label>
              <Textarea
                value={addForm.prompt}
                onChange={e => setAddForm({ ...addForm, prompt: e.target.value })}
                placeholder="English prompt..."
                className="min-h-[60px] font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={loading || !addForm.name.trim()}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />创建中...</> : '创建道具'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl p-2">
          {previewImage && (
            <img src={previewImage} alt="预览" className="w-full h-auto max-h-[80vh] object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
