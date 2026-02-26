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
import { ModelSelector } from './model-selector'
import { Sparkles, Settings, Loader2, Trash2, Plus, User, Check, FileText, Image as ImageIcon, Video, Upload } from 'lucide-react'
import { toast } from 'sonner'

interface Character {
  id: string
  name: string
  role: string
  description: string
  style: string
  prompt: string | null
  imageUrl: string | null
  imageTaskId: string | null
  fourViewImageUrl: string | null
  characterVideoUrl: string | null
  characterVideoTaskId: string | null
  soraCharacterId: string | null
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
  characters: Character[]
  scripts: Script[]
}

interface Props {
  project: Project
}

const STYLE_PROMPTS: Record<string, string> = {
  'cel-shaded': '赛璐璐平涂风格，干净线条，硬边阴影，高对比度，2D动漫风格',
  'realistic': '厚涂写实风格，柔和渐变，细腻光影，自然色调',
  'watercolor': '水彩淡雅风格，透明感，柔和边缘，低饱和度',
  'american-comic': '美漫风格，粗犷线条，强烈明暗对比，高饱和度',
}

const DEFAULT_SYSTEM_PROMPT = `# Role
你是一位精通AI图文生成的二次元角色设计专家。你擅长将剧本文字转化为精准、结构化的AI绘图提示词。
# Task
根据提供的【角色信息】与【剧本片段】，生成一份用于生成角色"全身立绘"的高质量英文提示词。
# Constraints & Logic
1. **结构化输出**：请严格按照以下顺序组织Prompt，使用英文逗号分隔：
   - **画质层**：masterpiece, best quality, highly detailed, 8k resolution, anime style.
   - **主体层**：角色性别、大致年龄、身材特征。
   - **外貌层**：发型、发色、瞳色、五官细节、表情（需反映剧本性格）。
   - **服装层**：详细的服装款式、颜色、配饰细节。
   - **构图层**：full body shot, standing, **simple pure white background**, **textless, no text, no watermark, no signature**, looking at viewer.
2. **性格视觉化**：根据剧本内容，将角色的性格转化为具体的表情和氛围词（例如：性格冷漠 -> cold expression, sharp eyes；性格活泼 -> bright smile, energetic pose）。
3. **背景与文字控制**：必须确保背景为纯白以突出人物主体，且画面中严禁出现任何文字、对话气泡或签名。textless, no text, no watermark, no signature。
4. **纯净输出**：只输出Prompt文本，不要包含任何解释、翻译或Markdown标记。`

const DEFAULT_USER_PROMPT_TEMPLATE = `角色名：{name}
角色类型：{role}
描述：{description}
风格：{style}

剧本参考：
{script}`

const STYLE_OPTIONS = [
  { value: 'cel-shaded', label: '赛璐璐平涂' },
  { value: 'realistic', label: '厚涂写实' },
  { value: 'watercolor', label: '水彩淡雅' },
  { value: 'american-comic', label: '美漫风格' },
]

const ROLE_OPTIONS = [
  { value: 'protagonist', label: '主角' },
  { value: 'antagonist', label: '反派' },
  { value: 'supporting', label: '配角' },
]

interface CharacterForm {
  name: string
  role: string
  description: string
  style: string
}

const emptyForm: CharacterForm = {
  name: '',
  role: 'supporting',
  description: '',
  style: 'cel-shaded',
}

