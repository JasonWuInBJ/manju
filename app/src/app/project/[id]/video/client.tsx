'use client'

import { useState } from 'react'
import { EpisodeEditor } from '@/components/episode-editor'
import { VideoEditor } from '@/components/video-editor-v2'

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
  audio: string
}

interface Script {
  id: string
  title: string
  content: string
  episode: number
  shots?: Shot[]
}

interface Project {
  id: string
  scripts: Script[]
  characters: Character[]
  scenes: Scene[]
  props: Prop[]
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
  script?: {
    id: string
    title: string
    episode: number
  } | null
}

export function VideoPageClient({ project }: { project: Project }) {
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null)

  const handleVideoUpdate = (video: VideoRecord) => {
    setSelectedVideo(video)
  }

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
      {/* Left Panel: Episode Editor */}
      <div className="col-span-4 overflow-y-auto pr-2">
        <EpisodeEditor
          projectId={project.id}
          onSelectVideo={setSelectedVideo}
          selectedVideoId={selectedVideo?.id || null}
        />
      </div>

      {/* Right Panel: Video Editor */}
      <div className="col-span-8 overflow-y-auto">
        <VideoEditor
          projectId={project.id}
          video={selectedVideo}
          scripts={project.scripts}
          characters={project.characters}
          scenes={project.scenes}
          props={project.props}
          onVideoUpdate={handleVideoUpdate}
        />
      </div>
    </div>
  )
}
