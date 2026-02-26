interface Character {
  name: string
  description?: string
}

interface Scene {
  name: string
  description: string
}

interface Script {
  content: string
}

/**
 * Generate prompt for composite image (single image blending characters and scenes)
 * This is different from storyboard which creates a 3x3 grid
 */
export function generateCompositeImagePrompt(params: {
  characters: Character[]
  scenes: Scene[]
  script?: Script
  style?: string
}): string {
  const { characters, scenes, script, style = 'cel-shaded anime style' } = params

  // Build character list with names and descriptions
  const characterInfo = characters.map(c => {
    if (c.description) {
      return `${c.name} (${c.description})`
    }
    return c.name
  }).join(', ')

  // Build scene descriptions
  const sceneDesc = scenes.map(s => `${s.name}: ${s.description}`).join('; ')

  // Get script content (first 300 characters for context)
  const scriptContent = script?.content
    ? script.content.substring(0, 300) + (script.content.length > 300 ? '...' : '')
    : ''

  // Generate prompt with script and storyboard context
  let prompt = `A single composite image featuring the following characters: ${characterInfo}

Scene: ${sceneDesc}`

  if (scriptContent) {
    prompt += `

Script context: ${scriptContent}`
  }

  prompt += `

Visual requirements:
- Blend the characters and scene naturally together
- Visual style: ${style}
- High quality, cinematic composition, 4K resolution
- The characters should be seamlessly integrated into the scene environment
- Maintain consistent character appearance and scene atmosphere`

  return prompt
}
