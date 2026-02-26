interface Character {
  id: string
  name: string
  description: string
}

interface Prop {
  id: string
  name: string
  description: string
}

interface Shot {
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
  audio: string
}

/**
 * 为单个 shot 组装最终的视频模型 prompt
 * 自动注入引用角色和道具的描述到 visualPrompt 前面
 */
export function assembleShotPrompt(shot: Shot, characters: Character[], props: Prop[] = []): string {
  let finalPrompt = ''

  // 注入引用角色的描述
  if (shot.refCharacterIds) {
    const refIds: string[] = JSON.parse(shot.refCharacterIds)
    for (const id of refIds) {
      const char = characters.find(c => c.id === id)
      if (char) {
        finalPrompt += `[Character: ${char.name}] ${char.description}. `
      }
    }
  }

  // 注入引用道具的描述
  if (shot.refPropIds) {
    const refIds: string[] = JSON.parse(shot.refPropIds)
    for (const id of refIds) {
      const prop = props.find(p => p.id === id)
      if (prop) {
        finalPrompt += `[Prop: ${prop.name}] ${prop.description}. `
      }
    }
  }

  finalPrompt += shot.visualPrompt
  return finalPrompt
}

/**
 * 合并全局默认负面提示词和镜头级负面提示词
 */
export function assembleNegativePrompt(
  defaultNegativePrompt: string | null | undefined,
  shotNegativePrompt: string | null | undefined
): string {
  return [defaultNegativePrompt, shotNegativePrompt].filter(Boolean).join(', ')
}

/**
 * 为整个视频生成综合 prompt（兼容旧的调用方式）
 */
export function generateVideoPrompt(params: {
  scriptContent: string
  characters?: Character[]
  props?: Prop[]
  shots?: Shot[]
  defaultNegativePrompt?: string | null
}): string {
  const { scriptContent, characters = [], props = [], shots = [], defaultNegativePrompt } = params

  if (shots.length === 0) {
    return scriptContent.substring(0, 200)
  }

  const shotPrompts = shots.map(shot => {
    const prompt = assembleShotPrompt(shot, characters, props)
    const negative = assembleNegativePrompt(defaultNegativePrompt, shot.negativePrompt)
    return `Shot ${shot.order} (${shot.duration}s) [${shot.cameraShotType}, ${shot.cameraMovement}]: ${prompt}${negative ? ` | Negative: ${negative}` : ''}`
  })

  return shotPrompts.join('\n\n')
}

