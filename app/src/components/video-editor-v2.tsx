'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Video, Image as ImageIcon, Sparkles, ZoomIn, History, Settings, Wand2, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { PromptConfigPanel } from './prompt-config-panel'

interface Character {
  id: string
  name: string
  description: string
  imageUrl: string | null
}

interface Scene {
  id: string
  name: string
  description: string
  imageUrl: string | null
  mood?: string | null
  time?: string | null
  weather?: string | null
}

interface Prop {
  id: string
  name: string
  description: string
  imageUrl: string | null
}

interface Shot {
  id: string
  order: number
  duration: number
  cameraShotType: string
  cameraMovement: string
  sceneSetting: string
  characterAction?: string | null
  visualPrompt: string
  negativePrompt?: string | null
  refCharacterIds?: string | null
  refSceneIds?: string | null
  refPropIds?: string | null
  audio: string
}

interface Script {
  id: string
  title: string
  content?: string
  episode: number
  shots?: Shot[]
}

interface VideoAsset {
  id: string
  type: string
  url: string | null
  taskId: string | null
  duration: number | null
  aspectRatio: string | null
  prompt: string | null
  version: number
}

interface VideoRecord {
  id: string
  name: string | null
  prompt: string | null
  selectedCharacterIds?: string | null
  selectedSceneIds?: string | null
  selectedShotIds?: string | null
  scriptId?: string | null
  assets: VideoAsset[]
  script?: Script | null
  // Legacy compatibility
  compositeImageUrl?: string | null
  videoUrl?: string | null
}

interface Props {
  projectId: string
  video: VideoRecord | null
  scripts: Script[]
  characters: Character[]
  scenes: Scene[]
  props: Prop[]
  onVideoUpdate: (video: VideoRecord) => void
}

const DEFAULT_VIDEO_SYSTEM_PROMPT = `You are a professional video prompt engineer. Based on the script content, characters, scenes, and shot breakdown, generate a concise English prompt for AI video generation.

Focus on:
- Camera movements and cinematography
- Scene transitions and pacing
- Visual storytelling elements
- Mood and atmosphere
- Character actions and interactions

Output only the prompt text, nothing else.`

const DEFAULT_VIDEO_USER_PROMPT = `Script: {script}
Characters: {characters}
Scenes: {scenes}
Shots: {shots}
Duration: {duration}s
Aspect Ratio: {aspectRatio}`

const DEFAULT_IMAGE_SYSTEM_PROMPT = `# Role
你是一位专业的AI电影美术指导。你擅长将"角色设定"、"场景环境"与"分镜指令"融合，生成用于AI视频生成的"关键帧"提示词。

# Task
根据输入的【角色信息】、【场景信息】和【分镜动作】，生成一张画面构图精准、光影逻辑自洽的英文提示词。此图片将作为视频生成的首帧。

# Constraints & Logic
1. **构图逻辑**：
   - 必须严格按照分镜指令决定构图（如：Close-up只生成面部，Medium Shot生成半身，Wide Shot生成全身+环境）。
   - 角色必须在画面中占据合理比例，避免被环境淹没。
2. **光影融合**：
   - 必须分析场景的时间（Day/Night）和光源（Monitor light, Street lamp, Sunlight），并将这种光影效果应用到角色身上。
   - 例如：Night scene -> "skin illuminated by cold blue monitor light".
3. **动作可视化**：
   - 将分镜中的动作转化为静态的视觉姿态（例如：剧本写"正在抽烟"，Prompt生成"holding a cigarette with smoke rising"）。
4. **通用修饰**：
   - 结尾统一添加画质词。
   - 负面提示逻辑：确保画面干净，no text, no watermark, no speech bubbles.

# Prompt Structure Template
[Camera Shot/Angle], [Character Description with Expression/Pose], [Interaction with Environment], [Environment Description], [Lighting & Atmosphere], [Style & Quality].

# Output
仅输出Prompt文本，不要包含任何解释。`

const DEFAULT_IMAGE_USER_PROMPT = `角色信息：
{characters}

场景信息：
{scenes}

分镜指令：
{shots}`

