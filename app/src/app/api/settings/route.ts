import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { clearConfigCache } from '@/lib/config'

// Mask API key for display (show first 4 and last 4 characters)
function maskApiKey(key: string | null): string | null {
  if (!key || key.length < 12) return key ? '****' : null
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}

// Initialize config from environment variables if not exists
async function initializeConfig() {
  const existing = await prisma.globalConfig.findUnique({ where: { id: 'default' } })
  if (existing) return existing

  return prisma.globalConfig.create({
    data: {
      id: 'default',
      glmApiKey: process.env.GLM_API_KEY || null,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
      runningHubApiKey: process.env.RUNNINGHUB_API_KEY || null,
    }
  })
}

// GET - Get current config (masked)
export async function GET() {
  try {
    const config = await initializeConfig()

    return NextResponse.json({
      id: config.id,
      glmApiKey: maskApiKey(config.glmApiKey),
      glmApiUrl: config.glmApiUrl,
      anthropicApiKey: maskApiKey(config.anthropicApiKey),
      anthropicApiUrl: config.anthropicApiUrl,
      runningHubApiKey: maskApiKey(config.runningHubApiKey),
      // Flags for UI to know if configured
      hasGlmKey: !!config.glmApiKey,
      hasAnthropicKey: !!config.anthropicApiKey,
      hasRunningHubKey: !!config.runningHubApiKey,
    })
  } catch (error) {
    console.error('[Settings GET] Error', error)
    return NextResponse.json({ error: 'Failed to get config' }, { status: 500 })
  }
}

// PATCH - Update config
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const updateData: Record<string, string | null | undefined> = {}

    // Only update fields that are provided
    if (body.glmApiKey !== undefined) {
      updateData.glmApiKey = body.glmApiKey || null
    }
    if (body.glmApiUrl !== undefined) {
      updateData.glmApiUrl = body.glmApiUrl || null
    }
    if (body.anthropicApiKey !== undefined) {
      updateData.anthropicApiKey = body.anthropicApiKey || null
    }
    if (body.anthropicApiUrl !== undefined) {
      updateData.anthropicApiUrl = body.anthropicApiUrl || null
    }
    if (body.runningHubApiKey !== undefined) {
      updateData.runningHubApiKey = body.runningHubApiKey || null
    }

    // Upsert config
    const config = await prisma.globalConfig.upsert({
      where: { id: 'default' },
      update: updateData,
      create: {
        id: 'default',
        ...updateData,
      }
    })

    // Clear AI config cache
    clearConfigCache()

    return NextResponse.json({
      id: config.id,
      glmApiKey: maskApiKey(config.glmApiKey),
      glmApiUrl: config.glmApiUrl,
      anthropicApiKey: maskApiKey(config.anthropicApiKey),
      anthropicApiUrl: config.anthropicApiUrl,
      runningHubApiKey: maskApiKey(config.runningHubApiKey),
      hasGlmKey: !!config.glmApiKey,
      hasAnthropicKey: !!config.anthropicApiKey,
      hasRunningHubKey: !!config.runningHubApiKey,
    })
  } catch (error) {
    console.error('[Settings PATCH] Error', error)
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
  }
}
