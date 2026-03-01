'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PromptConfigPanel } from './prompt-config-panel'
import { Sparkles, Settings, Loader2, Image as ImageIcon, Plus, MapPin, Check, FileText, Trash2, ChevronDown, ChevronRight } from 'lucide-react'

interface Scene {
  id: string
  name: string
  description: string
  time: string
  mood: string
  weather: string
  prompt: string | null
  negativePrompt: string | null
  imageUrl: string | null
  imageTaskId: string | null
  scriptId: string | null
  location: string | null
  region: string | null
  environmentType: string | null
  era: string | null
  season: string | null
  sceneFunction: string | null
  spaceLayout: string | null
}

interface Script {
  id: string
  episode: number
  title: string
  content: string
}

interface Project {
  id: string
  title: string
  scenes: Scene[]
  scripts: Script[]
}

interface Props {
  project: Project
}

const TIME_MAP: Record<string, string> = {
  dawn: 'early morning, golden hour',
  day: 'daytime, bright natural light',
  dusk: 'sunset, warm orange light',
  night: 'night time, dim lighting',
}

const MOOD_MAP: Record<string, string> = {
  warm: 'cozy, comfortable atmosphere',
  tense: 'tense, suspenseful atmosphere',
  mysterious: 'mysterious, enigmatic atmosphere',
  neutral: 'neutral atmosphere',
}

const DEFAULT_SYSTEM_PROMPT = `你是一位二次元动画美术总监。根据场景信息和剧本内容生成适合AI绘图的英文Prompt。

输出要求：
1. 场景概念设计图描述
2. 包含环境、光影、氛围
3. 参考剧本内容理解场景的故事背景
4. 二次元赛璐璐风格
5. 纯英文输出
6. 不包含任何人物

只输出prompt文本，不要其他内容。`

const DEFAULT_USER_PROMPT_TEMPLATE = `{scene_info}

剧本参考：
{script}`

const EXTRACT_DEFAULT_SYSTEM_PROMPT = `# Role
你是一位专业的影视概念设计师和AI绘图提示词专家。你擅长从剧本文字中提炼场景环境，并将其转化为用于生成高质量背景美术资产的英文提示词。

# Task
分析提供的【剧本内容】，提取出所有独立的"关键场景"，并为每个场景生成用于Stable Diffusion/Midjourney生成的英文提示词。

# Constraints & Logic
1. **去重与合并**：识别剧本中的地点名称，合并相同地点。如果同一地点在不同时间段（日/夜）视觉差异巨大，则分开提取。
2. **视觉转化**：
   - **环境主体**：建筑结构、室内布局（如：dirty cheap apartment room）。
   - **细节填充**：根据剧本描述自动脑补合理的道具细节（如：剧本写"满地烟头"，Prompt需补充 \`floor littered with cigarette butts, messy desk\`）。
   - **氛围光影**：提取时间（Night）、情绪（Gloomy），转化为光线描述（\`dim lighting, cold blue tone, cinematic shadows\`）。
3. **构图标准**：默认添加 \`scenery, background art, no humans, wide shot, highly detailed\`，确保生成的是干净的背景图，无人物干扰。
4. **输出控制**：输出为标准JSON格式，不要包含Markdown标记或其他废话。

# Output Schema
{
  "scenes": [
    {
      "scene_id": "unique_id (如 scene_01)",
      "scene_name": "场景中文名",
      "description": "场景描述",
      "time": "时间 (Day/Night/Dawn/Dusk)",
      "weather": "天气 (Clear/Cloudy/Rain/Heavy Rain/Snow/Fog/Storm)",
      "mood": "氛围 (warm/tense/mysterious/neutral)",
      "prompt": "High-quality English prompt. Structure: [Environment Subject] + [Props & Details] + [Lighting & Atmosphere] + [Style & Quality]. Must include 'no humans'.",
      "negative_prompt": "people, humans, character, text, signature, watermark, low quality, blurry"
    }
  ]
}

只输出JSON，不要其他内容。`

const EXTRACT_DEFAULT_USER_PROMPT_TEMPLATE = `请从以下剧本中提取场景：\n\n{script}`

const TIME_OPTIONS = [
  { value: 'dawn', label: '清晨' },
  { value: 'day', label: '白天' },
  { value: 'dusk', label: '黄昏' },
  { value: 'night', label: '夜晚' },
]

