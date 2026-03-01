'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Video, Image as ImageIcon, Sparkles, Settings, ZoomIn, History, Plus, Trash2, Pencil } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { PromptConfigPanel } from '@/components/prompt-config-panel'
import { DEFAULT_VIDEO_SYSTEM_PROMPT, DEFAULT_VIDEO_USER_PROMPT } from '@/lib/default-video-prompts'
import { DEFAULT_IMAGE_SYSTEM_PROMPT, DEFAULT_IMAGE_USER_PROMPT } from '@/lib/default-image-prompts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
  audio: string
}

interface Script {
  id: string
  title: string
  content: string
  episode: number
  shots?: Shot[]
}

interface VideoRecord {
  id: string
  name: string | null
  scriptId: string | null
  compositeImageUrl: string | null
  compositeImageTaskId: string | null
  storyboardImageBase64: string | null
  storyboardUrl: string | null
  storyboardTaskId: string | null
  selectedCharacterIds: string | null
  selectedSceneIds: string | null
  selectedShotIds: string | null
  layoutType: string | null
  videoUrl: string | null
  videoTaskId: string | null
  videoPrompt: string | null
  script?: Script
}

interface PromptConfig {
  id: string
  type: string
  name: string
  systemPrompt: string
  userPrompt: string | null
  isDefault: boolean
}

interface Project {
  id: string
  characters: Character[]
  scenes: Scene[]
  scripts: Script[]
}

interface Props {
  project: Project
}

