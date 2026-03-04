interface Character {
  name: string
  description?: string
}

interface Scene {
  name: string
  description: string
}

interface Prop {
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
  props?: Prop[]
  script?: Script
  style?: string
}): string {
  const { characters, scenes, props = [], script, style = 'cel-shaded anime style' } = params

  // Build character list with names and descriptions
  const characterInfo = characters.map(c => {
    if (c.description) {
      return `${c.name} (${c.description})`
    }
    return c.name
  }).join(', ')

  // Build scene descriptions
  const sceneDesc = scenes.map(s => `${s.name}: ${s.description}`).join('; ')

  // Build prop descriptions
  const propInfo = props.length > 0
    ? props.map(p => `${p.name} (${p.description})`).join(', ')
    : ''

  // Get script content (first 300 characters for context)
  const scriptContent = script?.content
    ? script.content.substring(0, 300) + (script.content.length > 300 ? '...' : '')
    : ''

  // Generate prompt with script and storyboard context
  let prompt = `A single composite image featuring the following characters: ${characterInfo}

Scene: ${sceneDesc}`

  if (propInfo) {
    prompt += `

Props: ${propInfo}`
  }

  if (scriptContent) {
    prompt += `

Script context: ${scriptContent}`
  }

  prompt += `

Visual requirements:
- Create a 3x3 grid layout (9 panels) showing key animation frames in sequence, like a professional storyboard keyframe sheet
- Each panel captures a distinct moment or pose, with smooth narrative progression from panel 1 to panel 9
- CONSISTENCY (critical): character faces, hairstyles, clothing, body proportions, and color palette must remain identical across all 9 panels
- CONSISTENCY (critical): lighting direction, scene atmosphere, color grading, and background elements must stay uniform throughout
- Each panel should have clean borders and equal sizing within the grid
- Visual style: ${style}, applied consistently across all panels
- Cinematic framing: vary shot types naturally (wide, medium, close-up) to create visual rhythm
- High quality, sharp details, 4K resolution, professional illustration quality
- Characters fully integrated into the scene with accurate perspective and lighting interaction
- Rich color, high contrast, visually striking composition that works as a cohesive whole`

  return prompt
}
