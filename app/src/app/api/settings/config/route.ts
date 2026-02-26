import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Internal API to get actual API keys (unmasked)
// This is used by the AI module, not exposed to frontend
export async function GET() {
  try {
    let config = await prisma.globalConfig.findUnique({ where: { id: 'default' } })

    // Initialize from environment if not exists
    if (!config) {
      config = await prisma.globalConfig.create({
        data: {
          id: 'default',
          glmApiKey: process.env.GLM_API_KEY || null,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
        }
      })
    }

    return NextResponse.json({
      glmApiKey: config.glmApiKey,
      glmApiUrl: config.glmApiUrl,
      anthropicApiKey: config.anthropicApiKey,
      anthropicApiUrl: config.anthropicApiUrl,
    })
  } catch (error) {
    console.error('[Config GET] Error', error)
    return NextResponse.json({ error: 'Failed to get config' }, { status: 500 })
  }
}
