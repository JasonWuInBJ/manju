import { prisma } from './db'

// 配置缓存
let configCache: {
  glmApiKey: string | null
  glmApiUrl: string | null
  anthropicApiKey: string | null
  anthropicApiUrl: string | null
  runningHubApiKey: string | null
} | null = null

let configCacheTime = 0
const CACHE_TTL = 60000 // 1分钟缓存

/**
 * 从数据库获取完整配置
 */
export async function getFullConfig() {
  const now = Date.now()
  if (configCache && (now - configCacheTime) < CACHE_TTL) {
    return configCache
  }

  let config = await prisma.globalConfig.findUnique({ where: { id: 'default' } })

  // 首次启动时从环境变量初始化
  if (!config) {
    config = await prisma.globalConfig.create({
      data: {
        id: 'default',
        glmApiKey: process.env.GLM_API_KEY || null,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
        runningHubApiKey: process.env.RUNNINGHUB_API_KEY || null,
      }
    })
  }

  configCache = {
    glmApiKey: config.glmApiKey,
    glmApiUrl: config.glmApiUrl,
    anthropicApiKey: config.anthropicApiKey,
    anthropicApiUrl: config.anthropicApiUrl,
    runningHubApiKey: config.runningHubApiKey,
  }
  configCacheTime = now

  return configCache
}

/**
 * 获取 RunningHub API Key
 */
export async function getRunningHubApiKey(): Promise<string> {
  const config = await getFullConfig()
  if (!config.runningHubApiKey) {
    throw new Error('RunningHub API Key 未配置，请前往 /settings 配置')
  }
  return config.runningHubApiKey
}

/**
 * 清除配置缓存（配置更新后调用）
 */
export function clearConfigCache() {
  configCache = null
}
