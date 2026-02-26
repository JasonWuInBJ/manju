'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Settings, Check, AlertCircle } from 'lucide-react'

interface ModelOption {
  id: string
  name: string
  description: string
  icon: string
  tier: 'standard' | 'fast'
  provider: 'anthropic' | 'zhipu'
}

interface Props {
  selectedModel: string
  onModelChange: (model: string) => void
  title?: string
  description?: string
  configStatus?: {
    hasGlmKey: boolean
    hasAnthropicKey: boolean
  }
}

const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'glm-5',
    name: 'GLM-5',
    description: '智谱 AI 最新模型，深度思考',
    icon: '🧠',
    tier: 'standard',
    provider: 'zhipu',
  },
  {
    id: 'glm-4.7',
    name: 'GLM-4.7',
    description: '智谱 AI 高性能模型，支持深度思考',
    icon: '🎯',
    tier: 'standard',
    provider: 'zhipu',
  },
  {
    id: 'glm-4-flash',
    name: 'GLM-4-Flash',
    description: '智谱 AI 快速模型，响应迅速',
    icon: '🚀',
    tier: 'fast',
    provider: 'zhipu',
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'Anthropic 均衡模型',
    icon: '⚖️',
    tier: 'standard',
    provider: 'anthropic',
  },
  {
    id: 'claude-sonnet-4-5-20250929-thinking',
    name: 'Claude Sonnet 4.5 (Thinking)',
    description: 'Anthropic 均衡模型，支持深度思考',
    icon: '🔮',
    tier: 'standard',
    provider: 'anthropic',
  },
]

const TIER_STYLES = {
  standard: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30',
  fast: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30',
}

const TIER_BADGE = {
  standard: { label: '均衡', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  fast: { label: '快速', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
}

export function ModelSelector({ selectedModel, onModelChange, title, description, configStatus }: Props) {
  const isProviderConfigured = (provider: 'anthropic' | 'zhipu') => {
    if (!configStatus) return true // Assume configured if no status provided
    return provider === 'zhipu' ? configStatus.hasGlmKey : configStatus.hasAnthropicKey
  }

  return (
    <Card className="border border-slate-200 dark:border-slate-800">
      <CardHeader className="border-b border-slate-200 dark:border-slate-800 py-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-500" />
          <div>
            <CardTitle className="text-lg font-semibold">{title || '模型设置'}</CardTitle>
            {description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {AVAILABLE_MODELS.map((model) => {
            const isSelected = selectedModel === model.id
            const isConfigured = isProviderConfigured(model.provider)

            return (
              <button
                key={model.id}
                onClick={() => isConfigured && onModelChange(model.id)}
                disabled={!isConfigured}
                className={`
                  relative p-4 rounded-lg border text-left transition-all
                  ${isSelected && isConfigured
                    ? `${TIER_STYLES[model.tier]} border-2 shadow-sm`
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950'
                  }
                  ${!isConfigured ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-2xl">{model.icon}</span>
                  <div className="flex items-center gap-1">
                    {!isConfigured && (
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    )}
                    {isSelected && isConfigured && (
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="font-medium text-slate-900 dark:text-white mb-1">
                  {model.name}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  {model.description}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={`text-xs ${TIER_BADGE[model.tier].className}`}>
                    {TIER_BADGE[model.tier].label}
                  </Badge>
                  {!isConfigured && (
                    <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700">
                      未配置
                    </Badge>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {configStatus && (!configStatus.hasGlmKey || !configStatus.hasAnthropicKey) && (
          <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-4">
            部分模型未配置 API Key，请前往 <a href="/settings" className="underline">设置页面</a> 配置
          </p>
        )}
      </CardContent>
    </Card>
  )
}