export function CharacterDesigner({ project }: Props) {
  const [characters, setCharacters] = useState<Character[]>(project.characters)
  const [selectedId, setSelectedId] = useState<string | null>(characters[0]?.id || null)
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(
    project.scripts[0]?.id || null
  )
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [selectedPromptConfig, setSelectedPromptConfig] = useState<any>(null)
  const [selectedModel, setSelectedModel] = useState<string>('glm-5')
  
  // 弹窗状态
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [form, setForm] = useState<CharacterForm>(emptyForm)
  
  // 图片生成状态
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imageProgress, setImageProgress] = useState<string>('')
  const [aspectRatio, setAspectRatio] = useState<string>('3:4')

  // 四视图生成状态
  const [generatingFourView, setGeneratingFourView] = useState(false)
  const [fourViewProgress, setFourViewProgress] = useState<string>('')

  // 图片预览弹窗
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // 视频生成状态
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [videoProgress, setVideoProgress] = useState<string>('')
  const [videoPrompt, setVideoPrompt] = useState<string>('面对镜头，说天气不错，一起出去玩，和镜头互动；纯白色背景')
  const [videoDuration, setVideoDuration] = useState<string>('15')
  const [videoAspectRatio, setVideoAspectRatio] = useState<string>('9:16')

  // 角色上传状态
  const [uploadingCharacter, setUploadingCharacter] = useState(false)

  // 视频预览弹窗
  const [previewVideo, setPreviewVideo] = useState<string | null>(null)

  // 当前选中的角色
  const selected = characters.find(c => c.id === selectedId)
  const selectedScript = project.scripts.find(s => s.id === selectedScriptId)

  // 用于防止重复轮询
  const pollingRef = useRef(false)
  const pollingImageRef = useRef(false)

  // 当选中角色变化时，检查是否有未完成的图片生成任务
  useEffect(() => {
    if (!selected || !selected.imageTaskId || pollingImageRef.current) {
      return
    }

    // 如果有 taskId 但没有 imageUrl，说明任务还在进行中
    if (!selected.imageUrl) {
      console.log('[Character Image] 恢复图片生成轮询', {
        characterId: selected.id,
        taskId: selected.imageTaskId,
      })

      pollingImageRef.current = true
      setGeneratingImage(true)
      setImageProgress('恢复轮询中...')

      // 开始轮询
      pollTaskStatus(selected.imageTaskId, selected.id)
        .then(result => {
          if (result.error) {
            toast.error(result.error)
          } else if (result.imageUrl) {
            setCharacters(prev => prev.map(c =>
              c.id === selected.id ? { ...c, imageUrl: result.imageUrl!, imageTaskId: null } : c
            ))
            toast.success('图片生成成功')
          }
        })
        .catch(error => {
          console.error('Failed to poll image status:', error)
          toast.error('图片生成失败')
        })
        .finally(() => {
          setGeneratingImage(false)
          setImageProgress('')
          pollingImageRef.current = false
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected?.imageTaskId])

  // 当选中角色变化时，检查是否有未完成的视频生成任务
  useEffect(() => {
    if (!selected || !selected.characterVideoTaskId || pollingRef.current) {
      return
    }

    // 如果有 taskId 但没有 videoUrl，说明任务还在进行中
    if (!selected.characterVideoUrl) {
      console.log('[Character Video] 恢复视频生成轮询', {
        characterId: selected.id,
        taskId: selected.characterVideoTaskId,
      })

      pollingRef.current = true
      setGeneratingVideo(true)
      setVideoProgress('恢复轮询中...')

      // 开始轮询
      pollVideoStatus(selected.characterVideoTaskId, selected.id)
        .then(result => {
          if (result.error) {
            toast.error(result.error)
          } else if (result.videoUrl) {
            toast.success('视频生成成功')
          }
        })
        .catch(error => {
          console.error('Failed to poll video status:', error)
          toast.error('视频生成失败')
        })
        .finally(() => {
          setGeneratingVideo(false)
          setVideoProgress('')
          pollingRef.current = false
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected?.characterVideoTaskId])

  // 从剧本提取角色
  const handleExtract = async () => {
    if (!selectedScriptId || !selectedScript?.content) return
    setExtracting(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/characters/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scriptContent: selectedScript.content,
          scriptId: selectedScriptId 
        }),
      })
      const data = await res.json()
      if (data.characters) {
        // 去重：保留已存在的角色（按名称判断）
        const existingNames = new Set(characters.map(c => c.name.toLowerCase()))
        const uniqueNewCharacters = data.characters.filter(
          (c: Character) => !existingNames.has(c.name.toLowerCase())
        )
        
        // 合并：已有角色 + 新角色
        const mergedCharacters = [...characters, ...uniqueNewCharacters]
        setCharacters(mergedCharacters)
        
        // 如果有新角色，选中第一个新角色
        if (uniqueNewCharacters.length > 0) {
          setSelectedId(uniqueNewCharacters[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to extract:', error)
    } finally {
      setExtracting(false)
    }
  }

  // 手动创建角色
  const handleCreate = async () => {
    if (!form.name.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const char = await res.json()
      setCharacters([...characters, char])
      setSelectedId(char.id)
      setForm(emptyForm)
      setIsAddDialogOpen(false)
    } catch (error) {
      console.error('Failed to create:', error)
    } finally {
      setLoading(false)
    }
  }

  // 生成绘图 Prompt
  const handleGeneratePrompt = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const styleDesc = STYLE_PROMPTS[selected.style] || STYLE_PROMPTS['cel-shaded']

      let systemPrompt = DEFAULT_SYSTEM_PROMPT
      let userPrompt = DEFAULT_USER_PROMPT_TEMPLATE

      if (selectedPromptConfig) {
        systemPrompt = selectedPromptConfig.systemPrompt
        userPrompt = selectedPromptConfig.userPrompt || DEFAULT_USER_PROMPT_TEMPLATE
      }

      // 获取剧本内容作为参考
      const scriptContent = selectedScript?.content || '暂无剧本'

      const finalUserPrompt = userPrompt
        .replace('{name}', selected.name)
        .replace('{role}', selected.role)
        .replace('{description}', selected.description)
        .replace('{style}', styleDesc)
        .replace('{script}', scriptContent)

      const res = await fetch(`/api/projects/${project.id}/characters/${selected.id}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          userPrompt: finalUserPrompt,
        }),
      })
      const data = await res.json()

      // 更新角色的 prompt
      setCharacters(characters.map(c =>
        c.id === selected.id ? { ...c, prompt: data.prompt } : c
      ))
    } catch (error) {
      console.error('Failed to generate prompt:', error)
    } finally {
      setLoading(false)
    }
  }

  // 删除角色
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个角色吗？')) return
    try {
      await fetch(`/api/projects/${project.id}/characters/${id}`, { method: 'DELETE' })
      const newChars = characters.filter(c => c.id !== id)
      setCharacters(newChars)
      if (selectedId === id) setSelectedId(newChars[0]?.id || null)
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  // 保存角色修改
  const handleSave = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/characters/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected),
      })
      const updated = await res.json()
      setCharacters(characters.map(c => c.id === updated.id ? updated : c))
    } catch (error) {
      console.error('Failed to update:', error)
    } finally {
      setLoading(false)
    }
  }

  // 更新选中角色的字段
  const updateSelected = (updates: Partial<Character>) => {
    if (!selected) return
    setCharacters(characters.map(c => 
      c.id === selected.id ? { ...c, ...updates } : c
    ))
  }

  // 轮询任务状态
  const pollTaskStatus = async (taskId: string, characterId: string): Promise<{ imageUrl?: string; error?: string }> => {
    const maxAttempts = 36 // 最多轮询 36 次（约 3 分钟）
    const pollInterval = 5000 // 每 5 秒轮询一次

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      setImageProgress(`生成中... (${attempt + 1}/${maxAttempts})`)

      const res = await fetch(
        `/api/projects/${project.id}/characters/${characterId}/image/status?taskId=${taskId}`
      )
      const data = await res.json()

      if (data.status === 'SUCCESS') {
        return { imageUrl: data.imageUrl }
      }

      if (data.status === 'FAILED') {
        return { error: data.error || '图片生成失败' }
      }

      // 继续等待
      if (data.status === 'QUEUED') {
        setImageProgress('排队中...')
      } else if (data.status === 'RUNNING') {
        setImageProgress('生成中...')
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    return { error: '图片生成超时，请稍后重试' }
  }

  // 生成角色图片
  const handleGenerateImage = async () => {
    if (!selected || !selected.prompt) {
      toast.error('请先生成绘图 Prompt')
      return
    }

    setGeneratingImage(true)
    setImageProgress('正在初始化...')

    try {
      const res = await fetch(`/api/projects/${project.id}/characters/${selected.id}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: selected.prompt,
          aspectRatio,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || '图片生成失败')
      }

      const data = await res.json()

      // 如果返回了 taskId，需要轮询
      if (data.taskId && (data.status === 'QUEUED' || data.status === 'RUNNING')) {
        setImageProgress(data.status === 'QUEUED' ? '排队中...' : '生成中...')

        // 立即保存 taskId 到本地状态
        setCharacters(prev => prev.map(c =>
          c.id === selected.id ? { ...c, imageTaskId: data.taskId } : c
        ))

        const result = await pollTaskStatus(data.taskId, selected.id)

        if (result.error) {
          throw new Error(result.error)
        }

        if (result.imageUrl) {
          // 更新角色的图片 URL
          setCharacters(prev => prev.map(c =>
            c.id === selected.id ? { ...c, imageUrl: result.imageUrl!, imageTaskId: null } : c
          ))
          toast.success('图片生成成功')
        }
      } else if (data.imageUrl) {
        // 直接返回了图片 URL
        setCharacters(characters.map(c =>
          c.id === selected.id ? { ...c, imageUrl: data.imageUrl, imageTaskId: null } : c
        ))
        toast.success('图片生成成功')
      }
    } catch (error) {
      console.error('Failed to generate image:', error)
      toast.error(error instanceof Error ? error.message : '图片生成失败')
    } finally {
      setGeneratingImage(false)
      setImageProgress('')
    }
  }

  // 轮询四视图任务状态
  const pollFourViewStatus = async (taskId: string, characterId: string): Promise<{ fourViewImageUrl?: string; error?: string }> => {
    const maxAttempts = 60 // 最多轮询 60 次（约 5 分钟，4K 生成耗时更长）
    const pollInterval = 5000 // 每 5 秒轮询一次

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      setFourViewProgress(`生成中... (${attempt + 1}/${maxAttempts})`)

      const res = await fetch(
        `/api/projects/${project.id}/characters/${characterId}/views/status?taskId=${taskId}`
      )
      const data = await res.json()

      if (data.status === 'SUCCESS') {
        return { fourViewImageUrl: data.fourViewImageUrl }
      }

      if (data.status === 'FAILED') {
        return { error: data.error || '四视图生成失败' }
      }

      // 继续等待
      if (data.status === 'QUEUED') {
        setFourViewProgress('排队中...')
      } else if (data.status === 'RUNNING') {
        setFourViewProgress('生成中...')
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    return { error: '四视图生成超时，请稍后重试' }
  }

  // 生成四视图
  const handleGenerateFourView = async () => {
    if (!selected || !selected.imageUrl) {
      toast.error('请先生成角色概念图')
      return
    }

    setGeneratingFourView(true)
    setFourViewProgress('正在初始化...')

    try {
      const res = await fetch(`/api/projects/${project.id}/characters/${selected.id}/views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '四视图生成失败')
      }

      const data = await res.json()

      // 如果返回了 taskId，需要轮询
      if (data.taskId && (data.status === 'QUEUED' || data.status === 'RUNNING')) {
        setFourViewProgress(data.status === 'QUEUED' ? '排队中...' : '生成中...')

        const result = await pollFourViewStatus(data.taskId, selected.id)

        if (result.error) {
          throw new Error(result.error)
        }

        if (result.fourViewImageUrl) {
          // 更新角色的四视图 URL
          setCharacters(characters.map(c =>
            c.id === selected.id ? { ...c, fourViewImageUrl: result.fourViewImageUrl! } : c
          ))
          toast.success('四视图生成成功')
        }
      } else if (data.fourViewImageUrl) {
        // 直接返回了四视图 URL
        setCharacters(characters.map(c =>
          c.id === selected.id ? { ...c, fourViewImageUrl: data.fourViewImageUrl } : c
        ))
        toast.success('四视图生成成功')
      }
    } catch (error) {
      console.error('Failed to generate four view:', error)
      toast.error(error instanceof Error ? error.message : '四视图生成失败')
    } finally {
      setGeneratingFourView(false)
      setFourViewProgress('')
    }
  }

  // 轮询视频任务状态
  const pollVideoStatus = async (taskId: string, characterId: string): Promise<{ videoUrl?: string; error?: string }> => {
    const maxAttempts = 120 // 最多轮询 120 次（约 10 分钟，视频生成耗时更长）
    const pollInterval = 5000 // 每 5 秒轮询一次

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      setVideoProgress(`生成中... (${attempt + 1}/${maxAttempts})`)

      const res = await fetch(
        `/api/projects/${project.id}/characters/${characterId}/video/status?taskId=${taskId}`
      )
      const data = await res.json()

      if (data.status === 'SUCCESS') {
        // 更新角色状态，清除 taskId
        setCharacters(prev => prev.map(c =>
          c.id === characterId ? { ...c, characterVideoUrl: data.videoUrl, characterVideoTaskId: null } : c
        ))
        return { videoUrl: data.videoUrl }
      }

      if (data.status === 'FAILED') {
        // 清除 taskId
        setCharacters(prev => prev.map(c =>
          c.id === characterId ? { ...c, characterVideoTaskId: null } : c
        ))
        return { error: data.error || '视频生成失败' }
      }

      // 继续等待
      if (data.status === 'QUEUED') {
        setVideoProgress('排队中...')
      } else if (data.status === 'RUNNING') {
        setVideoProgress('生成中...')
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    // 超时，清除 taskId
    setCharacters(prev => prev.map(c =>
      c.id === characterId ? { ...c, characterVideoTaskId: null } : c
    ))
    return { error: '视频生成超时，请稍后重试' }
  }

  // 生成角色视频
  const handleGenerateVideo = async () => {
    if (!selected || !selected.imageUrl) {
      toast.error('请先生成角色图片')
      return
    }

    setGeneratingVideo(true)
    setVideoProgress('正在初始化...')

    try {
      const res = await fetch(`/api/projects/${project.id}/characters/${selected.id}/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt,
          duration: videoDuration,
          aspectRatio: videoAspectRatio,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        const errorMsg = error.details ? `${error.error}: ${error.details}` : (error.error || '视频生成失败')
        throw new Error(errorMsg)
      }

      const data = await res.json()

      // 如果返回了 taskId，需要轮询
      if (data.taskId && (data.status === 'QUEUED' || data.status === 'RUNNING')) {
        setVideoProgress(data.status === 'QUEUED' ? '排队中...' : '生成中...')

        // 更新角色的 taskId，以便页面刷新后恢复轮询
        setCharacters(prev => prev.map(c =>
          c.id === selected.id ? { ...c, characterVideoTaskId: data.taskId } : c
        ))

        const result = await pollVideoStatus(data.taskId, selected.id)

        if (result.error) {
          throw new Error(result.error)
        }

        if (result.videoUrl) {
          toast.success('视频生成成功')
        }
      } else if (data.videoUrl) {
        // 直接返回了视频 URL
        setCharacters(characters.map(c =>
          c.id === selected.id ? { ...c, characterVideoUrl: data.videoUrl, characterVideoTaskId: null } : c
        ))
        toast.success('视频生成成功')
      }
    } catch (error) {
      console.error('Failed to generate video:', error)
      toast.error(error instanceof Error ? error.message : '视频生成失败')
    } finally {
      setGeneratingVideo(false)
      setVideoProgress('')
    }
  }

  // 轮询上传任务状态
  const pollUploadStatus = async (taskId: string, characterId: string): Promise<{ soraCharacterId?: string; error?: string }> => {
    const maxAttempts = 60 // 最多轮询 60 次（约 5 分钟）
    const pollInterval = 5000 // 每 5 秒轮询一次

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      console.log('[Character Upload Poll] 轮询中', { attempt: attempt + 1, maxAttempts, taskId })

      const res = await fetch(
        `/api/projects/${project.id}/characters/${characterId}/upload/status?taskId=${taskId}`
      )
      const data = await res.json()

      console.log('[Character Upload Poll] 轮询响应', {
        attempt: attempt + 1,
        status: data.status,
        soraCharacterId: data.soraCharacterId,
        error: data.error,
        fullData: data,
      })

      if (data.status === 'SUCCESS') {
        // 更新角色状态
        setCharacters(prev => prev.map(c =>
          c.id === characterId ? { ...c, soraCharacterId: data.soraCharacterId } : c
        ))
        return { soraCharacterId: data.soraCharacterId }
      }

      if (data.status === 'FAILED') {
        return { error: data.error || '角色上传失败' }
      }

      // 继续等待
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    return { error: '角色上传超时，请稍后重试' }
  }

  // 上传角色
  const handleUploadCharacter = async () => {
    if (!selected || !selected.characterVideoUrl) {
      toast.error('请先生成角色视频')
      return
    }

    setUploadingCharacter(true)

    try {
      const res = await fetch(`/api/projects/${project.id}/characters/${selected.id}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const error = await res.json()
        const errorMsg = error.details ? `${error.error}: ${error.details}` : (error.error || '角色上传失败')
        throw new Error(errorMsg)
      }

      const data = await res.json()

      // 如果返回了 taskId，需要轮询
      if (data.taskId && (data.status === 'QUEUED' || data.status === 'RUNNING')) {
        const result = await pollUploadStatus(data.taskId, selected.id)

        if (result.error) {
          throw new Error(result.error)
        }

        if (result.soraCharacterId) {
          toast.success('角色上传成功')
        }
      } else if (data.soraCharacterId) {
        // 直接返回了角色 ID
        setCharacters(characters.map(c =>
          c.id === selected.id ? { ...c, soraCharacterId: data.soraCharacterId } : c
        ))
        toast.success('角色上传成功')
      }
    } catch (error) {
      console.error('Failed to upload character:', error)
      toast.error(error instanceof Error ? error.message : '角色上传失败')
    } finally {
      setUploadingCharacter(false)
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="design" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
          <TabsTrigger value="design" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md rounded-lg transition-all">
            <Sparkles className="w-4 h-4 mr-2" />
            角色设计
          </TabsTrigger>
          <TabsTrigger value="config" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md rounded-lg transition-all">
            <Settings className="w-4 h-4 mr-2" />
            配置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左侧列：角色列表 */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  从剧本提取角色
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 剧集选择 */}
                {project.scripts.length > 0 ? (
                  <>
                    <Select value={selectedScriptId || ''} onValueChange={setSelectedScriptId}>
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
                          从剧本提取角色
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

              {/* 角色列表 */}
              <CardHeader className="pt-2 pb-3 border-t">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>角色列表</span>
                  <Badge variant="secondary">{characters.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[320px]">
                  {characters.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂无角色</p>
                      <p className="text-xs mt-1">从剧本提取或手动添加</p>
                    </div>
                  ) : (
                    <div className="space-y-2 pr-2">
                      {characters.map(char => {
                        const isSelected = selectedId === char.id
                        return (
                          <div
                            key={char.id}
                            onClick={() => setSelectedId(char.id)}
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
                                {char.imageUrl ? (
                                  <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-5 h-5 text-slate-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm truncate">{char.name}</span>
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-blue-500 shrink-0" />
                                  )}
                                  {char.soraCharacterId && (
                                    <Badge className="bg-green-500 text-white text-xs px-1.5 py-0 shrink-0">
                                      已上传
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                                    {ROLE_OPTIONS.find(r => r.value === char.role)?.label}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                                    {STYLE_OPTIONS.find(s => s.value === char.style)?.label}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {char.description || '暂无描述'}
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
                >
                  <Plus className="w-4 h-4 mr-2" />
                  手动添加角色
                </Button>
              </CardContent>
            </Card>

            {/* 右侧列：角色详情 */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>角色详情</span>
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
                    {/* 角色信息编辑 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium mb-1.5 block">角色名</Label>
                        <Input 
                          value={selected.name} 
                          onChange={e => updateSelected({ name: e.target.value })}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-1.5 block">角色类型</Label>
                        <Select value={selected.role} onValueChange={v => updateSelected({ role: v })}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">风格</Label>
                      <Select value={selected.style} onValueChange={v => updateSelected({ style: v })}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STYLE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">描述</Label>
                      <Textarea
                        value={selected.description}
                        onChange={e => updateSelected({ description: e.target.value })}
                        placeholder="角色的外貌、性格、背景等..."
                        className="min-h-[80px] resize-none overflow-hidden"
                        style={{ height: 'auto', minHeight: '80px' }}
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

                    {/* 绘图 Prompt */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">绘图 Prompt</Label>
                      <Textarea
                        value={selected.prompt || ''}
                        onChange={e => updateSelected({ prompt: e.target.value || null })}
                        placeholder="点击下方按钮生成..."
                        className="min-h-[100px] font-mono text-sm resize-none overflow-hidden"
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
                              生成 Prompt
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* 角色图片 */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">角色图片</Label>
                      <div className="flex gap-4">
                        <div className={`w-[200px] bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden relative ${aspectRatio === '1:1' ? 'aspect-square' : aspectRatio === '4:3' ? 'aspect-[4/3]' : aspectRatio === '16:9' ? 'aspect-video' : aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-[3/4]'}`}>
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
                              className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setPreviewImage(selected.imageUrl)}
                            />
                          ) : (
                            <div className="text-center text-muted-foreground">
                              <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p className="text-xs">暂无图片</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">图片比例</Label>
                            <Select value={aspectRatio} onValueChange={setAspectRatio}>
                              <SelectTrigger className="w-[100px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1:1">1:1</SelectItem>
                                <SelectItem value="3:4">3:4</SelectItem>
                                <SelectItem value="4:3">4:3</SelectItem>
                                <SelectItem value="16:9">16:9</SelectItem>
                                <SelectItem value="9:16">9:16</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            onClick={handleGenerateImage}
                            disabled={generatingImage || !selected.prompt}
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
                          {!selected.prompt && (
                            <p className="text-xs text-muted-foreground">
                              请先生成 Prompt
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 四视图 */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">四视图角色设计</Label>
                      <div className="space-y-3">
                        <div className="aspect-video w-full bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden relative">
                          {generatingFourView && (
                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10">
                              <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                              <p className="text-white text-xs">{fourViewProgress || '生成中...'}</p>
                            </div>
                          )}
                          {selected.fourViewImageUrl ? (
                            <img
                              src={selected.fourViewImageUrl}
                              alt={`${selected.name} 四视图`}
                              className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setPreviewImage(selected.fourViewImageUrl)}
                            />
                          ) : (
                            <div className="text-center text-muted-foreground">
                              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p className="text-xs">暂无四视图</p>
                              <p className="text-xs mt-1">包含：胸部以上近景、正面全身、背面全身、左侧全身</p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={handleGenerateFourView}
                            disabled={generatingFourView || !selected.imageUrl}
                            size="sm"
                          >
                            {generatingFourView ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                生成中...
                              </>
                            ) : (
                              <>
                                <ImageIcon className="w-4 h-4 mr-2" />
                                生成四视图
                              </>
                            )}
                          </Button>
                          {!selected.imageUrl && (
                            <p className="text-xs text-muted-foreground">
                              请先生成角色概念图
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 角色上传 */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">角色上传</Label>
                      <div className="space-y-3">
                        {/* 视频生成区域 */}
                        <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                          <p className="text-sm font-medium mb-3">第一步：生成角色视频</p>
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">视频提示词（可选）</Label>
                              <Textarea
                                value={videoPrompt}
                                onChange={e => setVideoPrompt(e.target.value)}
                                placeholder="描述角色的动作、表情等..."
                                className="min-h-[60px] text-sm"
                              />
                            </div>
                            <div className="flex gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">时长</Label>
                                <Select value={videoDuration} onValueChange={setVideoDuration}>
                                  <SelectTrigger className="w-[80px] h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="5">5秒</SelectItem>
                                    <SelectItem value="10">10秒</SelectItem>
                                    <SelectItem value="15">15秒</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">比例</Label>
                                <Select value={videoAspectRatio} onValueChange={setVideoAspectRatio}>
                                  <SelectTrigger className="w-[80px] h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1:1">1:1</SelectItem>
                                    <SelectItem value="16:9">16:9</SelectItem>
                                    <SelectItem value="9:16">9:16</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* 视频预览 */}
                            {selected.characterVideoUrl && (
                              <div className="aspect-video w-full bg-black rounded-lg overflow-hidden relative">
                                <video
                                  src={selected.characterVideoUrl}
                                  controls
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            )}

                            {generatingVideo && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{videoProgress || '生成中...'}</span>
                              </div>
                            )}

                            <Button
                              onClick={handleGenerateVideo}
                              disabled={generatingVideo || !selected.imageUrl}
                              size="sm"
                            >
                              {generatingVideo ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  生成中...
                                </>
                              ) : (
                                <>
                                  <Video className="w-4 h-4 mr-2" />
                                  生成视频
                                </>
                              )}
                            </Button>
                            {!selected.imageUrl && (
                              <p className="text-xs text-muted-foreground">
                                请先生成角色图片
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 上传区域 */}
                        <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium">第二步：上传角色</p>
                            {selected.soraCharacterId && (
                              <Badge className="bg-green-500 hover:bg-green-600 text-white">
                                已上传
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-3">
                            {selected.soraCharacterId && (
                              <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                                      ✓ 角色已上传成功
                                    </p>
                                    <div className="space-y-1">
                                      <p className="text-xs text-green-600 dark:text-green-400">
                                        角色 ID:
                                      </p>
                                      <p className="text-sm font-mono text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded break-all">
                                        {selected.soraCharacterId}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            <Button
                              onClick={handleUploadCharacter}
                              disabled={uploadingCharacter || !selected.characterVideoUrl}
                              size="sm"
                            >
                              {uploadingCharacter ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  上传中...
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4 mr-2" />
                                  {selected.soraCharacterId ? '重新上传' : '上传角色'}
                                </>
                              )}
                            </Button>
                            {!selected.characterVideoUrl && (
                              <p className="text-xs text-muted-foreground">
                                请先生成角色视频
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 保存按钮 */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button onClick={handleSave} disabled={loading}>
                        保存
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-muted-foreground">
                    <User className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>选择一个角色查看详情</p>
                    <p className="text-sm mt-1">或从剧本提取 / 手动添加角色</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-6 mt-6">
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            title="角色 Prompt 生成模型"
            description="选择用于生成角色绘图 Prompt 的 AI 模型"
          />
          <PromptConfigPanel
            projectId={project.id}
            type="character"
            defaultSystemPrompt={DEFAULT_SYSTEM_PROMPT}
            defaultUserPrompt={DEFAULT_USER_PROMPT_TEMPLATE}
            onPromptSelect={setSelectedPromptConfig}
            selectedPromptId={selectedPromptConfig?.id}
          />
        </TabsContent>
      </Tabs>

      {/* 手动添加角色弹窗 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加角色</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">角色名</Label>
              <Input 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})} 
                placeholder="输入角色名..."
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">角色类型</Label>
              <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">风格</Label>
              <Select value={form.style} onValueChange={v => setForm({...form, style: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map(opt => (
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
                placeholder="角色的外貌、性格、背景等..."
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
                '创建角色'
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

      {/* 视频预览弹窗 */}
      <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
        <DialogContent className="max-w-4xl p-2">
          {previewVideo && (
            <video
              src={previewVideo}
              controls
              autoPlay
              className="w-full h-auto max-h-[80vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
