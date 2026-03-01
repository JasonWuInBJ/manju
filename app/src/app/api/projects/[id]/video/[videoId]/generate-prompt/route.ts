import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateVideoPrompt } from '@/lib/video-prompt-generator'
import { callLLM, MODEL } from '@/lib/ai'

interface Props {
  params: Promise<{ id: string; videoId: string }>
}

export async function POST(request: Request, { params }: Props) {
  const { id, videoId } = await params
  const body = await request.json()
  const { scriptId, systemPrompt, userPrompt } = body

  console.log('[Generate Prompt] Generating video prompt', { videoId, scriptId, hasCustomPrompts: !!(systemPrompt && userPrompt) })

  try {
    // If custom prompts provided, use them directly with AI
    if (systemPrompt && userPrompt) {
      console.log('[Generate Prompt] Using custom prompts')

      const generatedPrompt = await callLLM({
        model: MODEL,
        systemPrompt,
        userPrompt,
        maxTokens: 1024,
      })

      console.log('[Generate Prompt] Generated prompt with custom config:', generatedPrompt.substring(0, 200))

      return NextResponse.json({
        prompt: generatedPrompt,
        scriptContent: userPrompt,
      })
    }

    // Otherwise, use default generation logic
    console.log('[Generate Prompt] Using default generation logic')

    const script = await prisma.script.findUnique({
      where: { id: scriptId, projectId: id },
    })

    if (!script) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 })
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
    })

    // Fetch project for defaultNegativePrompt
    const project = await prisma.project.findUnique({
      where: { id },
      select: { defaultNegativePrompt: true },
    })

    let characters: { id: string; name: string; description: string }[] = []

    if (video?.selectedCharacterIds) {
      const characterIds = JSON.parse(video.selectedCharacterIds)
      characters = await prisma.character.findMany({
        where: { id: { in: characterIds }, projectId: id },
        select: { id: true, name: true, description: true },
      })
    }

    // Fetch shots for this script
    const shots = await prisma.shot.findMany({
      where: { scriptId },
      orderBy: { order: 'asc' },
      select: {
        order: true,
        duration: true,
        cameraShotType: true,
        cameraMovement: true,
        sceneSetting: true,
        characterAction: true,
        visualPrompt: true,
        negativePrompt: true,
        refCharacterIds: true,
        refPropIds: true,
        audio: true,
      },
    })

    // Fetch props for this project
    const props = await prisma.prop.findMany({
      where: { projectId: id },
      select: { id: true, name: true, description: true },
    })

    const prompt = generateVideoPrompt({
      scriptContent: script.content,
      characters,
      props,
      shots,
      defaultNegativePrompt: project?.defaultNegativePrompt,
    })

    console.log('[Generate Prompt] Generated prompt:', prompt)

    return NextResponse.json({
      prompt,
      scriptContent: script.content,
    })
  } catch (error) {
    console.error('[Generate Prompt] Error', error)
    return NextResponse.json(
      { error: 'Failed to generate prompt' },
      { status: 500 }
    )
  }
}
