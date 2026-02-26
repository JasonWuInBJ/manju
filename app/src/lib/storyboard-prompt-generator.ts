interface Character {
  name: string
  description?: string
}

interface Scene {
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
  audio: string
}

/**
 * 生成 3x3 分镜网格图的 prompt
 * 基于新的 Shot V2 结构
 */
export function generateStoryboardPrompt(params: {
  characters: Character[]
  scenes: Scene[]
  shots?: Shot[]
  style?: string
}): string {
  const { characters, scenes, shots = [], style = 'cel-shaded anime style' } = params

  const characterInfo = characters.map(c =>
    `${c.name}${c.description ? ` (${c.description})` : ''}`
  ).join(', ')

  const sceneDesc = scenes.map(s => s.description).join('; ')

  // 如果有 shots，直接用 shot 数据生成 storyboard prompt
  if (shots.length > 0) {
    const shotDescriptions = shots.slice(0, 9).map(s =>
      `${s.order}. [${s.cameraShotType}, ${s.cameraMovement}] ${s.visualPrompt}`
    ).join(';\n')

    return `3x3 Grid storyboard, visual style: ${style}, 4K resolution:

Characters: ${characterInfo}
Scene: ${sceneDesc}

Storyboard shots:
${shotDescriptions}

Maintain consistent character & scene style across all panels.`
  }

  // fallback: 没有 shots 时用默认布局
  const char1 = characters[0]?.name || 'Character A'
  const char2 = characters[1]?.name || 'Character B'

  return `3x3 Grid storyboard, visual style: ${style}, 4K resolution:

Characters: ${characterInfo}
Scene: ${sceneDesc}

Storyboard shots:
1. Master Shot (wide angle) - show full scene & character positions;
2. Two-Shot - balanced medium shot of key characters;
3. Over-the-shoulder Shot (${char1}) - focus on ${char2};
4. Plot Twist - core conflict trigger;
5. Medium Close-up (${char1}) - emotional detail;
6. Medium Close-up (${char2}) - symmetric composition;
7. Close-up (facial expression/prop);
8. Climax - action/emotion peak;
9. Insert Shot - hint at next development.

Maintain consistent character & scene style across all panels.`
}