const MOOD_OPTIONS = [
  { value: 'warm', label: '温馨' },
  { value: 'tense', label: '紧张' },
  { value: 'mysterious', label: '神秘' },
  { value: 'neutral', label: '中性' },
]

const WEATHER_OPTIONS = [
  { value: 'Clear', label: '晴天' },
  { value: 'Cloudy', label: '多云' },
  { value: 'Rain', label: '小雨' },
  { value: 'Heavy Rain', label: '大雨' },
  { value: 'Snow', label: '雪' },
  { value: 'Fog', label: '雾' },
  { value: 'Storm', label: '暴风雨' },
]

interface SceneForm {
  name: string
  description: string
  time: string
  mood: string
  weather: string
}

const emptyForm: SceneForm = {
  name: '',
  description: '',
  time: 'day',
  mood: 'neutral',
  weather: 'Clear',
}

const ASPECT_RATIO_OPTIONS = [
  { value: '16:9', label: '16:9 (横屏)' },
  { value: '4:3', label: '4:3 (标准)' },
  { value: '1:1', label: '1:1 (方形)' },
  { value: '3:4', label: '3:4 (竖屏)' },
  { value: '9:16', label: '9:16 (手机)' },
]

export function SceneDesigner({ project }: Props) {
  const [scenes, setScenes] = useState<Scene[]>(project.scenes)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(
    project.scripts[0]?.id || null
  )
  const [form, setForm] = useState<SceneForm>(emptyForm)
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [selectedPromptConfig, setSelectedPromptConfig] = useState<any>(null)
  const [selectedExtractPromptConfig, setSelectedExtractPromptConfig] = useState<any>(null)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imageProgress, setImageProgress] = useState('')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [detailsOpen, setDetailsOpen] = useState(false)

  // 添加 ref 防止重复轮询
  const pollingImageRef = useRef(false)

  // 弹窗状态
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  // 图片预览弹窗
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // 恢复图片生成轮询
  useEffect(() => {
    const selected = scenes.find(s => s.id === selectedId)

    if (!selected || !selected.imageTaskId || pollingImageRef.current) {
      return
    }

    // 如果有 taskId 但没有 imageUrl，说明任务还在进行中
    if (!selected.imageUrl) {
      console.log('[Scene Image] 恢复图片生成轮询', {
        sceneId: selected.id,
        taskId: selected.imageTaskId,
      })

      pollingImageRef.current = true
      setGeneratingImage(true)
      setImageProgress('恢复图片生成中...')

      // 恢复轮询
      pollTaskStatus(selected.imageTaskId)
        .then(result => {
          if (result.status === 'SUCCESS' && result.imageUrl) {
            setScenes(prev => prev.map(s =>
              s.id === selected.id ? { ...s, imageUrl: result.imageUrl || null, imageTaskId: null } : s
            ))
          }
        })
        .catch(error => {
          console.error('[Scene Image] 恢复轮询失败', error)
        })
        .finally(() => {
          setGeneratingImage(false)
          setImageProgress('')
          pollingImageRef.current = false
        })
    }
  }, [selectedId, scenes])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      pollingImageRef.current = false
    }
  }, [])

  // 按剧集筛选场景
  const filteredScenes = selectedScriptId
    ? scenes.filter(s => s.scriptId === selectedScriptId)
    : scenes.filter(s => !s.scriptId)

  const selected = scenes.find(s => s.id === selectedId)
  const selectedScript = project.scripts.find(s => s.id === selectedScriptId)

  // 切换剧集时重置选中的场景
  const handleScriptChange = (scriptId: string) => {
    setSelectedScriptId(scriptId)
    setSelectedId(null)
    setPrompt('')
    setNegativePrompt('')
  }

  const handleExtract = async () => {
    if (!selectedScriptId || !selectedScript?.content) return
    setExtracting(true)
    try {
      const extractBody: Record<string, string> = { scriptId: selectedScriptId }
      if (selectedExtractPromptConfig) {
        extractBody.systemPrompt = selectedExtractPromptConfig.systemPrompt
        if (selectedExtractPromptConfig.userPrompt) {
          extractBody.userPrompt = selectedExtractPromptConfig.userPrompt
        }
      }
      const res = await fetch(`/api/projects/${project.id}/scenes/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extractBody),
      })
      const data = await res.json()
      if (data.scenes) {
        // 更新场景列表：移除该剧集的旧场景，添加新场景
        const otherScenes = scenes.filter(s => s.scriptId !== selectedScriptId)
        const newScenes = [...otherScenes, ...data.scenes]
        setScenes(newScenes)
        if (data.scenes.length > 0) setSelectedId(data.scenes[0].id)
      }
    } catch (error) {
      console.error('Failed to extract:', error)
    } finally {
      setExtracting(false)
    }
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, scriptId: selectedScriptId }),
      })
      const scene = await res.json()
      setScenes([...scenes, scene])
      setSelectedId(scene.id)
      setPrompt('')
      setForm(emptyForm)
      setIsAddDialogOpen(false)
    } catch (error) {
      console.error('Failed to create:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePrompt = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const timeDesc = TIME_MAP[selected.time] || TIME_MAP['day']
      const moodDesc = MOOD_MAP[selected.mood] || MOOD_MAP['neutral']

      let systemPrompt = DEFAULT_SYSTEM_PROMPT
      let userPrompt = DEFAULT_USER_PROMPT_TEMPLATE

      // 如果选择了自定义配置，使用配置的Prompt
      if (selectedPromptConfig) {
        systemPrompt = selectedPromptConfig.systemPrompt
        userPrompt = selectedPromptConfig.userPrompt || DEFAULT_USER_PROMPT_TEMPLATE
      }

      // 获取剧本内容作为参考
      const scriptContent = selectedScript?.content || '暂无剧本'

      // 构建完整的场景信息
      const sceneInfo = [
        `场景名：${selected.name}`,
        `描述：${selected.description}`,
        selected.location ? `空间位置：${selected.location}` : '',
        selected.region ? `地域坐标：${selected.region}` : '',
        selected.environmentType ? `环境类型：${selected.environmentType}` : '',
        selected.era ? `年代：${selected.era}` : '',
        selected.season ? `季节：${selected.season}` : '',
        selected.sceneFunction ? `场景功能：${selected.sceneFunction}` : '',
        selected.spaceLayout ? `空间布局：${selected.spaceLayout}` : '',
        `时间：${timeDesc}`,
        `天气：${selected.weather || 'Clear'}`,
        `氛围：${moodDesc}`,
      ].filter(Boolean).join('\n')

      // 替换用户提示词中的占位符
      const finalUserPrompt = userPrompt
        .replace('{name}', selected.name)
        .replace('{description}', selected.description)
        .replace('{time}', timeDesc)
        .replace('{mood}', moodDesc)
        .replace('{script}', scriptContent)
        .replace('{scene_info}', sceneInfo)

      const res = await fetch(`/api/projects/${project.id}/scenes/${selected.id}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          userPrompt: finalUserPrompt,
        }),
      })
      const data = await res.json()
      setPrompt(data.prompt || '')
      setNegativePrompt(data.negativePrompt || '')
      setScenes(scenes.map(s => s.id === selected.id ? { ...s, prompt: data.prompt, negativePrompt: data.negativePrompt } : s))
    } catch (error) {
      console.error('Failed to generate prompt:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/projects/${project.id}/scenes/${id}`, { method: 'DELETE' })
      const newScenes = scenes.filter(s => s.id !== id)
      setScenes(newScenes)
      if (selectedId === id) setSelectedId(newScenes[0]?.id || null)
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const handleUpdate = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/scenes/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selected, prompt, negativePrompt }),
      })
      const updated = await res.json()
      setScenes(scenes.map(s => s.id === updated.id ? updated : s))
    } catch (error) {
      console.error('Failed to update:', error)
    } finally {
      setLoading(false)
    }
  }

  const pollTaskStatus = async (taskId: string): Promise<{ status: string; imageUrl?: string | null }> => {
    console.log('[Scene Image] 开始轮询任务状态', { taskId })
    const maxAttempts = 36 // 约 3 分钟
    let attempts = 0

    while (attempts < maxAttempts) {
      attempts++
      setImageProgress(`生成中... (${attempts}/${maxAttempts})`)

      try {
        const res = await fetch(
          `/api/projects/${project.id}/scenes/${selected!.id}/image/status?taskId=${taskId}`
        )
        const data = await res.json()

        if (data.status === 'SUCCESS') {
          return { status: 'SUCCESS', imageUrl: data.imageUrl }
        }

        if (data.status === 'FAILED') {
          return { status: 'FAILED' }
        }

        // QUEUED 或 RUNNING，继续轮询
        setImageProgress(data.message || '生成中...')
      } catch (error) {
        console.error('Poll error:', error)
      }

      // 等待 5 秒后继续
      await new Promise(resolve => setTimeout(resolve, 5000))
    }

    return { status: 'TIMEOUT' }
  }

  const handleGenerateImage = async () => {
    if (!selected || !prompt) return
    setGeneratingImage(true)
    setImageProgress('提交任务中...')

    try {
      const res = await fetch(`/api/projects/${project.id}/scenes/${selected.id}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio }),
      })

      const data = await res.json()

      if (data.error) {
        alert(data.error)
        return
      }

      // 如果直接返回成功
      if (data.status === 'SUCCESS' && data.imageUrl) {
        setScenes(scenes.map(s => s.id === selected.id ? { ...s, imageUrl: data.imageUrl } : s))
        return
      }

      // 需要轮询
      if (data.taskId) {
        // 立即保存 taskId 到本地状态
        setScenes(prev => prev.map(s =>
          s.id === selected.id ? { ...s, imageTaskId: data.taskId } : s
        ))

        setImageProgress(data.message || '任务排队中...')
        pollingImageRef.current = true

        const result = await pollTaskStatus(data.taskId)

        if (result.status === 'SUCCESS' && result.imageUrl) {
          setScenes(prev => prev.map(s =>
            s.id === selected.id ? { ...s, imageUrl: result.imageUrl || null, imageTaskId: null } : s
          ))
        } else if (result.status === 'TIMEOUT') {
          alert('图片生成超时，请稍后重试')
        } else {
          alert('图片生成失败')
        }

        pollingImageRef.current = false
      }
    } catch (error) {
      console.error('Failed to generate image:', error)
      alert('图片生成失败')
    } finally {
      setGeneratingImage(false)
      setImageProgress('')
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="design" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
          <TabsTrigger value="design" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md rounded-lg transition-all">
            <Sparkles className="w-4 h-4 mr-2" />
            场景设计
          </TabsTrigger>
          <TabsTrigger value="config" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md rounded-lg transition-all">
            <Settings className="w-4 h-4 mr-2" />
            配置
          </TabsTrigger>
        </TabsList>
        <TabsContent value="design" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左侧列：场景列表 */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  从剧本提取场景
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 剧集选择 */}
                {project.scripts.length > 0 ? (
                  <>
                    <Select value={selectedScriptId || ''} onValueChange={handleScriptChange}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="选择剧集" />
                      </SelectTrigger>
                      <SelectContent>
                        {project.scripts.map(script => (
                          <SelectItem key={script.id} value={script.id}>
                            第{script.episode}集 - {script.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleExtract}
                      disabled={extracting || !selectedScriptId || !selectedScript?.content}
                      className="w-full"
                    >
                      {extracting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          提取中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          从剧本提取场景
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    请先创建剧本
                  </p>
                )}
              </CardContent>

              {/* 场景列表 */}
              <CardHeader className="pt-2 pb-3 border-t">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>场景列表 {selectedScript && `(第${selectedScript.episode}集)`}</span>
                  <Badge variant="secondary">{filteredScenes.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[320px]">
                  {filteredScenes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MapPin className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂无场景</p>
                      <p className="text-xs mt-1">从剧本提取或手动添加</p>
                    </div>
                  ) : (
                    <div className="space-y-2 pr-2">
                      {filteredScenes.map(scene => {
                        const isSelected = selectedId === scene.id
                        return (
                          <div
                            key={scene.id}
                            onClick={() => { setSelectedId(scene.id); setPrompt(scene.prompt || ''); setNegativePrompt(scene.negativePrompt || '') }}
                            className={`
                              p-3 rounded-lg cursor-pointer border transition-all
                              ${isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                              }
                            `}
                          >
                            <div className="flex items-start gap-3">
                              {/* 缩略图 */}
                              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                {scene.imageUrl ? (
                                  <img src={scene.imageUrl} alt={scene.name} className="w-full h-full object-cover" />
                                ) : (
                                  <MapPin className="w-5 h-5 text-slate-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm truncate">{scene.name}</span>
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-blue-500 shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                                    {TIME_OPTIONS.find(t => t.value === scene.time)?.label || scene.time}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                                    {MOOD_OPTIONS.find(m => m.value === scene.mood)?.label || scene.mood}
                                  </Badge>
                                  {scene.weather && scene.weather !== 'Clear' && (
                                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                                      {WEATHER_OPTIONS.find(w => w.value === scene.weather)?.label || scene.weather}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {scene.description || '暂无描述'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>

                {/* 手动添加按钮 */}
                <Button
                  variant="outline"
                  className="w-full mt-3"
                  onClick={() => setIsAddDialogOpen(true)}
                  disabled={!selectedScriptId}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  手动添加场景
                </Button>
              </CardContent>
            </Card>

            {/* 右侧列：场景详情 */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>场景详情</span>
                  {selected && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 h-8"
                      onClick={() => handleDelete(selected.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      删除
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selected ? (
                  <div className="space-y-4">
                    {/* 场景信息编辑 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium mb-1.5 block">场景名</Label>
                        <Input
                          value={selected.name}
                          onChange={e => setScenes(scenes.map(s => s.id === selected.id ? { ...s, name: e.target.value } : s))}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-1.5 block">时间</Label>
                        <Select value={selected.time} onValueChange={v => setScenes(scenes.map(s => s.id === selected.id ? { ...s, time: v } : s))}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium mb-1.5 block">氛围</Label>
                        <Select value={selected.mood} onValueChange={v => setScenes(scenes.map(s => s.id === selected.id ? { ...s, mood: v } : s))}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MOOD_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-1.5 block">天气</Label>
                        <div className="flex gap-2">
                          <Select value={WEATHER_OPTIONS.find(w => w.value === selected.weather) ? selected.weather : '__custom'} onValueChange={v => {
                            if (v !== '__custom') setScenes(scenes.map(s => s.id === selected.id ? { ...s, weather: v } : s))
                          }}>
                            <SelectTrigger className="h-9 flex-1">
                              <SelectValue placeholder="选择天气" />
                            </SelectTrigger>
                            <SelectContent>
                              {WEATHER_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                              {!WEATHER_OPTIONS.find(w => w.value === selected.weather) && selected.weather && (
                                <SelectItem value="__custom">{selected.weather}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <Input
                            value={selected.weather}
                            onChange={e => setScenes(scenes.map(s => s.id === selected.id ? { ...s, weather: e.target.value } : s))}
                            placeholder="自定义天气"
                            className="h-9 w-[120px]"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">描述</Label>
                      <Textarea
                        value={selected.description}
                        onChange={e => setScenes(scenes.map(s => s.id === selected.id ? { ...s, description: e.target.value } : s))}
                        placeholder="场景细节..."
                        className="min-h-[80px] resize-none"
                      />
                    </div>

                    {/* 绘图 Prompt */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">绘图 Prompt</Label>
                      <Textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="点击下方按钮生成..."
                        className="min-h-[100px] font-mono text-sm"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          onClick={handleGeneratePrompt}
                          disabled={loading}
                          variant="outline"
                          size="sm"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              生成中...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              重新生成 Prompt
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Negative Prompt */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Negative Prompt</Label>
                      <Textarea
                        value={negativePrompt}
                        onChange={e => setNegativePrompt(e.target.value)}
                        placeholder="people, humans, character, text, signature, watermark, low quality, blurry"
                        className="min-h-[60px] font-mono text-sm"
                      />
                    </div>

                    {/* 场景图片 */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">场景图片</Label>
                      <div className="flex gap-4">
                        <div className="aspect-video w-[280px] bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden relative">
                          {generatingImage && (
                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10">
                              <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                              <p className="text-white text-xs">{imageProgress || '生成中...'}</p>
                            </div>
                          )}
                          {selected.imageUrl ? (
                            <img
                              src={selected.imageUrl}
                              alt={selected.name}
                              className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setPreviewImage(selected.imageUrl)}
                            />
                          ) : (
                            <div className="text-center text-muted-foreground">
                              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p className="text-xs">暂无图片</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">图片比例</Label>
                            <Select value={aspectRatio} onValueChange={setAspectRatio}>
                              <SelectTrigger className="w-[120px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ASPECT_RATIO_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            onClick={handleGenerateImage}
                            disabled={generatingImage || !prompt}
                            size="sm"
                            className="w-full"
                          >
                            {generatingImage ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                生成中...
                              </>
                            ) : (
                              <>
                                <ImageIcon className="w-4 h-4 mr-2" />
                                生成图片
                              </>
                            )}
                          </Button>
                          {!prompt && (
                            <p className="text-xs text-muted-foreground">
                              请先生成 Prompt
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 详细信息（折叠） */}
                    <div className="border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setDetailsOpen(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <span>详细信息</span>
                        {detailsOpen
                          ? <ChevronDown className="w-4 h-4 text-slate-400" />
                          : <ChevronRight className="w-4 h-4 text-slate-400" />
                        }
                      </button>
                      {detailsOpen && (
                        <div className="px-4 pb-4 pt-2 space-y-3 border-t">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs font-medium mb-1 block text-muted-foreground">空间位置</Label>
                              <Input
                                value={selected.location || ''}
                                onChange={e => setScenes(scenes.map(s => s.id === selected.id ? { ...s, location: e.target.value } : s))}
                                placeholder="如：EXT-第108层天桥-栏杆旁"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium mb-1 block text-muted-foreground">地域坐标</Label>
                              <Input
                                value={selected.region || ''}
                                onChange={e => setScenes(scenes.map(s => s.id === selected.id ? { ...s, region: e.target.value } : s))}
                                placeholder="如：亚洲-中国-新九龙"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium mb-1 block text-muted-foreground">环境类型</Label>
                              <Select
                                value={selected.environmentType || ''}
                                onValueChange={v => setScenes(scenes.map(s => s.id === selected.id ? { ...s, environmentType: v } : s))}
                              >
                                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="选择环境类型" /></SelectTrigger>
                                <SelectContent>
                                  {['城市', '室内', '自然', '太空', '水下', '其他'].map(v => (
                                    <SelectItem key={v} value={v}>{v}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs font-medium mb-1 block text-muted-foreground">年代坐标</Label>
                              <Input
                                value={selected.era || ''}
                                onChange={e => setScenes(scenes.map(s => s.id === selected.id ? { ...s, era: e.target.value } : s))}
                                placeholder="如：未来-中国"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium mb-1 block text-muted-foreground">季节</Label>
                              <Select
                                value={selected.season || ''}
                                onValueChange={v => setScenes(scenes.map(s => s.id === selected.id ? { ...s, season: v } : s))}
                              >
                                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="选择季节" /></SelectTrigger>
                                <SelectContent>
                                  {['春季', '夏季', '秋季', '冬季'].map(v => (
                                    <SelectItem key={v} value={v}>{v}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs font-medium mb-1 block text-muted-foreground">场景功能</Label>
                              <Input
                                value={selected.sceneFunction || ''}
                                onChange={e => setScenes(scenes.map(s => s.id === selected.id ? { ...s, sceneFunction: e.target.value } : s))}
                                placeholder="如：开场介绍;起(背景铺垫)"
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs font-medium mb-1 block text-muted-foreground">空间区域划分</Label>
                            <Input
                              value={selected.spaceLayout || ''}
                              onChange={e => setScenes(scenes.map(s => s.id === selected.id ? { ...s, spaceLayout: e.target.value } : s))}
                              placeholder="如：天桥栏杆边缘-玻璃幕墙外侧"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 保存按钮 */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button onClick={handleUpdate} disabled={loading}>
                        保存
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-muted-foreground">
                    <MapPin className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>选择一个场景查看详情</p>
                    <p className="text-sm mt-1">或从剧本提取 / 手动添加场景</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="config" className="space-y-6 mt-6">
          <PromptConfigPanel
            projectId={project.id}
            type="scene"
            defaultSystemPrompt={DEFAULT_SYSTEM_PROMPT}
            defaultUserPrompt={DEFAULT_USER_PROMPT_TEMPLATE}
            onPromptSelect={setSelectedPromptConfig}
            selectedPromptId={selectedPromptConfig?.id}
          />

          {/* 场景提取 Prompt 配置 */}
          <PromptConfigPanel
            projectId={project.id}
            type="scene_extract"
            defaultSystemPrompt={EXTRACT_DEFAULT_SYSTEM_PROMPT}
            defaultUserPrompt={EXTRACT_DEFAULT_USER_PROMPT_TEMPLATE}
            onPromptSelect={setSelectedExtractPromptConfig}
            selectedPromptId={selectedExtractPromptConfig?.id}
          />
        </TabsContent>
      </Tabs>

      {/* 手动添加场景弹窗 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加场景</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">场景名</Label>
              <Input
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                placeholder="如：出租屋"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">时间</Label>
              <Select value={form.time} onValueChange={v => setForm({...form, time: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">氛围</Label>
              <Select value={form.mood} onValueChange={v => setForm({...form, mood: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOOD_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">天气</Label>
              <Select value={form.weather} onValueChange={v => setForm({...form, weather: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEATHER_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">描述</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                placeholder="场景细节..."
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={loading || !form.name.trim()}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                '创建场景'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 图片预览弹窗 */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-2">
          {previewImage && (
            <img
              src={previewImage}
              alt="预览"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
