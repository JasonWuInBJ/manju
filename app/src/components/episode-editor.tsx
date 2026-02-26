'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Video,
  Image as ImageIcon,
  Loader2,
  Download,
  Pencil,
  Check,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

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
  order: number
  startTime: number | null
  endTime: number | null
  prompt: string | null
  assets: VideoAsset[]
  script?: {
    id: string
    title: string
    episode: number
  } | null
}

interface Episode {
  id: string
  name: string
  description: string | null
  scriptIds: string | null
  videos: VideoRecord[]
}

interface Props {
  projectId: string
  onSelectVideo: (video: VideoRecord) => void
  selectedVideoId: string | null
}

export function EpisodeEditor({ projectId, onSelectVideo, selectedVideoId }: Props) {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newEpisodeName, setNewEpisodeName] = useState('')
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Load episodes on mount
  useEffect(() => {
    loadEpisodes()
  }, [projectId])

  const loadEpisodes = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/episodes`)
      const data = await res.json()
      setEpisodes(data)

      // Select first episode if available
      if (data.length > 0 && !currentEpisode) {
        setCurrentEpisode(data[0])
      }
    } catch (error) {
      console.error('Failed to load episodes', error)
      toast.error('加载 Episode 失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateEpisode = async () => {
    if (!newEpisodeName.trim()) {
      toast.error('请输入名称')
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newEpisodeName }),
      })

      const episode = await res.json()
      setEpisodes([episode, ...episodes])
      setCurrentEpisode(episode)
      setNewEpisodeName('')
      setShowCreateDialog(false)
      toast.success('Episode 已创建')
    } catch (error) {
      toast.error('创建失败')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteEpisode = async (episodeId: string) => {
    if (!confirm('确定要删除这个 Episode 吗？包含的所有视频片段也会被删除。')) return

    try {
      await fetch(`/api/projects/${projectId}/episodes/${episodeId}`, { method: 'DELETE' })
      setEpisodes(episodes.filter(e => e.id !== episodeId))
      if (currentEpisode?.id === episodeId) {
        setCurrentEpisode(episodes.find(e => e.id !== episodeId) || null)
      }
      toast.success('Episode 已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  const handleRenameEpisode = async (episodeId: string, newName: string) => {
    try {
      await fetch(`/api/projects/${projectId}/episodes/${episodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      setEpisodes(episodes.map(e => e.id === episodeId ? { ...e, name: newName } : e))
      if (currentEpisode?.id === episodeId) {
        setCurrentEpisode({ ...currentEpisode, name: newName })
      }
    } catch {
      toast.error('重命名失败')
    }
    setEditingEpisodeId(null)
  }

  const handleMoveVideo = async (videoId: string, direction: 'up' | 'down') => {
    if (!currentEpisode) return

    const videos = [...currentEpisode.videos]
    const index = videos.findIndex(v => v.id === videoId)
    if (index === -1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= videos.length) return

    // Swap in local state
    const temp = videos[index]
    videos[index] = videos[newIndex]
    videos[newIndex] = temp

    // Update order values
    const videoOrders = videos.map((v, i) => ({ videoId: v.id, order: i }))

    try {
      await fetch(`/api/projects/${projectId}/episodes/${currentEpisode.id}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoOrders }),
      })

      setCurrentEpisode({ ...currentEpisode, videos })
      toast.success('顺序已更新')
    } catch {
      toast.error('更新失败')
    }
  }

  const handleCreateVideo = async () => {
    if (!currentEpisode) {
      toast.error('请先选择或创建 Episode')
      return
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId: currentEpisode.id,
          name: `片段 ${(currentEpisode.videos?.length || 0) + 1}`,
        }),
      })

      const video = await res.json()
      const updatedEpisode = {
        ...currentEpisode,
        videos: [...(currentEpisode.videos || []), video]
      }
      setCurrentEpisode(updatedEpisode)
      setEpisodes(episodes.map(e => e.id === currentEpisode.id ? updatedEpisode : e))
      onSelectVideo(video)
      toast.success('视频片段已创建')
    } catch {
      toast.error('创建失败')
    }
  }

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('确定要删除这个视频片段吗？')) return

    try {
      await fetch(`/api/projects/${projectId}/videos/${videoId}`, { method: 'DELETE' })

      if (currentEpisode) {
        const updatedVideos = currentEpisode.videos.filter(v => v.id !== videoId)
        const updatedEpisode = { ...currentEpisode, videos: updatedVideos }
        setCurrentEpisode(updatedEpisode)
        setEpisodes(episodes.map(e => e.id === currentEpisode.id ? updatedEpisode : e))
      }

      if (selectedVideoId === videoId) {
        onSelectVideo(null as unknown as VideoRecord)
      }

      toast.success('视频片段已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  const getVideoStatus = (video: VideoRecord) => {
    const compositeImage = video.assets.find(a => a.type === 'composite_image' && a.url)
    const videoAsset = video.assets.find(a => a.type === 'video' && a.url)
    const pendingTask = video.assets.find(a => a.taskId)

    if (videoAsset?.url) return { text: '视频完成', cls: 'bg-green-100 text-green-700' }
    if (pendingTask) return { text: '生成中', cls: 'bg-yellow-100 text-yellow-700' }
    if (compositeImage?.url) return { text: '图片完成', cls: 'bg-blue-100 text-blue-700' }
    return { text: '待处理', cls: 'bg-gray-100 text-gray-600' }
  }

  const handleDownloadAll = async () => {
    if (!currentEpisode?.videos) return

    const videoAssets = currentEpisode.videos
      .flatMap(v => v.assets)
      .filter(a => a.type === 'video' && a.url)

    if (videoAssets.length === 0) {
      toast.error('没有可下载的视频')
      return
    }

    for (const asset of videoAssets) {
      if (asset.url) {
        window.open(asset.url, '_blank')
      }
    }

    toast.success(`正在下载 ${videoAssets.length} 个视频`)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Episode List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Episode 管理</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />
              新建
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {episodes.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              还没有 Episode，点击上方按钮创建
            </div>
          ) : (
            <div className="space-y-2">
              {episodes.map(episode => {
                const isSelected = currentEpisode?.id === episode.id
                return (
                  <div
                    key={episode.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => setCurrentEpisode(episode)}
                  >
                    <div className="flex-1 min-w-0">
                      {editingEpisodeId === episode.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            className="text-sm font-medium w-full border rounded px-1 py-0.5"
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onClick={e => e.stopPropagation()}
                          />
                          <button
                            onClick={e => { e.stopPropagation(); handleRenameEpisode(episode.id, editingName) }}
                            className="p-1 hover:bg-green-100 rounded"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setEditingEpisodeId(null) }}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium truncate">{episode.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({episode.videos?.length || 0} 片段)
                          </span>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setEditingEpisodeId(episode.id)
                              setEditingName(episode.name)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteEpisode(episode.id) }}
                      className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video Clips in Current Episode */}
      {currentEpisode && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">视频片段</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleDownloadAll}>
                  <Download className="w-4 h-4 mr-1" />
                  批量下载
                </Button>
                <Button size="sm" onClick={handleCreateVideo}>
                  <Plus className="w-4 h-4 mr-1" />
                  新建片段
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {currentEpisode.videos?.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                还没有视频片段，点击上方按钮创建
              </div>
            ) : (
              <div className="space-y-2">
                {currentEpisode.videos?.map((video, index) => {
                  const status = getVideoStatus(video)
                  const isSelected = selectedVideoId === video.id
                  const compositeImage = video.assets.find(a => a.type === 'composite_image' && a.url)
                  const videoAsset = video.assets.find(a => a.type === 'video' && a.url)

                  return (
                    <div
                      key={video.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => onSelectVideo(video)}
                    >
                      {/* Thumbnail */}
                      <div className="w-20 h-12 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {compositeImage?.url ? (
                          <img src={compositeImage.url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {video.name || `片段 ${index + 1}`}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${status.cls}`}>
                            {status.text}
                          </span>
                          {videoAsset?.duration && (
                            <span className="text-xs text-muted-foreground">
                              {videoAsset.duration}s
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); handleMoveVideo(video.id, 'up') }}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleMoveVideo(video.id, 'down') }}
                          disabled={index === (currentEpisode.videos?.length || 0) - 1}
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteVideo(video.id) }}
                          className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Episode Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建 Episode</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                value={newEpisodeName}
                onChange={e => setNewEpisodeName(e.target.value)}
                placeholder="如：第一集片段合集"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateEpisode} disabled={isCreating}>
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
