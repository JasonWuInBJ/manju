'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PromptConfigPanel } from './prompt-config-panel'
import { Sparkles, Settings, Film, Loader2, Trash2, Plus, Save, ChevronDown, ChevronRight, Clock, Video } from 'lucide-react'

interface Shot {
  id?: string
  order: number
  duration: number
  cameraShotType: string
  cameraMovement: string
  sceneSetting: string
  characterAction?: string | null
  visualPrompt: string
  negativePrompt?: string | null
  refCharacterIds?: string | null
  refPropIds?: string | null
  refSceneIds?: string | null
  audio: string
  dialogue?: string
}

interface CharacterRef {
  id: string
  name: string
}

interface SceneRef {
  id: string
  name: string
}

interface PropRef {
  id: string
  name: string
}

interface Script {
  id: string
  episode: number
  title: string
  content: string
  shots: Shot[]
}

interface Project {
  id: string
  title: string
  defaultNegativePrompt?: string | null
  scripts: Script[]
  characters: CharacterRef[]
  scenes: SceneRef[]
  props: PropRef[]
}

interface Props {
  project: Project
}

const DEFAULT_SYSTEM_PROMPT = `你是一位专业的AI视频分镜师。根据剧本内容生成分镜数据。

## 可用角色资产
{characters}

## 可用场景资产
{scenes}

## 可用道具资产
{props}

## 输出要求
- visual_prompt 必须为英文，格式：主体 + 动作 + 环境 + 光影 + 镜头语言，要求高质量、电影感
- ref_character_ids 引用上方角色ID（数组），系统会自动将角色外貌描述注入到视频模型的prompt中
- ref_scene_ids 引用上方场景ID（数组），系统会自动将场景环境描述注入到视频模型的prompt中
- ref_prop_ids 引用上方道具ID（数组），系统会自动将道具描述注入到视频模型的prompt中
- camera_shot_type 使用标准值：wide, medium, close, extreme-close
- camera_movement 使用标准值：static, slow_push_in, slow_pull_out, pan_left, pan_right, tilt_up, tilt_down, dynamic_follow, slight_handheld_shake, orbit
- duration 单位为秒，建议 3-6 秒/镜头
- negative_prompt 只在需要额外约束时填写（可选），系统有全局默认值
- scene_setting 和 character_action 用中文描述，供用户阅读理解
- character_action 可选，纯场景镜头可以不填

输出纯JSON，不要其他内容。格式：
{
  "shots": [
    {
      "order": 1,
      "duration": 4,
      "camera_shot_type": "wide/medium/close/extreme-close",
      "camera_movement": "static/slow_push_in/...",
      "scene_setting": "中文场景描述",
      "character_action": "中文角色动作描述（可选）",
      "visual_prompt": "English visual prompt for video model",
      "negative_prompt": "optional negative prompt",
      "ref_character_ids": ["character_id"],
      "ref_scene_ids": ["scene_id"],
      "ref_prop_ids": ["prop_id"],
      "dialogue": "角色对白，无则留空",
      "audio": "音效描述，无则留空"
    }
  ]
}`
const DEFAULT_USER_PROMPT_TEMPLATE = `请将以下剧本转换为分镜：\n\n{script}`

const CAMERA_SHOT_OPTIONS = [
  { value: 'wide', label: '远景' },
  { value: 'medium', label: '中景' },
  { value: 'close', label: '近景' },
  { value: 'extreme-close', label: '特写' },
]

const CAMERA_MOVEMENT_OPTIONS = [
  { value: 'static', label: '静止' },
  { value: 'slow_push_in', label: '缓推' },
  { value: 'slow_pull_out', label: '缓拉' },
  { value: 'pan_left', label: '左摇' },
  { value: 'pan_right', label: '右摇' },
  { value: 'tilt_up', label: '上仰' },
  { value: 'tilt_down', label: '下俯' },
  { value: 'dynamic_follow', label: '跟随' },
  { value: 'slight_handheld_shake', label: '手持微晃' },
  { value: 'orbit', label: '环绕' },
]

interface ShotData {
  order: number
  duration: number
  cameraShotType: string
  cameraMovement: string
  sceneSetting: string
  characterAction?: string | null
  visualPrompt: string
  negativePrompt?: string | null
  refCharacterIds?: string | null
  refPropIds?: string | null
  refSceneIds?: string | null
  audio: string
  dialogue?: string
}

