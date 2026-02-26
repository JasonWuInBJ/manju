export const DEFAULT_IMAGE_SYSTEM_PROMPT = `You are a professional storyboard and composite image prompt generator. Your task is to create detailed prompts for generating a 2x3 grid of 6 storyboard panels.

Focus on:
- Creating 6 distinct sequential panels that tell a story
- Each panel should have clear composition and framing
- Maintain consistent character appearance across all panels
- Use cinematic camera angles and perspectives
- Include dynamic poses and expressions
- Ensure visual continuity between panels

Generate prompts that are clear, specific, and optimized for AI image generation.`

export const DEFAULT_IMAGE_USER_PROMPT = `Create a 2x3 grid storyboard (6 panels) based on the following:

Characters: {characters}

Scene: {scenes}

Script context: {script}

Requirements:
- Generate a single image containing 6 panels arranged in a 2x3 grid (2 columns, 3 rows)
- Each panel should represent a key moment from the script
- Maintain consistent character designs across all panels
- Use cel-shaded anime style
- High quality, 4K resolution
- Clear panel borders/separators
- Dynamic camera angles and compositions
- Expressive character poses and emotions

The 6 panels should flow as a visual narrative, capturing the key beats of the story.`
