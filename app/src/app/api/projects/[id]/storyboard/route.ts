import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string }>
}

interface ShotInput {
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

export async function PUT(request: Request, { params }: Props) {
  const { id } = await params
  const body = await request.json()
  const { shots, scriptId } = body

  let targetScriptId = scriptId
  if (!targetScriptId) {
    const script = await prisma.script.findFirst({ where: { projectId: id } })
    if (!script) {
      return NextResponse.json({ error: 'No script' }, { status: 404 })
    }
    targetScriptId = script.id
  }

  await prisma.shot.deleteMany({ where: { scriptId: targetScriptId } })

  const created = await Promise.all(
    shots.map((s: ShotInput) =>
      prisma.shot.create({
        data: {
          scriptId: targetScriptId,
          order: s.order,
          duration: s.duration,
          cameraShotType: s.cameraShotType,
          cameraMovement: s.cameraMovement,
          sceneSetting: s.sceneSetting,
          characterAction: s.characterAction || null,
          visualPrompt: s.visualPrompt,
          negativePrompt: s.negativePrompt || null,
          refCharacterIds: s.refCharacterIds || null,
          refPropIds: s.refPropIds || null,
          audio: s.audio,
        },
      })
    )
  )

  return NextResponse.json({ shots: created })
}