export function VideoEditor({ projectId, video, scripts, characters, scenes, props, onVideoUpdate }: Props) {
  const [selectedScriptId, setSelectedScriptId] = useState<string>('')
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([])
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([])
  const [selectedPropIds, setSelectedPropIds] = useState<string[]>([])
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null)
  const [videoPrompt, setVideoPrompt] = useState<string>('')
  const [duration, setDuration] = useState<string>('15')
  const [aspectRatio, setAspectRatio] = useState<string>('16:9')
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [selectedPromptConfig, setSelectedPromptConfig] = useState<any>(null)
  const [selectedImagePromptConfig, setSelectedImagePromptConfig] = useState<any>(null)
  const [generatingPrompt, setGeneratingPrompt] = useState(false)
  const [compositePrompt, setCompositePrompt] = useState<string>('')
  const [generatingImagePrompt, setGeneratingImagePrompt] = useState(false)
  const [styleTags, setStyleTags] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('comic-video-style-tags') || 'cinematic lighting, 8k, masterpiece, best quality, sharp focus'
    }
    return 'cinematic lighting, 8k, masterpiece, best quality, sharp focus'
  })
  const [showMissingAssetsDialog, setShowMissingAssetsDialog] = useState(false)
  const [missingAssets, setMissingAssets] = useState<{ characters: string[], scenes: string[], props: string[] }>({ characters: [], scenes: [], props: [] })
  const [generationMode, setGenerationMode] = useState<'single' | 'multi'>('single')
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Sync state with video
  useEffect(() => {
    if (video) {
      if (video.scriptId) setSelectedScriptId(video.scriptId)
      if (video.selectedCharacterIds) {
        try { setSelectedCharacterIds(JSON.parse(video.selectedCharacterIds)) } catch {}
      }
      if (video.selectedSceneIds) {
        try { setSelectedSceneIds(JSON.parse(video.selectedSceneIds)) } catch {}
      }
      if (video.selectedShotIds) {
        try {
          const ids = JSON.parse(video.selectedShotIds)
          if (ids.length > 0) setSelectedShotId(ids[0])
        } catch {}
      }
      if (video.prompt) setVideoPrompt(video.prompt)
    }
  }, [video?.id])

  // Poll for pending assets
  useEffect(() => {
    const pendingAsset = video?.assets?.find(a => a.taskId && !a.url)
    if (pendingAsset && !pollingRef.current) {
      pollingRef.current = setInterval(() => pollAssetStatus(pendingAsset.id), 3000)
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [video?.assets])

  const pollAssetStatus = async (assetId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/videos/${video?.id}/assets/${assetId}`)
      const data = await res.json()

      if (data.status === 'SUCCESS' && data.url) {
        // Refresh video data
        const videoRes = await fetch(`/api/projects/${projectId}/videos/${video?.id}`)
        const updatedVideo = await videoRes.json()
        onVideoUpdate(updatedVideo)
        toast.success(data.type === 'composite_image' ? '合成图生成完成' : '视频生成完成')
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      } else if (data.status === 'FAILED') {
        toast.error('生成失败')
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      }
    } catch (error) {
      console.error('Poll error', error)
    }
  }

  const updateVideo = async (updates: Record<string, unknown>) => {
    if (!video) return
    try {
      const res = await fetch(`/api/projects/${projectId}/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const updated = await res.json()
      onVideoUpdate(updated)
    } catch {
      toast.error('更新失败')
    }
  }

  const handleScriptChange = (scriptId: string) => {
    setSelectedScriptId(scriptId)
    updateVideo({ scriptId: scriptId || null })
    // Auto-select first shot
    const script = scripts.find(s => s.id === scriptId)
    if (script?.shots?.length) {
      const firstShot = script.shots[0]
      setSelectedShotId(firstShot.id)
      // Auto-select ref characters of first shot
      if (firstShot.refCharacterIds) {
        try {
          const refIds = JSON.parse(firstShot.refCharacterIds) as string[]
          setSelectedCharacterIds(refIds)
          updateVideo({ selectedCharacterIds: refIds })
        } catch {}
      }
    } else {
      setSelectedShotId(null)
    }
  }

  const toggleCharacterSelection = (id: string) => {
    // Deselecting is always allowed
    if (selectedCharacterIds.includes(id)) {
      const newIds = selectedCharacterIds.filter(cid => cid !== id)
      setSelectedCharacterIds(newIds)
      updateVideo({ selectedCharacterIds: newIds })
      return
    }
    // Adding a non-ref character requires confirmation
    const refIds = getRefCharacterIds()
    if (refIds.length > 0 && !refIds.includes(id)) {
      const char = characters.find(c => c.id === id)
      if (!confirm(`"${char?.name}" 不在当前分镜的关联角色中，确定要添加吗？`)) return
    }
    const newIds = [...selectedCharacterIds, id]
    setSelectedCharacterIds(newIds)
    updateVideo({ selectedCharacterIds: newIds })
  }

  const toggleSceneSelection = (id: string) => {
    const newIds = selectedSceneIds.includes(id)
      ? selectedSceneIds.filter(sid => sid !== id)
      : [...selectedSceneIds, id]
    setSelectedSceneIds(newIds)
    updateVideo({ selectedSceneIds: newIds })
  }

  const togglePropSelection = (id: string) => {
    setSelectedPropIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    )
  }

  const handleShotSelect = (shotId: string) => {
    setSelectedShotId(shotId === selectedShotId ? null : shotId)
    // Auto-select characters, scenes, and props referenced by this shot
    const script = scripts.find(s => s.id === selectedScriptId)
    const shot = script?.shots?.find(s => s.id === shotId)

    console.log('[handleShotSelect] Shot selected:', { shotId, shot, duration: shot?.duration })

    if (shot) {
      // Set video duration to match shot duration
      if (shot.duration) {
        const roundedDuration = String(Math.round(shot.duration))
        console.log('[handleShotSelect] Setting duration:', roundedDuration)
        setDuration(roundedDuration)
      }

      // Auto-select characters
      if (shot.refCharacterIds) {
        try {
          const refIds = JSON.parse(shot.refCharacterIds) as string[]
          setSelectedCharacterIds(refIds)
          updateVideo({ selectedCharacterIds: refIds })
        } catch {}
      }

      // Auto-select scenes
      if (shot.refSceneIds) {
        try {
          const refIds = JSON.parse(shot.refSceneIds) as string[]
          setSelectedSceneIds(refIds)
          updateVideo({ selectedSceneIds: refIds })
        } catch {}
      }

      // Auto-select props
      if (shot.refPropIds) {
        try {
          const refIds = JSON.parse(shot.refPropIds) as string[]
          setSelectedPropIds(refIds)
          updateVideo({ selectedPropIds: refIds })
        } catch {}
      }
    }
  }

  const getRefCharacterIds = (): string[] => {
    const script = scripts.find(s => s.id === selectedScriptId)
    const shot = script?.shots?.find(s => s.id === selectedShotId)
    if (shot?.refCharacterIds) {
      try { return JSON.parse(shot.refCharacterIds) as string[] } catch {}
    }
    return []
  }

  const buildStructuredPrompt = () => {
    const chars = selectedCharacterIds
      .map(id => characters.find(c => c.id === id))
      .filter(Boolean) as Character[]
    const script = scripts.find(s => s.id === selectedScriptId)
    const shot = script?.shots?.find(s => s.id === selectedShotId)

    // [镜头语言]
    const shotLang = shot
      ? `${shot.cameraShotType}, ${shot.cameraMovement}`
      : 'Medium shot'

    // [角色主体+特征] + [穿戴/持有物]
    const charDesc = chars.map(c => `${c.name}, ${c.description}`).join('; ')

    // [正在做的动作]
    const actions = shot?.characterAction || ''

    // [处于的环境] — 从 Shot.sceneSetting 取
    const envDesc = shot?.sceneSetting ? `in ${shot.sceneSetting}` : ''

    // [光影氛围] — 从选中的场景取 time/mood/weather 作为光影参考
    const scns = selectedSceneIds
      .map(id => scenes.find(s => s.id === id))
      .filter(Boolean) as Scene[]
    const atmosphereParts: string[] = []
    scns.forEach(s => {
      if (s.time) atmosphereParts.push(`${s.time.toLowerCase()} lighting`)
      if (s.mood) atmosphereParts.push(`${s.mood} atmosphere`)
      if (s.weather && s.weather !== 'Clear') atmosphereParts.push(s.weather.toLowerCase())
    })
    const atmosphere = atmosphereParts.join(', ')

    // 拼接
    const parts = [shotLang, charDesc, actions, envDesc, atmosphere, styleTags].filter(p => p.trim())
    return parts.join(', ')
  }

  const handleBuildStructuredPrompt = () => {
    if (!selectedShotId) {
      toast.error('请至少选择一个分镜')
      return
    }
    setCompositePrompt(buildStructuredPrompt())
  }

  const handleAIOptimizePrompt = async () => {
    if (!selectedShotId) {
      toast.error('请至少选择一个分镜')
      return
    }
    setGeneratingImagePrompt(true)
    try {
      const chars = selectedCharacterIds
        .map(id => characters.find(c => c.id === id))
        .filter(Boolean) as Character[]
      const scns = selectedSceneIds
        .map(id => scenes.find(s => s.id === id))
        .filter(Boolean) as Scene[]
      const script = scripts.find(s => s.id === selectedScriptId)
      const shot = script?.shots?.find(s => s.id === selectedShotId)

      const charsText = chars.map(c => `${c.name}: ${c.description}`).join('\n')
      const scnsText = scns.map(s => {
        const parts = [s.name, s.description]
        if (s.time) parts.push(`Time: ${s.time}`)
        if (s.mood) parts.push(`Mood: ${s.mood}`)
        if (s.weather) parts.push(`Weather: ${s.weather}`)
        return parts.join(', ')
      }).join('\n')
      const shotsText = shot
        ? `Shot ${shot.order}: [${shot.cameraShotType}, ${shot.cameraMovement}] ${shot.sceneSetting}, ${shot.characterAction || ''}`
        : ''

      const systemPrompt = selectedImagePromptConfig?.systemPrompt || DEFAULT_IMAGE_SYSTEM_PROMPT
      const userPromptTemplate = selectedImagePromptConfig?.userPrompt || DEFAULT_IMAGE_USER_PROMPT
      const userPrompt = userPromptTemplate
        .replace('{characters}', charsText)
        .replace('{scenes}', scnsText)
        .replace('{shots}', shotsText)

      const res = await fetch(`/api/projects/${projectId}/video/${video?.id}/generate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: selectedScriptId, systemPrompt, userPrompt }),
      })
      const data = await res.json()
      if (data.prompt) {
        // Append style tags if not already present
        const prompt = data.prompt.trim()
        setCompositePrompt(prompt.endsWith(styleTags) ? prompt : `${prompt}, ${styleTags}`)
      }
    } catch {
      toast.error('AI 优化失败')
    } finally {
      setGeneratingImagePrompt(false)
    }
  }

  // 检查缺失的素材（没有图片的）
  const checkMissingAssets = () => {
    const missing = {
      characters: selectedCharacterIds.filter(id => {
        const char = characters.find(c => c.id === id)
        return char && !char.imageUrl
      }).map(id => characters.find(c => c.id === id)?.name || id),
      scenes: selectedSceneIds.filter(id => {
        const scene = scenes.find(s => s.id === id)
        return scene && !scene.imageUrl
      }).map(id => scenes.find(s => s.id === id)?.name || id),
      props: selectedPropIds.filter(id => {
        const prop = props.find(p => p.id === id)
        return prop && !prop.imageUrl
      }).map(id => props.find(p => p.id === id)?.name || id),
    }
    return missing
  }

  const handleGenerateCompositeImage = async () => {
    console.log('[handleGenerateCompositeImage] 函数被调用')
    if (!video) return
    if (selectedCharacterIds.length === 0 && selectedSceneIds.length === 0) {
      toast.error('请至少选择一张角色或场景图片')
      return
    }

    // 检查缺失素材
    const missing = checkMissingAssets()
    const hasMissing = missing.characters.length > 0 || missing.scenes.length > 0 || missing.props.length > 0

    console.log('[Missing Assets Check]', {
      selectedCharacterIds,
      selectedSceneIds,
      selectedPropIds,
      missing,
      hasMissing,
      characters: characters.map(c => ({ id: c.id, name: c.name, imageUrl: c.imageUrl })),
      scenes: scenes.map(s => ({ id: s.id, name: s.name, imageUrl: s.imageUrl })),
      props: props.map(p => ({ id: p.id, name: p.name, imageUrl: p.imageUrl })),
    })

    if (hasMissing) {
      console.log('[Missing Assets] 显示确认对话框')
      setMissingAssets(missing)
      setShowMissingAssetsDialog(true)
      return
    }

    await executeGenerateCompositeImage()
  }

  const executeGenerateCompositeImage = async () => {
    if (!video) return

    setIsGenerating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/videos/${video.id}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'composite_image',
          aspectRatio,
          propIds: selectedPropIds,
          ...(compositePrompt.trim() ? { prompt: compositePrompt } : {}),
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      if (data.status === 'SUCCESS') {
        const videoRes = await fetch(`/api/projects/${projectId}/videos/${video.id}`)
        onVideoUpdate(await videoRes.json())
        toast.success('合成图生成成功')
      } else {
        toast.info('合成图生成中...')
      }
    } catch (error: any) {
      toast.error(error.message || '生成失败')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateVideo = async () => {
    if (!video) return

    // 单图模式需要合成图
    if (generationMode === 'single') {
      const compositeImage = video.assets?.find(a => a.type === 'composite_image' && a.url)
      if (!compositeImage?.url) {
        toast.error('请先生成合成图')
        return
      }
    }

    if (!videoPrompt.trim()) {
      toast.error('请输入视频 Prompt')
      return
    }

    setIsGenerating(true)
    try {
      await updateVideo({ prompt: videoPrompt })

      // TODO: 多图模式API调用
      if (generationMode === 'multi') {
        // 收集所有选中素材的图片URL
        const imageUrls: string[] = []

        selectedCharacterIds.forEach(id => {
          const char = characters.find(c => c.id === id)
          if (char?.imageUrl) imageUrls.push(char.imageUrl)
        })

        selectedSceneIds.forEach(id => {
          const scene = scenes.find(s => s.id === id)
          if (scene?.imageUrl) imageUrls.push(scene.imageUrl)
        })

        selectedPropIds.forEach(id => {
          const prop = props.find(p => p.id === id)
          if (prop?.imageUrl) imageUrls.push(prop.imageUrl)
        })

        console.log('[Multi-Image Mode] TODO: Call API with:', {
          imageUrls,
          prompt: videoPrompt,
          duration: parseInt(duration),
          aspectRatio,
        })
        toast.info('多图模式API待实现')
        setIsGenerating(false)
        return
      }

      // 单图模式：使用现有逻辑
      const res = await fetch(`/api/projects/${projectId}/videos/${video.id}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'video',
          duration: parseInt(duration),
          aspectRatio,
          prompt: videoPrompt,
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      if (data.status === 'SUCCESS') {
        const videoRes = await fetch(`/api/projects/${projectId}/videos/${video.id}`)
        onVideoUpdate(await videoRes.json())
        toast.success('视频生成成功')
      } else {
        toast.info('视频生成中...')
      }
    } catch (error: any) {
      toast.error(error.message || '生成失败')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGeneratePrompt = async () => {
    console.log('[handleGeneratePrompt] 函数被调用')
    if (!selectedScriptId) { toast.error('请先选择剧本'); return }
    setGeneratingPrompt(true)
    try {
      const script = scripts.find(s => s.id === selectedScriptId)
      const chars = selectedCharacterIds
        .map(id => characters.find(c => c.id === id))
        .filter(Boolean)
      const scns = selectedSceneIds
        .map(id => scenes.find(s => s.id === id))
        .filter(Boolean)
      const shot = script?.shots?.find(s => s.id === selectedShotId)
      const shotsText = shot
        ? `Shot ${shot.order}: [${shot.cameraShotType}, ${shot.cameraMovement}] ${shot.sceneSetting}, ${shot.characterAction || ''}, Audio: ${shot.audio}`
        : 'No shot breakdown available'

      const systemPrompt = selectedPromptConfig?.systemPrompt || DEFAULT_VIDEO_SYSTEM_PROMPT
      const userPromptTemplate = selectedPromptConfig?.userPrompt || DEFAULT_VIDEO_USER_PROMPT
      const filledPrompt = userPromptTemplate
        .replace('{script}', script?.content || '')
        .replace('{characters}', chars.map((c: any) => `${c.name}: ${c.description}`).join(', '))
        .replace('{scenes}', scns.map((s: any) => `${s.name}: ${s.description}`).join(', '))
        .replace('{shots}', shotsText)
        .replace('{duration}', duration)
        .replace('{aspectRatio}', aspectRatio)

      const res = await fetch(`/api/projects/${projectId}/video/${video?.id}/generate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: selectedScriptId, systemPrompt, userPrompt: filledPrompt }),
      })
      const data = await res.json()
      if (data.prompt) setVideoPrompt(data.prompt)
    } catch (error) {
      toast.error('生成 Prompt 失败')
    } finally {
      setGeneratingPrompt(false)
    }
  }

  const currentScript = scripts.find(s => s.id === selectedScriptId)
  const shots = currentScript?.shots || []
  const compositeImage = video?.assets?.filter(a => a.type === 'composite_image').sort((a, b) => b.version - a.version)[0]
  const videoAsset = video?.assets?.filter(a => a.type === 'video').sort((a, b) => b.version - a.version)[0]
  const isPending = video?.assets?.some(a => a.taskId && !a.url)

  if (!video) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          请从左侧选择或创建一个视频片段
        </CardContent>
      </Card>
    )
  }

  return (
    <Tabs defaultValue="design" className="w-full">
      <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
        <TabsTrigger value="design" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md rounded-lg transition-all">
          <Video className="w-4 h-4 mr-2" />
          视频生成
        </TabsTrigger>
        <TabsTrigger value="config" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md rounded-lg transition-all">
          <Settings className="w-4 h-4 mr-2" />
          配置
        </TabsTrigger>
      </TabsList>
      <TabsContent value="design" className="mt-6">
    <div className="space-y-4">
      {/* Script Selection */}
      <Card>
        <CardHeader><CardTitle>选择剧本</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedScriptId} onValueChange={handleScriptChange}>
            <SelectTrigger><SelectValue placeholder="选择剧本" /></SelectTrigger>
            <SelectContent>
              {scripts.map(s => (
                <SelectItem key={s.id} value={s.id}>第{s.episode}集 - {s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Shot Selection */}
          {shots.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {shots.map(shot => (
                <div
                  key={shot.id}
                  className={`p-2 border rounded cursor-pointer text-xs ${
                    selectedShotId === shot.id ? 'border-purple-500 bg-purple-50' : ''
                  }`}
                  onClick={() => handleShotSelect(shot.id)}
                >
                  <div className="font-medium">Shot {shot.order}</div>
                  <div className="text-muted-foreground truncate">{shot.cameraShotType} / {shot.cameraMovement}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generation Mode Tabs */}
      <Tabs value={generationMode} onValueChange={(v) => setGenerationMode(v as 'single' | 'multi')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 bg-muted p-1">
          <TabsTrigger
            value="single"
            className="text-base data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            单图模式
          </TabsTrigger>
          <TabsTrigger
            value="multi"
            className="text-base data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            多图模式
          </TabsTrigger>
        </TabsList>

        {/* Single Image Mode */}
        <TabsContent value="single" className="space-y-4 mt-4">
          {/* Mode Description */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">工作流程：</span>
              选择素材 → 合成4宫格分镜图 → 生成视频。适合需要精确控制画面布局的场景。
            </p>
          </div>

          {/* Asset Selection */}
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>选择素材</span>
            {(() => {
              const missing = checkMissingAssets()
              const hasMissing = missing.characters.length > 0 || missing.scenes.length > 0 || missing.props.length > 0
              if (hasMissing) {
                return (
                  <div className="flex items-center gap-2 text-sm font-normal text-amber-600">
                    <AlertTriangle className="w-4 h-4" />
                    <span>部分素材缺少图片</span>
                  </div>
                )
              }
              return null
            })()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">角色 ({selectedCharacterIds.length})</Label>
            <div className="grid grid-cols-6 gap-2 mt-2">
              {characters.map(char => (
                <div
                  key={char.id}
                  className={`relative border-2 rounded cursor-pointer ${
                    selectedCharacterIds.includes(char.id) ? 'border-blue-500' : 'border-gray-200'
                  }`}
                  onClick={() => toggleCharacterSelection(char.id)}
                >
                  {!char.imageUrl && selectedCharacterIds.includes(char.id) && (
                    <div className="absolute top-1 right-1 z-10">
                      <AlertTriangle className="w-4 h-4 text-red-500 bg-white rounded-full p-0.5" />
                    </div>
                  )}
                  <div className="h-16 bg-gray-50 flex items-center justify-center">
                    {char.imageUrl ? (
                      <img src={char.imageUrl} alt={char.name} className="w-full h-full object-contain" />
                    ) : <ImageIcon className="w-6 h-6 text-gray-400" />}
                  </div>
                  <div className="text-xs text-center truncate p-1 bg-black/60 text-white">{char.name}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">场景 ({selectedSceneIds.length})</Label>
            <div className="grid grid-cols-6 gap-2 mt-2">
              {scenes.map(scene => (
                <div
                  key={scene.id}
                  className={`relative border-2 rounded cursor-pointer ${
                    selectedSceneIds.includes(scene.id) ? 'border-green-500' : 'border-gray-200'
                  }`}
                  onClick={() => toggleSceneSelection(scene.id)}
                >
                  {!scene.imageUrl && selectedSceneIds.includes(scene.id) && (
                    <div className="absolute top-1 right-1 z-10">
                      <AlertTriangle className="w-4 h-4 text-red-500 bg-white rounded-full p-0.5" />
                    </div>
                  )}
                  <div className="h-16 bg-gray-50 flex items-center justify-center">
                    {scene.imageUrl ? (
                      <img src={scene.imageUrl} alt={scene.name} className="w-full h-full object-contain" />
                    ) : <ImageIcon className="w-6 h-6 text-gray-400" />}
                  </div>
                  <div className="text-xs text-center truncate p-1 bg-black/60 text-white">{scene.name}</div>
                </div>
              ))}
            </div>
          </div>

          {props.length > 0 && (
            <div>
              <Label className="text-xs">道具 ({selectedPropIds.length})</Label>
              <div className="grid grid-cols-6 gap-2 mt-2">
                {props.map(prop => (
                  <div
                    key={prop.id}
                    className={`relative border-2 rounded cursor-pointer ${
                      selectedPropIds.includes(prop.id) ? 'border-orange-500' : 'border-gray-200'
                    }`}
                    onClick={() => togglePropSelection(prop.id)}
                  >
                    {!prop.imageUrl && selectedPropIds.includes(prop.id) && (
                      <div className="absolute top-1 right-1 z-10">
                        <AlertTriangle className="w-4 h-4 text-red-500 bg-white rounded-full p-0.5" />
                      </div>
                    )}
                    <div className="h-16 bg-gray-50 flex items-center justify-center">
                      {prop.imageUrl ? (
                        <img src={prop.imageUrl} alt={prop.name} className="w-full h-full object-contain" />
                      ) : <ImageIcon className="w-6 h-6 text-gray-400" />}
                    </div>
                    <div className="text-xs text-center truncate p-1 bg-black/60 text-white">{prop.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Composite Image */}
      <Card>
        <CardHeader>
          <CardTitle>步骤 1：生成4宫格合成图</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            将选中的素材合成为一张4宫格分镜图，用于视频生成
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>宽高比</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9</SelectItem>
                  <SelectItem value="9:16">9:16</SelectItem>
                  <SelectItem value="1:1">1:1</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prompt Generation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleBuildStructuredPrompt}
                disabled={!selectedShotId}
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                生成 Prompt
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAIOptimizePrompt}
                disabled={generatingImagePrompt || !selectedShotId}
              >
                {generatingImagePrompt ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
                AI 优化
              </Button>
            </div>
            <Textarea
              value={compositePrompt}
              onChange={e => setCompositePrompt(e.target.value)}
              rows={5}
              placeholder="点击「生成 Prompt」结构化拼接，或「AI 优化」由 LLM 从头生成..."
              className="font-mono text-sm"
            />
          </div>

          <Button
            onClick={handleGenerateCompositeImage}
            disabled={isGenerating || isPending}
            className="w-full"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ImageIcon className="w-4 h-4 mr-2" />}
            生成合成图
          </Button>

          {compositeImage?.url && (
            <img
              src={compositeImage.url}
              alt="合成图"
              className="w-full border rounded cursor-pointer"
              onClick={() => setPreviewImage(compositeImage.url)}
            />
          )}
        </CardContent>
      </Card>

      {/* Generate Video */}
      {compositeImage?.url && (
        <Card>
          <CardHeader><CardTitle>步骤 2：生成视频</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Video Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>视频 Prompt</Label>
                <Button size="sm" variant="outline" onClick={handleGeneratePrompt} disabled={!selectedScriptId || generatingPrompt}>
                  {generatingPrompt ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  从剧本自动生成
                </Button>
              </div>
              <Textarea
                value={videoPrompt}
                onChange={e => setVideoPrompt(e.target.value)}
                rows={4}
                placeholder="描述视频内容..."
                className="font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>时长</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1秒</SelectItem>
                    <SelectItem value="2">2秒</SelectItem>
                    <SelectItem value="3">3秒</SelectItem>
                    <SelectItem value="4">4秒</SelectItem>
                    <SelectItem value="5">5秒</SelectItem>
                    <SelectItem value="6">6秒</SelectItem>
                    <SelectItem value="7">7秒</SelectItem>
                    <SelectItem value="8">8秒</SelectItem>
                    <SelectItem value="9">9秒</SelectItem>
                    <SelectItem value="10">10秒</SelectItem>
                    <SelectItem value="11">11秒</SelectItem>
                    <SelectItem value="12">12秒</SelectItem>
                    <SelectItem value="13">13秒</SelectItem>
                    <SelectItem value="14">14秒</SelectItem>
                    <SelectItem value="15">15秒</SelectItem>
                    <SelectItem value="16">16秒</SelectItem>
                    <SelectItem value="17">17秒</SelectItem>
                    <SelectItem value="18">18秒</SelectItem>
                    <SelectItem value="19">19秒</SelectItem>
                    <SelectItem value="20">20秒</SelectItem>
                    <SelectItem value="21">21秒</SelectItem>
                    <SelectItem value="22">22秒</SelectItem>
                    <SelectItem value="23">23秒</SelectItem>
                    <SelectItem value="24">24秒</SelectItem>
                    <SelectItem value="25">25秒</SelectItem>
                    <SelectItem value="26">26秒</SelectItem>
                    <SelectItem value="27">27秒</SelectItem>
                    <SelectItem value="28">28秒</SelectItem>
                    <SelectItem value="29">29秒</SelectItem>
                    <SelectItem value="30">30秒</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>宽高比</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9</SelectItem>
                    <SelectItem value="9:16">9:16</SelectItem>
                    <SelectItem value="1:1">1:1</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleGenerateVideo}
              disabled={isGenerating || isPending || !videoPrompt.trim()}
              className="w-full"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Video className="w-4 h-4 mr-2" />}
              生成视频
            </Button>

            {videoAsset?.url && (
              <video src={videoAsset.url} controls className="w-full border rounded" />
            )}
          </CardContent>
        </Card>
      )}
        </TabsContent>

        {/* Multi Image Mode */}
        <TabsContent value="multi" className="space-y-4 mt-4">
          {/* Mode Description */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-sm text-purple-800">
              <span className="font-semibold">工作流程：</span>
              选择素材 → 直接生成视频。所有素材图片直接传给AI模型，由模型自动处理画面布局。
            </p>
          </div>

          {/* Asset Selection - Same as Single Mode */}
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>选择素材</span>
            <div className="flex items-center gap-4">
              {(() => {
                const totalSelected = selectedCharacterIds.length + selectedSceneIds.length + selectedPropIds.length
                if (totalSelected > 0) {
                  return (
                    <div className="text-sm font-normal text-teal-600">
                      已选 {totalSelected} 张素材图片
                    </div>
                  )
                }
                return null
              })()}
              {(() => {
                const missing = checkMissingAssets()
                const hasMissing = missing.characters.length > 0 || missing.scenes.length > 0 || missing.props.length > 0
                if (hasMissing) {
                  return (
                    <div className="flex items-center gap-2 text-sm font-normal text-amber-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span>部分素材缺少图片</span>
                    </div>
                  )
                }
                return null
              })()}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">角色 ({selectedCharacterIds.length})</Label>
            <div className="grid grid-cols-6 gap-2 mt-2">
              {characters.map(char => (
                <div
                  key={char.id}
                  className={`relative border-2 rounded cursor-pointer ${
                    selectedCharacterIds.includes(char.id) ? 'border-blue-500' : 'border-gray-200'
                  }`}
                  onClick={() => toggleCharacterSelection(char.id)}
                >
                  {!char.imageUrl && selectedCharacterIds.includes(char.id) && (
                    <div className="absolute top-1 right-1 z-10">
                      <AlertTriangle className="w-4 h-4 text-red-500 bg-white rounded-full p-0.5" />
                    </div>
                  )}
                  <div className="h-16 bg-gray-50 flex items-center justify-center">
                    {char.imageUrl ? (
                      <img src={char.imageUrl} alt={char.name} className="w-full h-full object-contain" />
                    ) : <ImageIcon className="w-6 h-6 text-gray-400" />}
                  </div>
                  <div className="text-xs text-center truncate p-1 bg-black/60 text-white">{char.name}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">场景 ({selectedSceneIds.length})</Label>
            <div className="grid grid-cols-6 gap-2 mt-2">
              {scenes.map(scene => (
                <div
                  key={scene.id}
                  className={`relative border-2 rounded cursor-pointer ${
                    selectedSceneIds.includes(scene.id) ? 'border-green-500' : 'border-gray-200'
                  }`}
                  onClick={() => toggleSceneSelection(scene.id)}
                >
                  {!scene.imageUrl && selectedSceneIds.includes(scene.id) && (
                    <div className="absolute top-1 right-1 z-10">
                      <AlertTriangle className="w-4 h-4 text-red-500 bg-white rounded-full p-0.5" />
                    </div>
                  )}
                  <div className="h-16 bg-gray-50 flex items-center justify-center">
                    {scene.imageUrl ? (
                      <img src={scene.imageUrl} alt={scene.name} className="w-full h-full object-contain" />
                    ) : <ImageIcon className="w-6 h-6 text-gray-400" />}
                  </div>
                  <div className="text-xs text-center truncate p-1 bg-black/60 text-white">{scene.name}</div>
                </div>
              ))}
            </div>
          </div>

          {props.length > 0 && (
            <div>
              <Label className="text-xs">道具 ({selectedPropIds.length})</Label>
              <div className="grid grid-cols-6 gap-2 mt-2">
                {props.map(prop => (
                  <div
                    key={prop.id}
                    className={`relative border-2 rounded cursor-pointer ${
                      selectedPropIds.includes(prop.id) ? 'border-orange-500' : 'border-gray-200'
                    }`}
                    onClick={() => togglePropSelection(prop.id)}
                  >
                    {!prop.imageUrl && selectedPropIds.includes(prop.id) && (
                      <div className="absolute top-1 right-1 z-10">
                        <AlertTriangle className="w-4 h-4 text-red-500 bg-white rounded-full p-0.5" />
                      </div>
                    )}
                    <div className="h-16 bg-gray-50 flex items-center justify-center">
                      {prop.imageUrl ? (
                        <img src={prop.imageUrl} alt={prop.name} className="w-full h-full object-contain" />
                      ) : <ImageIcon className="w-6 h-6 text-gray-400" />}
                    </div>
                    <div className="text-xs text-center truncate p-1 bg-black/60 text-white">{prop.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Video - Multi Mode */}
      <Card>
        <CardHeader>
          <CardTitle>生成视频</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            直接使用选中的素材图片生成视频，无需合成步骤
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Video Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>视频 Prompt</Label>
              <Button size="sm" variant="outline" onClick={handleGeneratePrompt} disabled={!selectedScriptId || generatingPrompt}>
                {generatingPrompt ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                从剧本自动生成
              </Button>
            </div>
            <Textarea
              value={videoPrompt}
              onChange={e => setVideoPrompt(e.target.value)}
              rows={4}
              placeholder="描述视频内容..."
              className="font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>时长</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5秒</SelectItem>
                  <SelectItem value="10">10秒</SelectItem>
                  <SelectItem value="15">15秒</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>宽高比</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9</SelectItem>
                  <SelectItem value="9:16">9:16</SelectItem>
                  <SelectItem value="1:1">1:1</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleGenerateVideo}
            disabled={isGenerating || isPending || !videoPrompt.trim()}
            className="w-full"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Video className="w-4 h-4 mr-2" />}
            生成视频
          </Button>

          {videoAsset?.url && (
            <video src={videoAsset.url} controls className="w-full border rounded" />
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          {previewImage && <img src={previewImage} alt="预览" className="w-full" />}
        </DialogContent>
      </Dialog>

      {/* Missing Assets Confirmation Dialog */}
      <Dialog open={showMissingAssetsDialog} onOpenChange={setShowMissingAssetsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              部分素材缺少图片
            </DialogTitle>
            <DialogDescription>
              以下素材尚未生成图片，继续生成可能影响合成效果：
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {missingAssets.characters.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">角色：</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {missingAssets.characters.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              </div>
            )}
            {missingAssets.scenes.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">场景：</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {missingAssets.scenes.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              </div>
            )}
            {missingAssets.props.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">道具：</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {missingAssets.props.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMissingAssetsDialog(false)}>
              取消
            </Button>
            <Button onClick={async () => {
              setShowMissingAssetsDialog(false)
              await executeGenerateCompositeImage()
            }}>
              继续生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
      </TabsContent>
      <TabsContent value="config" className="space-y-6 mt-6">
        {/* Style Tags */}
        <Card>
          <CardHeader><CardTitle>风格标签</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">结构化拼接时追加在 Prompt 末尾的画质/风格词</p>
            <Input
              value={styleTags}
              onChange={e => {
                setStyleTags(e.target.value)
                localStorage.setItem('comic-video-style-tags', e.target.value)
              }}
              placeholder="cinematic lighting, 8k, masterpiece, best quality, sharp focus"
              className="font-mono text-sm"
            />
          </CardContent>
        </Card>
        <PromptConfigPanel
          projectId={projectId}
          type="image"
          defaultSystemPrompt={DEFAULT_IMAGE_SYSTEM_PROMPT}
          defaultUserPrompt={DEFAULT_IMAGE_USER_PROMPT}
          onPromptSelect={setSelectedImagePromptConfig}
          selectedPromptId={selectedImagePromptConfig?.id}
        />
        <PromptConfigPanel
          projectId={projectId}
          type="video"
          defaultSystemPrompt={DEFAULT_VIDEO_SYSTEM_PROMPT}
          defaultUserPrompt={DEFAULT_VIDEO_USER_PROMPT}
          onPromptSelect={setSelectedPromptConfig}
          selectedPromptId={selectedPromptConfig?.id}
        />
      </TabsContent>
    </Tabs>
  )
}
