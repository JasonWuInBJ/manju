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

const DEFAULT_SYSTEM_PROMPT = `# Role
你是一位专业的游戏与动漫道具设计师，擅长设计具有故事感的物品资产。你需要生成用于AI绘图的提示词。
# Task
根据输入的【道具描述】，生成一张高清、背景干净的道具设计图Prompt。
# Constraints & Logic
1. **背景控制（关键）**：
   - 必须包含 \`isolated on white background\`（白底孤立）或 \`simple clean background\`（简单干净背景）。
   - 必须包含 \`sharp edges\`（边缘清晰），方便后期自动抠图去除背景。
   - 绝对禁止复杂的场景背景，以免道具与背景融合无法分离。
2. **视角与构图**：
   - 默认视角：\`Front view\`（正视图）或 \`Side view\`（侧视图）。
   - 构图：道具居中，完整展示，\`centered composition\`。
3. **细节与质感**：
   - 必须强调材质感：如 \`metallic texture\`（金属质感）、\`rusty\`（生锈）、\`glowing\`（发光）。
   - 必须包含 \`highly detailed\`, \`8k resolution\`, \`texture details\`。
4. **风格统一**：
   - 道具风格需与漫剧整体画风保持一致（如：二次元、赛博朋克、写实等）。
   - 默认添加 \`unreal engine 5 render style\` 或 \`anime art style\`（根据你的画风二选一）。
5. **故事感修饰**：
   - 如果道具是旧物，自动添加 \`worn out\`, \`scratches\` 等细节；如果是新物，添加 \`brand new\`, \`shiny\`。
# Prompt Structure
[Subject Description], [Material & Details], [Condition/Story Elements], [Background Requirement], [Lighting], [Style & Quality].
# Input Data
道具描述：
{{Prop_Description}}
# Output
仅输出Prompt文本。
# Example
Input: 苏烬的旧手机，屏幕裂了。
Output:
A broken smartphone, screen with cracked glass and spiderweb patterns, worn-out black metal casing, scratches on the sides, isolated on white background, studio lighting, soft shadows, highly detailed texture, 8k resolution, cinematic prop design, sharp focus.`

const DEFAULT_EXTRACT_SYSTEM_PROMPT = `# Role
你是一位专业的影视道具设计师和AI绘图提示词专家。你擅长从剧本文字中提炼关键道具，并将其转化为用于生成高质量道具参考图的英文提示词。

# Task
分析提供的【剧本内容】，提取出所有重要的"道具资产"，并为每个道具生成用于AI绘图的英文提示词。

# Constraints & Logic
1. **道具定义**：道具是剧情中出现的具体物品，如武器、交通工具、重要物件、标志性器物等。
2. **排除项**：不包括人物、地点/场景、抽象概念、普通背景物品（椅子、桌子等通用家具）。
3. **去重**：相同道具只提取一次，合并同类项。
4. **视觉转化**：生成的 prompt 需要描述道具的外观特征、材质、状态、风格。
5. **输出控制**：输出为标准JSON格式，不要包含Markdown标记或其他废话。

# Output Schema
{
  "props": [
    {
      "name": "道具中文名",
      "description": "道具中文描述，包括外观、材质、状态等",
      "prompt": "High-quality English prompt for the prop. Structure: [Object] + [Material & Texture] + [Condition & Details] + [Style & Quality]. No humans, isolated object or in context."
    }
  ]
}

只输出JSON，不要其他内容。`

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
  const [selectedExtractPromptConfig, setSelectedExtractPromptConfig] = useState<any>(null)

  const pollingImageRef = useRef(false)

  const selected = props.find(p => p.id === selectedId)

  // Load default extract prompt config on mount
  useEffect(() => {
    const loadExtractConfig = async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}/prompts`)
        const data = await res.json()
        const extractConfigs = data.filter((c: any) => c.type === 'prop_extract')
        if (extractConfigs.length > 0) {
          const defaultConfig = extractConfigs.find((c: any) => c.isDefault) || extractConfigs[0]
          setSelectedExtractPromptConfig(defaultConfig)
        }
      } catch (error) {
        console.error('Failed to load extract prompt config:', error)
      }
    }
    loadExtractConfig()
  }, [project.id])

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
        body: JSON.stringify({
          systemPrompt: selectedExtractPromptConfig?.systemPrompt,
          userPrompt: selectedExtractPromptConfig?.userPrompt,
        }),
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
                  <PromptConfigPanel
                    projectId={project.id}
                    type="prop_extract"
                    defaultSystemPrompt={DEFAULT_EXTRACT_SYSTEM_PROMPT}
                    defaultUserPrompt="请从以下剧本中提取道具资产：\n\n{script}"
                    onPromptSelect={setSelectedExtractPromptConfig}
                    selectedPromptId={selectedExtractPromptConfig?.id}
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
