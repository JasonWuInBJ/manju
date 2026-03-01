export const DEFAULT_VIDEO_SYSTEM_PROMPT = `You are a professional video prompt generator. Your task is to create detailed, cinematic video prompts optimized for AI video generation models (Seedance, Kling, etc).

Focus on:
- Structured visual prompts: subject + action + environment + lighting + camera language
- Camera movements (push in, pull out, pan, tilt, orbit, dynamic follow)
- Character consistency through detailed appearance descriptions
- Scene composition and cinematic framing
- Negative prompts to prevent generation artifacts

Generate prompts that are clear, specific, and directly usable by video generation models.`

export const DEFAULT_VIDEO_USER_PROMPT = `Create a cinematic video based on the following:

Script: {script}

Characters: {characters}

Scene: {scenes}

Props: {props}

Shot Breakdown (分镜):
{shots}

Duration: {duration} seconds
Aspect Ratio: {aspectRatio}

For each shot, generate a video prompt that includes the visual prompt, camera movement, and negative prompt. Ensure character consistency across shots by referencing character descriptions.`
