import Anthropic from '@anthropic-ai/sdk'
import { getFullConfig, clearConfigCache as clearCache } from './config'

// 重新导出 clearConfigCache
export const clearConfigCache = clearCache

// 精简后的可用模型列表
export const AVAILABLE_MODELS = [
  {
    id: 'glm-5',
    name: 'GLM-5',
    description: '智谱 AI 最新模型，深度思考',
    thinking: true,
    provider: 'zhipu',
  },
  {
    id: 'glm-4.7',
    name: 'GLM-4.7',
    description: '智谱 AI 高性能模型，支持深度思考',
    thinking: true,
    provider: 'zhipu',
  },
  {
    id: 'glm-4-flash',
    name: 'GLM-4-Flash',
    description: '智谱 AI 快速模型，响应迅速',
    thinking: false,
    provider: 'zhipu',
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'Anthropic 均衡模型',
    thinking: false,
    provider: 'anthropic',
  },
  {
    id: 'claude-sonnet-4-5-20250929-thinking',
    name: 'Claude Sonnet 4.5 (Thinking)',
    description: 'Anthropic 均衡模型，支持深度思考',
    thinking: true,
    provider: 'anthropic',
  },
]

// 默认模型
export const MODEL = 'glm-5'

/**
 * 带重试机制的 AI 调用包装函数
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    backoffFactor?: number
    onRetry?: (error: Error, attempt: number) => void
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    onRetry,
  } = options

  let lastError: Error
  let delay = initialDelay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      const errorMessage = lastError.message || ''
      const isRetryable =
        errorMessage.includes('524') ||
        errorMessage.includes('502') ||
        errorMessage.includes('503') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ECONNRESET')

      if (!isRetryable || attempt === maxRetries) {
        throw lastError
      }

      if (onRetry) {
        onRetry(lastError, attempt + 1)
      }

      await new Promise(resolve => setTimeout(resolve, delay))
      delay = Math.min(delay * backoffFactor, maxDelay)
    }
  }

  throw lastError!
}

/**
 * 过滤 AI 响应中的 <thinking> 标签内容
 */
export function stripThinkingTags(text: string): string {
  return text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim()
}

/**
 * 统一的 LLM 调用接口
 */
export async function callLLM(params: {
  model: string
  systemPrompt: string
  userPrompt: string
  maxTokens?: number
}): Promise<string> {
  const { model, systemPrompt, userPrompt, maxTokens = 4096 } = params

  if (model.startsWith('glm-')) {
    return callZhipuAI({ model, systemPrompt, userPrompt, maxTokens })
  }

  return callAnthropic({ model, systemPrompt, userPrompt, maxTokens })
}

/**
 * 调用 Anthropic Claude API
 */
async function callAnthropic(params: {
  model: string
  systemPrompt: string
  userPrompt: string
  maxTokens: number
}): Promise<string> {
  const { model, systemPrompt, userPrompt, maxTokens } = params
  const config = await getFullConfig()

  if (!config.anthropicApiKey) {
    throw new Error('Anthropic API Key 未配置，请前往 /settings 配置')
  }

  const client = new Anthropic({
    apiKey: config.anthropicApiKey,
    baseURL: config.anthropicApiUrl || 'https://api.anthropic.com',
    timeout: 180000,
    maxRetries: 2,
  })

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  })

  const textContent = response.content.find((block) => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in response')
  }

  return textContent.text
}

/**
 * 调用智谱 AI GLM API
 */
async function callZhipuAI(params: {
  model: string
  systemPrompt: string
  userPrompt: string
  maxTokens: number
}): Promise<string> {
  const config = await getFullConfig()

  if (!config.glmApiKey) {
    throw new Error('智谱 AI API Key 未配置，请前往 /settings 配置')
  }

  const apiUrl = config.glmApiUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
  const isGLM47 = params.model === 'glm-4.7'

  const requestBody: Record<string, unknown> = {
    model: params.model,
    messages: [
      {
        role: 'system',
        content: params.systemPrompt,
      },
      {
        role: 'user',
        content: params.userPrompt,
      },
    ],
    max_tokens: params.maxTokens,
    temperature: 0.7,
  }

  if (isGLM47) {
    requestBody.thinking = { type: 'enabled' }
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.glmApiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GLM API error: ${error}`)
  }

  const data = await response.json()

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response from GLM API')
  }

  return data.choices[0].message.content
}