export function VideoEditor({ project }: Props) {
  const [videos, setVideos] = useState<VideoRecord[]>([])
  const [currentVideo, setCurrentVideo] = useState<VideoRecord | null>(null)
  const [selectedScriptId, setSelectedScriptId] = useState<string>('')
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([])
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([])
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([])

  // Model selection state

  // Prompt configuration state
  const [selectedPromptConfig, setSelectedPromptConfig] = useState<PromptConfig | null>(null)
  const [selectedImagePromptConfig, setSelectedImagePromptConfig] = useState<PromptConfig | null>(null)

  // Step 1: Composite image generation
  const [isComposingImage, setIsComposingImage] = useState(false)
  const compositeImagePollingRef = useRef<NodeJS.Timeout | null>(null)
  const isRestoringRef = useRef(false)

  // Step 2: Video generation
  const [videoPrompt, setVideoPrompt] = useState<string>('')
  const [duration, setDuration] = useState<string>('15')
  const [aspectRatio, setAspectRatio] = useState<string>('16:9')
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [compositeImageError, setCompositeImageError] = useState(false)
  const videoPollingRef = useRef<NodeJS.Timeout | null>(null)

  // Load videos on mount
  useEffect(() => {
    loadVideos()
  }, [])

  // Load default prompt configs on mount
  useEffect(() => {
    const loadDefaultPromptConfigs = async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}/prompts`)
        const data = await res.json()

        // Find default image prompt config
        const imageConfigs = data.filter((c: PromptConfig) => c.type === 'image')
        if (imageConfigs.length > 0 && !selectedImagePromptConfig) {
          const defaultConfig = imageConfigs.find((c: PromptConfig) => c.isDefault) || imageConfigs[0]
          setSelectedImagePromptConfig(defaultConfig)
        }

        // Find default video prompt config
        const videoConfigs = data.filter((c: PromptConfig) => c.type === 'video')
        if (videoConfigs.length > 0 && !selectedPromptConfig) {
          const defaultConfig = videoConfigs.find((c: PromptConfig) => c.isDefault) || videoConfigs[0]
          setSelectedPromptConfig(defaultConfig)
        }
      } catch (error) {
        console.error('Failed to load prompt configs', error)
      }
    }

    loadDefaultPromptConfigs()
  }, [project.id])

  // Poll composite image status if there's a task
  useEffect(() => {
    if (currentVideo?.compositeImageTaskId && !compositeImagePollingRef.current) {
      const interval = setInterval(() => {
        pollCompositeImageStatus()
      }, 3000)
      compositeImagePollingRef.current = interval
    }

    return () => {
      if (compositeImagePollingRef.current) {
        clearInterval(compositeImagePollingRef.current)
        compositeImagePollingRef.current = null
      }
    }
  }, [currentVideo?.compositeImageTaskId])

  // Poll video status if there's a task
  useEffect(() => {
    if (currentVideo?.videoTaskId && !videoPollingRef.current) {
      const interval = setInterval(() => {
        pollVideoStatus()
      }, 3000)
      videoPollingRef.current = interval
    }

    return () => {
      if (videoPollingRef.current) {
        clearInterval(videoPollingRef.current)
        videoPollingRef.current = null
      }
    }
  }, [currentVideo?.videoTaskId])

  const selectVideo = (video: VideoRecord) => {
    isRestoringRef.current = true
    setCompositeImageError(false)
    setCurrentVideo(video)
    if (video.videoPrompt) setVideoPrompt(video.videoPrompt)
    if (video.scriptId) setSelectedScriptId(video.scriptId)
    if (video.selectedCharacterIds) {
      try { setSelectedCharacterIds(JSON.parse(video.selectedCharacterIds)) } catch {}
    }
    if (video.selectedSceneIds) {
      try { setSelectedSceneIds(JSON.parse(video.selectedSceneIds)) } catch {}
    }
    if (video.selectedShotIds) {
      try { setSelectedShotIds(JSON.parse(video.selectedShotIds)) } catch {}
    }
    // Allow the useEffect to run once then clear the guard
    setTimeout(() => { isRestoringRef.current = false }, 0)
  }

  const resetToNew = () => {
    setCurrentVideo(null)
    setSelectedScriptId('')
    setSelectedCharacterIds([])
    setSelectedSceneIds([])
    setSelectedShotIds([])
    setVideoPrompt('')
  }

  const handleDeleteVideo = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation()
    if (!confirm('确定要删除这条视频记录吗？')) return
    try {
      await fetch(`/api/projects/${project.id}/video/${videoId}`, { method: 'DELETE' })
      setVideos(prev => prev.filter(v => v.id !== videoId))
      if (currentVideo?.id === videoId) resetToNew()
      toast.success('视频记录已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  const [editingVideoId, setEditingVideoId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string>('')

  const handleRenameVideo = async (videoId: string, newName: string) => {
    try {
      await fetch(`/api/projects/${project.id}/video/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      setVideos(prev => prev.map(v => v.id === videoId ? { ...v, name: newName } : v))
      if (currentVideo?.id === videoId) setCurrentVideo(prev => prev ? { ...prev, name: newName } : prev)
    } catch {
      toast.error('重命名失败')
    }
    setEditingVideoId(null)
  }

  const loadVideos = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/video`)
      const data = await res.json()
      setVideos(data)

      // If there's a video with pending task, restore it; otherwise leave blank
      const pendingVideo = data.find((v: VideoRecord) => v.videoTaskId || v.compositeImageTaskId)
      if (pendingVideo) {
        selectVideo(pendingVideo)
      }
    } catch (error) {
      console.error('Failed to load videos', error)
    }
  }

  const handleCreateVideo = async () => {
    if (!selectedScriptId) {
      toast.error('请选择剧本')
      return
    }

    try {
      const res = await fetch(`/api/projects/${project.id}/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId: selectedScriptId,
          selectedShotIds: JSON.stringify(selectedShotIds),
          name: (() => { const now = new Date(); const timeStr = `${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`; return `视频 ${videos.length + 1} (${timeStr})` })(),
        }),
      })

      const video = await res.json()
      setCurrentVideo(video)
      setVideos([video, ...videos])
      toast.success('视频记录已创建')
    } catch (error) {
      toast.error('创建失败')
    }
  }

  const handleComposeImage = async () => {
    if (!currentVideo) {
      await handleCreateVideo()
      return
    }

    if (selectedCharacterIds.length === 0 && selectedSceneIds.length === 0) {
      toast.error('请至少选择一张角色或场景图片')
      return
    }

    setIsComposingImage(true)

    try {
      // Build prompt from config template
      let promptToUse: string | undefined = undefined
      let systemPromptToUse: string | undefined = undefined

      if (selectedImagePromptConfig) {
        const script = project.scripts.find(s => s.id === selectedScriptId)
        const characters = selectedCharacterIds
          .map(id => project.characters.find(c => c.id === id))
          .filter((c): c is Character => c !== undefined)
        const scenes = selectedSceneIds
          .map(id => project.scenes.find(s => s.id === id))
          .filter((s): s is Scene => s !== undefined)

        // Format shots information - only use selected shots
        const selectedShots = script?.shots?.filter(s => selectedShotIds.includes(s.id)) || []
        const shotsText = selectedShots.length > 0
          ? selectedShots.map(shot =>
              `Shot ${shot.order}: [${shot.cameraShotType}, ${shot.cameraMovement}] ${shot.sceneSetting}, ${shot.characterAction || ''}, Audio: ${shot.audio}`
            ).join('\n')
          : ''

        // Get systemPrompt
        systemPromptToUse = selectedImagePromptConfig.systemPrompt || undefined

        // Process userPrompt template
        const userPromptTemplate = selectedImagePromptConfig.userPrompt || ''
        promptToUse = userPromptTemplate
          .replace('{script}', script?.content?.substring(0, 300) || '')
          .replace('{characters}', characters.map(c => `${c.name}: ${c.description}`).join(', '))
          .replace('{scenes}', scenes.map(s => `${s.name}: ${s.description}`).join(', '))
          .replace('{shots}', shotsText)
      }

      const res = await fetch(`/api/projects/${project.id}/video/${currentVideo.id}/compose-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterIds: selectedCharacterIds,
          sceneIds: selectedSceneIds,
          customPrompt: promptToUse,
          systemPrompt: systemPromptToUse,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Composition failed')
      }

      const data = await res.json()

      // Handle async response
      if (data.status === 'QUEUED' || data.status === 'RUNNING') {
        setCurrentVideo({ ...currentVideo, compositeImageTaskId: data.taskId })
        setVideos(videos.map(v => v.id === currentVideo.id ? { ...v, compositeImageTaskId: data.taskId } : v))
        toast.info(data.message || '人物场景图生成中...')
        // Polling will start automatically via useEffect
      } else if (data.compositeImageUrl) {
        setCurrentVideo(data)
        setVideos(videos.map(v => v.id === data.id ? data : v))
        toast.success('人物场景图生成成功')
        setIsComposingImage(false)
      }
    } catch (error: any) {
      toast.error(error.message || '人物场景图生成失败')
      setIsComposingImage(false)
    }
  }

  const pollCompositeImageStatus = async () => {
    if (!currentVideo?.compositeImageTaskId) return

    try {
      const res = await fetch(`/api/projects/${project.id}/video/${currentVideo.id}/composite-image-status`)
      const data = await res.json()

      // Handle 404 - task no longer exists (already completed or cleared)
      if (res.status === 404) {
        // Stop polling
        if (compositeImagePollingRef.current) {
          clearInterval(compositeImagePollingRef.current)
          compositeImagePollingRef.current = null
        }
        setIsComposingImage(false)

        // Reload video data to get the compositeImageUrl if task completed
        try {
          const videoRes = await fetch(`/api/projects/${project.id}/video/${currentVideo.id}`)
          if (videoRes.ok) {
            const videoData = await videoRes.json()
            setCurrentVideo(videoData)
            setVideos(videos.map(v => v.id === videoData.id ? videoData : v))
            if (videoData.compositeImageUrl) {
              toast.success('人物场景图生成完成')
            }
          }
        } catch (e) {
          console.error('Failed to reload video data', e)
        }
        return
      }

      if (data.status === 'SUCCESS') {
        const updatedVideo = { ...currentVideo, compositeImageUrl: data.compositeImageUrl, compositeImageTaskId: null }
        setCurrentVideo(updatedVideo)
        setVideos(videos.map(v => v.id === updatedVideo.id ? updatedVideo : v))
        toast.success('人物场景图生成完成')
        setIsComposingImage(false)
        if (compositeImagePollingRef.current) {
          clearInterval(compositeImagePollingRef.current)
          compositeImagePollingRef.current = null
        }
      } else if (data.status === 'FAILED') {
        toast.error('人物场景图生成失败')
        setIsComposingImage(false)
        if (compositeImagePollingRef.current) {
          clearInterval(compositeImagePollingRef.current)
          compositeImagePollingRef.current = null
        }
      }
    } catch (error) {
      console.error('Failed to poll composite image status', error)
    }
  }

  const handlePromptSelect = (config: PromptConfig | null) => {
    setSelectedPromptConfig(config)
  }

  const handleImagePromptSelect = (config: PromptConfig | null) => {
    setSelectedImagePromptConfig(config)
  }

  const handleGeneratePrompt = async () => {
    if (!selectedScriptId) {
      toast.error('请先选择剧本')
      return
    }

    try {
      // Get script and related data
      const script = project.scripts.find(s => s.id === selectedScriptId)
      const characters = selectedCharacterIds
        .map(id => project.characters.find(c => c.id === id))
        .filter((c): c is Character => c !== undefined)
      const scenes = selectedSceneIds
        .map(id => project.scenes.find(s => s.id === id))
        .filter((s): s is Scene => s !== undefined)

      // Format shots information - only use selected shots
      const selectedShots = script?.shots?.filter(s => selectedShotIds.includes(s.id)) || []
      const shotsText = selectedShots.length > 0
        ? selectedShots.map(shot =>
            `Shot ${shot.order}: [${shot.cameraShotType}, ${shot.cameraMovement}] ${shot.sceneSetting}, ${shot.characterAction || ''}, Audio: ${shot.audio}`
          ).join('\n')
        : 'No shot breakdown available'

      // Use selected prompt config or default
      const systemPrompt = selectedPromptConfig?.systemPrompt || DEFAULT_VIDEO_SYSTEM_PROMPT
      const userPromptTemplate = selectedPromptConfig?.userPrompt || DEFAULT_VIDEO_USER_PROMPT

      // Fill in placeholders
      const filledPrompt = userPromptTemplate
        .replace('{script}', script?.content || '')
        .replace('{characters}', characters.map(c => `${c.name}: ${c.description}`).join(', '))
        .replace('{scenes}', scenes.map(s => `${s.name}: ${s.description}`).join(', '))
        .replace('{shots}', shotsText)
        .replace('{duration}', duration)
        .replace('{aspectRatio}', aspectRatio)

      // Call AI to generate final prompt using system prompt
      const res = await fetch(`/api/projects/${project.id}/video/${currentVideo?.id}/generate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId: selectedScriptId,
          systemPrompt,
          userPrompt: filledPrompt
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to generate prompt')
      }

      const data = await res.json()
      setVideoPrompt(data.prompt)
      toast.success('Prompt 已自动生成')
    } catch (error) {
      toast.error('Prompt 生成失败')
    }
  }

  const handleGenerateVideo = async () => {
    if (!currentVideo?.compositeImageUrl && !currentVideo?.storyboardUrl && !currentVideo?.storyboardImageBase64) {
      toast.error('请先生成人物场景图')
      return
    }

    if (!videoPrompt.trim()) {
      toast.error('请输入或生成视频 Prompt')
      return
    }

    setIsGeneratingVideo(true)

    try {
      const script = project.scripts.find(s => s.id === selectedScriptId)
      const selectedShots = script?.shots?.filter(s => selectedShotIds.includes(s.id)) || []
      let contextSuffix = ''
      if (script?.content) {
        contextSuffix += `\n\n[Reference Script]\n${script.content}`
      }
      if (selectedShots.length > 0) {
        const shotsText = selectedShots.map(shot =>
          `Shot ${shot.order}: [${shot.cameraShotType}, ${shot.cameraMovement}] ${shot.sceneSetting}, ${shot.characterAction || ''}`
        ).join('\n')
        contextSuffix += `\n\n[Shot Breakdown]\n${shotsText}`
      }

      const res = await fetch(`/api/projects/${project.id}/video/${currentVideo.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt + contextSuffix,
          duration,
          aspectRatio,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Video generation failed')
      }

      const data = await res.json()

      if (data.status === 'SUCCESS') {
        const updatedVideo = { ...currentVideo, videoUrl: data.videoUrl, videoTaskId: null, videoPrompt }
        setCurrentVideo(updatedVideo)
        setVideos(videos.map(v => v.id === updatedVideo.id ? updatedVideo : v))
        toast.success('视频生成成功')
        setIsGeneratingVideo(false)
      } else if (data.status === 'QUEUED' || data.status === 'RUNNING') {
        const updatedVideo = { ...currentVideo, videoTaskId: data.taskId, videoPrompt }
        setCurrentVideo(updatedVideo)
        setVideos(videos.map(v => v.id === updatedVideo.id ? updatedVideo : v))
        toast.info(data.message || '视频生成中...')
      }
    } catch (error: any) {
      toast.error(error.message || '视频生成失败')
      setIsGeneratingVideo(false)
    }
  }

  const pollVideoStatus = async () => {
    if (!currentVideo?.videoTaskId) return

    try {
      const res = await fetch(`/api/projects/${project.id}/video/${currentVideo.id}/status`)
      const data = await res.json()

      if (data.status === 'SUCCESS') {
        const updatedVideo = { ...currentVideo, videoUrl: data.videoUrl, videoTaskId: null }
        setCurrentVideo(updatedVideo)
        setVideos(videos.map(v => v.id === updatedVideo.id ? updatedVideo : v))
        toast.success('视频生成完成')
        setIsGeneratingVideo(false)
        if (videoPollingRef.current) {
          clearInterval(videoPollingRef.current)
          videoPollingRef.current = null
        }
      } else if (data.status === 'FAILED') {
        toast.error('视频生成失败')
        setIsGeneratingVideo(false)
        if (videoPollingRef.current) {
          clearInterval(videoPollingRef.current)
          videoPollingRef.current = null
        }
      }
    } catch (error) {
      console.error('Failed to poll video status', error)
    }
  }

  const toggleCharacterSelection = (id: string) => {
    setSelectedCharacterIds(prev =>
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    )
  }

  const toggleSceneSelection = (id: string) => {
    setSelectedSceneIds(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    )
  }

  // Get current script's shots
  const currentScript = project.scripts.find(s => s.id === selectedScriptId)
  const shots = currentScript?.shots || []

  // Toggle shot selection
  const toggleShotSelection = (id: string) => {
    setSelectedShotIds(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    )
  }

  // Select all shots
  const selectAllShots = () => {
    setSelectedShotIds(shots.map(s => s.id))
  }

  // Deselect all shots
  const deselectAllShots = () => {
    setSelectedShotIds([])
  }

  // Auto-select all shots when script changes (skip when restoring a saved video)
  useEffect(() => {
    if (isRestoringRef.current) return
    if (selectedScriptId) {
      const script = project.scripts.find(s => s.id === selectedScriptId)
      if (script?.shots) {
        setSelectedShotIds(script.shots.map(s => s.id))
      }
    } else {
      setSelectedShotIds([])
    }
  }, [selectedScriptId, project.scripts])

  return (
    <div className="space-y-4">
      <Tabs defaultValue="design" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
          <TabsTrigger
            value="design"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md"
          >
            <Video className="w-4 h-4 mr-2" />
            视频编辑
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md"
          >
            <Settings className="w-4 h-4 mr-2" />
            配置
          </TabsTrigger>
        </TabsList>

        {/* Design Tab */}
        <TabsContent value="design" className="space-y-6">
          {/* Video History Panel */}
          {videos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="w-4 h-4" />
                    视频历史
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={resetToNew}>
                    <Plus className="w-4 h-4 mr-1" />
                    新建视频
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {videos.map(video => {
                    const script = project.scripts.find(s => s.id === video.scriptId)
                    const isSelected = currentVideo?.id === video.id
                    const isGenerating = !!(video.videoTaskId || video.compositeImageTaskId)
                    const statusLabel = video.videoUrl
                      ? { text: '视频完成', cls: 'bg-green-100 text-green-700' }
                      : isGenerating
                      ? { text: '生成中', cls: 'bg-yellow-100 text-yellow-700' }
                      : video.compositeImageUrl
                      ? { text: '图片完成', cls: 'bg-blue-100 text-blue-700' }
                      : { text: '草稿', cls: 'bg-gray-100 text-gray-600' }
                    return (
                      <div
                        key={video.id}
                        onClick={() => selectVideo(video)}
                        className={`flex items-center gap-3 p-2 group cursor-pointer rounded-lg border transition-all ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 min-w-0">
                            {editingVideoId === video.id ? (
                              <input
                                autoFocus
                                className="text-xs font-medium w-full border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-purple-400"
                                value={editingName}
                                onChange={e => setEditingName(e.target.value)}
                                onBlur={() => handleRenameVideo(video.id, editingName)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleRenameVideo(video.id, editingName)
                                  if (e.key === 'Escape') setEditingVideoId(null)
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <>
                                <span className="text-xs font-medium truncate">
                                  {video.name || (script ? `第${script.episode}集 - ${script.title}` : '未命名视频')}
                                </span>
                                <button
                                  onClick={e => {
                                    e.stopPropagation()
                                    setEditingVideoId(video.id)
                                    setEditingName(video.name || (script ? `第${script.episode}集 - ${script.title}` : '未命名视频'))
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 flex-shrink-0 transition-all"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusLabel.cls}`}>
                            {statusLabel.text}
                          </span>
                        </div>
                        {!isGenerating && (
                          <button
                            onClick={(e) => handleDeleteVideo(e, video.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 1: Generate Composite Image */}
          <Card>
        <CardHeader>
          <CardTitle>步骤 1：生成人物场景图</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Script Selector */}
          <div className="space-y-2">
            <Label>选择剧本</Label>
            <Select value={selectedScriptId} onValueChange={setSelectedScriptId}>
              <SelectTrigger>
                <SelectValue placeholder="选择一个剧本" />
              </SelectTrigger>
              <SelectContent>
                {project.scripts.map(script => (
                  <SelectItem key={script.id} value={script.id}>
                    第{script.episode}集 - {script.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Shot Selection */}
          {shots.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>选择分镜 ({selectedShotIds.length}/{shots.length} 已选)</Label>
                <div className="space-x-2">
                  <Button size="sm" variant="outline" onClick={selectAllShots}>
                    全选
                  </Button>
                  <Button size="sm" variant="outline" onClick={deselectAllShots}>
                    取消全选
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {shots.map(shot => (
                  <div
                    key={shot.id}
                    className={`relative cursor-pointer border-2 rounded-lg p-3 transition-all ${
                      selectedShotIds.includes(shot.id)
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleShotSelection(shot.id)}
                  >
                    <div className="font-medium text-sm">Shot {shot.order}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      <div>景别: {shot.cameraShotType} / {shot.cameraMovement}</div>
                      <div className="truncate">场景: {shot.sceneSetting}</div>
                      <div className="truncate">角色: {shot.characterAction || '-'}</div>
                    </div>
                    {selectedShotIds.includes(shot.id) && (
                      <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                        ✓
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Character Selection */}
          <div className="space-y-2">
            <Label>选择角色图片 ({selectedCharacterIds.length} 张)</Label>
            <div className="grid grid-cols-6 gap-3">
              {project.characters.map(char => (
                <div
                  key={char.id}
                  className={`relative cursor-pointer border-2 rounded-lg transition-all ${
                    selectedCharacterIds.includes(char.id)
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleCharacterSelection(char.id)}
                >
                  <div className="w-full bg-gray-50 flex items-center justify-center overflow-hidden rounded-t-md">
                    {char.imageUrl ? (
                      <img
                        src={char.imageUrl}
                        alt={char.name}
                        className="w-full h-24 object-contain"
                      />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="bg-black/60 text-white text-xs p-1 text-center truncate">
                    {char.name}
                  </div>
                  {char.imageUrl && (
                    <button
                      className="absolute top-1 left-1 bg-black/50 hover:bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center"
                      onClick={(e) => { e.stopPropagation(); setPreviewImage(char.imageUrl); }}
                    >
                      <ZoomIn className="w-3 h-3" />
                    </button>
                  )}
                  {selectedCharacterIds.includes(char.id) && (
                    <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                      {selectedCharacterIds.indexOf(char.id) + 1}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Scene Selection */}
          <div className="space-y-2">
            <Label>选择场景图片 ({selectedSceneIds.length} 张)</Label>
            <div className="grid grid-cols-6 gap-3">
              {project.scenes.map(scene => (
                <div
                  key={scene.id}
                  className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                    selectedSceneIds.includes(scene.id)
                      ? 'border-green-500 ring-2 ring-green-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleSceneSelection(scene.id)}
                >
                  {scene.imageUrl ? (
                    <img
                      src={scene.imageUrl}
                      alt={scene.name}
                      className="w-full h-24 object-contain bg-gray-50"
                    />
                  ) : (
                    <div className="w-full h-24 bg-gray-100 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center truncate">
                    {scene.name}
                  </div>
                  {scene.imageUrl && (
                    <button
                      className="absolute top-1 left-1 bg-black/50 hover:bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center"
                      onClick={(e) => { e.stopPropagation(); setPreviewImage(scene.imageUrl); }}
                    >
                      <ZoomIn className="w-3 h-3" />
                    </button>
                  )}
                  {selectedSceneIds.includes(scene.id) && (
                    <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                      {selectedCharacterIds.length + selectedSceneIds.indexOf(scene.id) + 1}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Compose Button */}
          <Button
            onClick={handleComposeImage}
            disabled={isComposingImage || !!currentVideo?.compositeImageTaskId || (selectedCharacterIds.length === 0 && selectedSceneIds.length === 0)}
            className="w-full"
          >
            {isComposingImage || currentVideo?.compositeImageTaskId ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 h-4 w-4" />
                生成人物场景图
              </>
            )}
          </Button>

          {/* Composite Image Preview */}
          {currentVideo?.compositeImageUrl && (
            <div className="space-y-2">
              <Label>人物场景图预览</Label>
              {compositeImageError ? (
                <div className="w-full border rounded-lg p-6 text-center text-muted-foreground bg-muted">
                  <p className="mb-2">图片加载失败</p>
                  <Button variant="outline" size="sm" onClick={() => setCompositeImageError(false)}>
                    重新加载
                  </Button>
                </div>
              ) : (
                <img
                  src={currentVideo.compositeImageUrl}
                  alt="人物场景图"
                  className="w-full border rounded-lg"
                  onError={() => setCompositeImageError(true)}
                />
              )}
            </div>
          )}

          {/* Legacy: Show old storyboard if exists */}
          {!currentVideo?.compositeImageUrl && (currentVideo?.storyboardUrl || currentVideo?.storyboardImageBase64) && (
            <div className="space-y-2">
              <Label>分镜图预览（旧版）</Label>
              <img
                src={currentVideo.storyboardUrl || currentVideo.storyboardImageBase64 || ''}
                alt="Storyboard"
                className="w-full border rounded-lg"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Generate Video */}
      {(currentVideo?.compositeImageUrl || currentVideo?.storyboardUrl || currentVideo?.storyboardImageBase64) && (
        <Card>
          <CardHeader>
            <CardTitle>步骤 2：生成视频</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Prompt Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>视频生成 Prompt</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGeneratePrompt}
                  disabled={!selectedScriptId}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  从剧本自动生成
                </Button>
              </div>
              <Textarea
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                rows={6}
                placeholder="描述视频内容，包括角色动作、场景氛围、镜头运动等..."
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500">
                提示：详细的 Prompt 可以帮助生成更符合预期的视频效果
              </p>
            </div>

            {/* Video Parameters */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>时长</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5秒</SelectItem>
                    <SelectItem value="10">10秒</SelectItem>
                    <SelectItem value="15">15秒</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>宽高比</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 (横屏)</SelectItem>
                    <SelectItem value="9:16">9:16 (竖屏)</SelectItem>
                    <SelectItem value="1:1">1:1 (方形)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Generate Video Button */}
            <Button
              onClick={handleGenerateVideo}
              disabled={isGeneratingVideo || !!currentVideo.videoTaskId || !videoPrompt.trim()}
              className="w-full"
              variant="default"
            >
              {isGeneratingVideo || currentVideo.videoTaskId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  视频生成中...
                </>
              ) : (
                <>
                  <Video className="mr-2 h-4 w-4" />
                  生成视频
                </>
              )}
            </Button>

            {/* Video Player */}
            {currentVideo?.videoUrl && (
              <div className="space-y-2">
                <Label>生成的视频</Label>
                <video
                  src={currentVideo.videoUrl}
                  controls
                  className="w-full border rounded-lg"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </TabsContent>

    {/* Config Tab */}
    <TabsContent value="config" className="space-y-6 mt-6">
      {/* Image Prompt Configuration */}
      <PromptConfigPanel
        projectId={project.id}
        type="image"
        defaultSystemPrompt={DEFAULT_IMAGE_SYSTEM_PROMPT}
        defaultUserPrompt={DEFAULT_IMAGE_USER_PROMPT}
        onPromptSelect={handleImagePromptSelect}
        selectedPromptId={selectedImagePromptConfig?.id}
      />

      {/* Video Prompt Configuration */}
      <PromptConfigPanel
        projectId={project.id}
        type="video"
        defaultSystemPrompt={DEFAULT_VIDEO_SYSTEM_PROMPT}
        defaultUserPrompt={DEFAULT_VIDEO_USER_PROMPT}
        onPromptSelect={handlePromptSelect}
        selectedPromptId={selectedPromptConfig?.id}
      />
    </TabsContent>
  </Tabs>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-2">
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