function computeTimeSlot(shots: ShotData[], index: number): string {
  let start = 0
  for (let i = 0; i < index; i++) {
    start += shots[i].duration
  }
  const end = start + shots[index].duration
  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${fmt(start)}-${fmt(end)}`
}

function parseRefIds(json: string | null | undefined): string[] {
  if (!json) return []
  try { return JSON.parse(json) } catch { return [] }
}

export function StoryboardEditor({ project }: Props) {
  const [activeScriptId, setActiveScriptId] = useState<string>(project.scripts[0]?.id || '')
  const activeScript = project.scripts.find(s => s.id === activeScriptId)

  const [shotsMap, setShotsMap] = useState<Record<string, ShotData[]>>(() => {
    const map: Record<string, ShotData[]> = {}
    project.scripts.forEach(script => {
      map[script.id] = script.shots?.map(s => ({
        order: s.order,
        duration: s.duration,
        cameraShotType: s.cameraShotType,
        cameraMovement: s.cameraMovement,
        sceneSetting: s.sceneSetting,
        characterAction: s.characterAction,
        visualPrompt: s.visualPrompt,
        negativePrompt: s.negativePrompt,
        refCharacterIds: s.refCharacterIds,
        refPropIds: s.refPropIds,
        refSceneIds: s.refSceneIds,
        audio: s.audio,
        dialogue: s.dialogue || '',
      })) || []
    })
    return map
  })

  const shots = shotsMap[activeScriptId] || []
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selectedPromptConfig, setSelectedPromptConfig] = useState<any>(null)
  const [expandedShots, setExpandedShots] = useState<Set<number>>(new Set())
  const [defaultNegativePrompt, setDefaultNegativePrompt] = useState(project.defaultNegativePrompt || '')

  const toggleExpand = (index: number) => {
    setExpandedShots(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleGenerate = async () => {
    if (!activeScript?.content) return
    setGenerating(true)
    try {
      let systemPrompt: string | undefined
      let userPrompt: string | undefined

      if (selectedPromptConfig) {
        systemPrompt = selectedPromptConfig.systemPrompt
        userPrompt = (selectedPromptConfig.userPrompt || DEFAULT_USER_PROMPT_TEMPLATE).replace('{script}', activeScript.content)
      }

      const res = await fetch(`/api/projects/${project.id}/storyboard/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId: activeScriptId,
          scriptContent: activeScript.content,
          systemPrompt,
          userPrompt,
        }),
      })
      const data = await res.json()
      if (data.shots) {
        // AI 返回 snake_case，转换为 camelCase
        const mapped = data.shots.map((s: any) => ({
          order: s.order,
          duration: s.duration,
          cameraShotType: s.camera_shot_type || s.cameraShotType,
          cameraMovement: s.camera_movement || s.cameraMovement,
          sceneSetting: s.scene_setting || s.sceneSetting,
          characterAction: s.character_action || s.characterAction || null,
          visualPrompt: s.visual_prompt || s.visualPrompt,
          negativePrompt: s.negative_prompt || s.negativePrompt || null,
          refCharacterIds: s.ref_character_ids
            ? JSON.stringify(s.ref_character_ids)
            : s.refCharacterIds || null,
          refPropIds: s.ref_prop_ids
            ? JSON.stringify(s.ref_prop_ids)
            : s.refPropIds || null,
          refSceneIds: s.ref_scene_ids
            ? JSON.stringify(s.ref_scene_ids)
            : s.refSceneIds || null,
          audio: s.audio || '',
          dialogue: s.dialogue || '',
        }))
        setShotsMap(prev => ({ ...prev, [activeScriptId]: mapped }))
      }
    } catch (error) {
      console.error('Failed to generate storyboard:', error)
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      // 保存全局负面提示词
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultNegativePrompt }),
      })
      // 保存 shots
      await fetch(`/api/projects/${project.id}/storyboard`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: activeScriptId, shots }),
      })
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateShot = (index: number, field: keyof ShotData, value: string | number | null) => {
    const newShots = [...shots]
    newShots[index] = { ...newShots[index], [field]: value }
    setShotsMap(prev => ({ ...prev, [activeScriptId]: newShots }))
  }

  const addShot = () => {
    const newShots = [...shots, {
      order: shots.length + 1,
      duration: 4,
      cameraShotType: 'medium',
      cameraMovement: 'static',
      sceneSetting: '',
      characterAction: null,
      visualPrompt: '',
      negativePrompt: null,
      refCharacterIds: null,
      refPropIds: null,
      refSceneIds: null,
      audio: '',
      dialogue: '',
    }]
    setShotsMap(prev => ({ ...prev, [activeScriptId]: newShots }))
  }

  const removeShot = (index: number) => {
    const newShots = shots.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }))
    setShotsMap(prev => ({ ...prev, [activeScriptId]: newShots }))
  }

  const toggleCharacterRef = (shotIndex: number, charId: string) => {
    const current = parseRefIds(shots[shotIndex].refCharacterIds)
    const next = current.includes(charId)
      ? current.filter(id => id !== charId)
      : [...current, charId]
    updateShot(shotIndex, 'refCharacterIds', next.length > 0 ? JSON.stringify(next) : null)
  }

  const togglePropRef = (shotIndex: number, propId: string) => {
    const current = parseRefIds(shots[shotIndex].refPropIds)
    const next = current.includes(propId)
      ? current.filter(id => id !== propId)
      : [...current, propId]
    updateShot(shotIndex, 'refPropIds', next.length > 0 ? JSON.stringify(next) : null)
  }

  const toggleSceneRef = (shotIndex: number, sceneId: string) => {
    const current = parseRefIds(shots[shotIndex].refSceneIds)
    const next = current.includes(sceneId)
      ? current.filter(id => id !== sceneId)
      : [...current, sceneId]
    updateShot(shotIndex, 'refSceneIds', next.length > 0 ? JSON.stringify(next) : null)
  }

  const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0)

  if (project.scripts.length === 0) {
    return (
      <Card className="border border-slate-200 dark:border-slate-800">
        <CardContent className="py-16 text-center">
          <Film className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">请先在剧本页面生成剧本</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="design" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
          <TabsTrigger value="design" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 rounded-md">
            <Sparkles className="w-4 h-4 mr-2" />
            分镜编辑
          </TabsTrigger>
          <TabsTrigger value="config" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 rounded-md">
            <Settings className="w-4 h-4 mr-2" />
            配置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="space-y-4 mt-4">
          {/* 剧集选择器 + 操作按钮 */}
          <Card className="border border-slate-200 dark:border-slate-800">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-slate-500" />
                  <CardTitle className="text-lg font-semibold">选择剧集</CardTitle>
                  {shots.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      {totalDuration}s / {shots.length} 镜头
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleGenerate} disabled={generating || !activeScript} size="sm">
                    {generating ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" />生成中...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-1" />生成分镜</>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={addShot}>
                    <Plus className="w-4 h-4 mr-1" />添加镜头
                  </Button>
                  {shots.length > 0 && (
                    <Button onClick={handleSave} disabled={loading} size="sm" variant="outline">
                      {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                      保存
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              <ScrollArea className="w-full">
                <div className="flex gap-2">
                  {project.scripts.sort((a, b) => a.episode - b.episode).map((script) => (
                    <button
                      key={script.id}
                      onClick={() => setActiveScriptId(script.id)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                        activeScriptId === script.id
                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      第 {script.episode} 集
                      {(shotsMap[script.id]?.length || 0) > 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs">{shotsMap[script.id]?.length}</Badge>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* 全局负面提示词 */}
          <Card className="border border-slate-200 dark:border-slate-800">
            <CardContent className="p-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">全局默认 Negative Prompt</label>
                <Input
                  value={defaultNegativePrompt}
                  onChange={(e) => setDefaultNegativePrompt(e.target.value)}
                  placeholder="blurry, low quality, bad anatomy, extra fingers, distorted..."
                  className="text-sm"
                />
                <p className="text-xs text-slate-400">应用于所有镜头，镜头级 negative prompt 会追加合并</p>
              </div>
            </CardContent>
          </Card>

          {/* 分镜列表 */}
          {shots.length === 0 ? (
            <Card className="border border-slate-200 dark:border-slate-800">
              <CardContent className="py-16 text-center">
                <Film className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500 mb-1">还没有分镜</p>
                <p className="text-sm text-slate-400">点击"生成分镜"从剧本自动生成</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {shots.map((shot, index) => {
                const isExpanded = expandedShots.has(index)
                const refCharacterIds = parseRefIds(shot.refCharacterIds)
                const refPropIds = parseRefIds(shot.refPropIds)
                const refSceneIds = parseRefIds(shot.refSceneIds)
                return (
                  <Card key={index} className="border border-slate-200 dark:border-slate-800">
                    <CardHeader className="py-3 px-4 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">{shot.order}</Badge>
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="w-3 h-3 mr-0.5" />{shot.duration}s
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {CAMERA_SHOT_OPTIONS.find(o => o.value === shot.cameraShotType)?.label || shot.cameraShotType}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            <Video className="w-3 h-3 mr-0.5" />
                            {CAMERA_MOVEMENT_OPTIONS.find(o => o.value === shot.cameraMovement)?.label || shot.cameraMovement}
                          </Badge>
                          <span className="text-xs text-slate-400 font-mono">{computeTimeSlot(shots, index)}</span>
                          {refCharacterIds.length > 0 && refCharacterIds.map(id => {
                            const char = project.characters.find(c => c.id === id)
                            return char ? (
                              <Badge key={id} variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                                {char.name}
                              </Badge>
                            ) : null
                          })}
                          {refSceneIds.length > 0 && refSceneIds.map(id => {
                            const scene = project.scenes.find(s => s.id === id)
                            return scene ? (
                              <Badge key={id} variant="outline" className="text-xs bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400">
                                {scene.name}
                              </Badge>
                            ) : null
                          })}
                          {refPropIds.length > 0 && refPropIds.map(id => {
                            const prop = project.props.find(p => p.id === id)
                            return prop ? (
                              <Badge key={id} variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400">
                                {prop.name}
                              </Badge>
                            ) : null
                          })}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => toggleExpand(index)} className="h-8 w-8 p-0">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost" size="sm" onClick={() => removeShot(index)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      {/* 第一行：景别、运镜、时长 */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">景别</label>
                          <Select value={shot.cameraShotType} onValueChange={(v) => updateShot(index, 'cameraShotType', v)}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {CAMERA_SHOT_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">运镜</label>
                          <Select value={shot.cameraMovement} onValueChange={(v) => updateShot(index, 'cameraMovement', v)}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {CAMERA_MOVEMENT_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">时长 (秒)</label>
                          <Input
                            type="number" min={1} max={30}
                            value={shot.duration}
                            onChange={(e) => updateShot(index, 'duration', parseInt(e.target.value) || 4)}
                            className="h-9"
                          />
                        </div>
                      </div>

                      {/* 第二行：场景、角色动作、音频 */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">场景描述</label>
                          <Textarea
                            value={shot.sceneSetting}
                            onChange={(e) => updateShot(index, 'sceneSetting', e.target.value)}
                            placeholder="中文场景描述..."
                            className="min-h-[60px] text-sm resize-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">角色动作</label>
                          <Textarea
                            value={shot.characterAction || ''}
                            onChange={(e) => updateShot(index, 'characterAction', e.target.value || null)}
                            placeholder="中文角色动作描述（可选）..."
                            className="min-h-[60px] text-sm resize-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">对白</label>
                          <Textarea
                            value={shot.dialogue}
                            onChange={(e) => updateShot(index, 'dialogue', e.target.value)}
                            placeholder="角色对白..."
                            className="min-h-[60px] text-sm resize-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">音效</label>
                          <Textarea
                            value={shot.audio}
                            onChange={(e) => updateShot(index, 'audio', e.target.value)}
                            placeholder="音效描述..."
                            className="min-h-[60px] text-sm resize-none"
                          />
                        </div>
                      </div>

                      {/* 引用角色 */}
                      {project.characters.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">引用角色</label>
                          <div className="flex flex-wrap gap-1.5">
                            {project.characters.map(char => (
                              <button
                                key={char.id}
                                onClick={() => toggleCharacterRef(index, char.id)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                  refCharacterIds.includes(char.id)
                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                }`}
                              >
                                {char.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 引用场景 */}
                      {project.scenes.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">引用场景</label>
                          <div className="flex flex-wrap gap-1.5">
                            {project.scenes.map(scene => (
                              <button
                                key={scene.id}
                                onClick={() => toggleSceneRef(index, scene.id)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                  refSceneIds.includes(scene.id)
                                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                }`}
                              >
                                {scene.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 引用道具 */}
                      {project.props.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">引用道具</label>
                          <div className="flex flex-wrap gap-1.5">
                            {project.props.map(prop => (
                              <button
                                key={prop.id}
                                onClick={() => togglePropRef(index, prop.id)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                  refPropIds.includes(prop.id)
                                    ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                }`}
                              >
                                {prop.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 折叠区域：visual_prompt + negative_prompt */}
                      {isExpanded && (
                        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">Visual Prompt (英文，给视频模型)</label>
                            <Textarea
                              value={shot.visualPrompt}
                              onChange={(e) => updateShot(index, 'visualPrompt', e.target.value)}
                              placeholder="English visual prompt: subject + action + environment + lighting + camera..."
                              className="min-h-[80px] text-sm resize-none font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">Negative Prompt (镜头级，可选)</label>
                            <Input
                              value={shot.negativePrompt || ''}
                              onChange={(e) => updateShot(index, 'negativePrompt', e.target.value || null)}
                              placeholder="额外的负面提示词，会与全局默认合并..."
                              className="text-sm font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="config" className="space-y-4 mt-4">
          <PromptConfigPanel
            projectId={project.id}
            type="storyboard"
            defaultSystemPrompt={DEFAULT_SYSTEM_PROMPT}
            defaultUserPrompt={DEFAULT_USER_PROMPT_TEMPLATE}
            onPromptSelect={setSelectedPromptConfig}
            selectedPromptId={selectedPromptConfig?.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
