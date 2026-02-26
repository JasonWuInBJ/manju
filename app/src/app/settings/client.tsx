'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Eye, EyeOff, Check, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface Config {
  id: string
  glmApiKey: string | null
  glmApiUrl: string | null
  anthropicApiKey: string | null
  anthropicApiUrl: string | null
  runningHubApiKey: string | null
  hasGlmKey: boolean
  hasAnthropicKey: boolean
  hasRunningHubKey: boolean
}

export function SettingsPageClient() {
  const [config, setConfig] = useState<Config | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Visibility state
  const [showGlmKey, setShowGlmKey] = useState(false)
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [showRunningHubKey, setShowRunningHubKey] = useState(false)

  // Form state - store actual values for editing
  const [glmApiKey, setGlmApiKey] = useState('')
  const [glmApiUrl, setGlmApiUrl] = useState('')
  const [anthropicApiKey, setAnthropicApiKey] = useState('')
  const [anthropicApiUrl, setAnthropicApiUrl] = useState('')
  const [runningHubApiKey, setRunningHubApiKey] = useState('')

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      setConfig(data)
      // Set URLs
      setGlmApiUrl(data.glmApiUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions')
      setAnthropicApiUrl(data.anthropicApiUrl || 'https://api.anthropic.com')
      // Set masked keys as initial display (user can edit to change)
      setGlmApiKey(data.glmApiKey || '')
      setAnthropicApiKey(data.anthropicApiKey || '')
      setRunningHubApiKey(data.runningHubApiKey || '')
    } catch (error) {
      console.error('Failed to load config', error)
      toast.error('加载配置失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updateData: Record<string, string> = {}

      // Only send API key if user entered something new (not the masked value)
      if (glmApiKey && !glmApiKey.includes('****')) {
        updateData.glmApiKey = glmApiKey
      }
      if (anthropicApiKey && !anthropicApiKey.includes('****')) {
        updateData.anthropicApiKey = anthropicApiKey
      }
      if (runningHubApiKey && !runningHubApiKey.includes('****')) {
        updateData.runningHubApiKey = runningHubApiKey
      }

      // Always send URLs if changed
      if (glmApiUrl) {
        updateData.glmApiUrl = glmApiUrl
      }
      if (anthropicApiUrl) {
        updateData.anthropicApiUrl = anthropicApiUrl
      }

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const data = await res.json()
      setConfig(data)
      // Update form with new masked values
      setGlmApiKey(data.glmApiKey || '')
      setAnthropicApiKey(data.anthropicApiKey || '')
      setRunningHubApiKey(data.runningHubApiKey || '')
      toast.success('配置已保存')
    } catch (error) {
      console.error('Failed to save config', error)
      toast.error('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">全局设置</h1>
      </div>

      {/* GLM Config */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>智谱 AI 配置</CardTitle>
            {config?.hasGlmKey ? (
              <span className="flex items-center text-sm text-green-600">
                <Check className="w-4 h-4 mr-1" />
                已配置
              </span>
            ) : (
              <span className="flex items-center text-sm text-yellow-600">
                <AlertCircle className="w-4 h-4 mr-1" />
                未配置
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showGlmKey ? 'text' : 'password'}
                placeholder="输入新的 API Key"
                value={glmApiKey}
                onChange={e => setGlmApiKey(e.target.value)}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowGlmKey(!showGlmKey)}
              >
                {showGlmKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {config?.hasGlmKey ? '已保存 API Key（如需更新请输入新值）' : '请输入 API Key'}
            </p>
          </div>
          <div className="space-y-2">
            <Label>API 端点</Label>
            <Input
              value={glmApiUrl}
              onChange={e => setGlmApiUrl(e.target.value)}
              placeholder="https://open.bigmodel.cn/api/paas/v4/chat/completions"
            />
          </div>
        </CardContent>
      </Card>

      {/* Anthropic Config */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Anthropic 配置</CardTitle>
            {config?.hasAnthropicKey ? (
              <span className="flex items-center text-sm text-green-600">
                <Check className="w-4 h-4 mr-1" />
                已配置
              </span>
            ) : (
              <span className="flex items-center text-sm text-yellow-600">
                <AlertCircle className="w-4 h-4 mr-1" />
                未配置
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showAnthropicKey ? 'text' : 'password'}
                placeholder="输入新的 API Key"
                value={anthropicApiKey}
                onChange={e => setAnthropicApiKey(e.target.value)}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowAnthropicKey(!showAnthropicKey)}
              >
                {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {config?.hasAnthropicKey ? '已保存 API Key（如需更新请输入新值）' : '请输入 API Key'}
            </p>
          </div>
          <div className="space-y-2">
            <Label>API 端点</Label>
            <Input
              value={anthropicApiUrl}
              onChange={e => setAnthropicApiUrl(e.target.value)}
              placeholder="https://api.anthropic.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* RunningHub Config */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>RunningHub 配置</CardTitle>
            <span className="text-xs text-muted-foreground">生图、生视频</span>
            {config?.hasRunningHubKey ? (
              <span className="flex items-center text-sm text-green-600">
                <Check className="w-4 h-4 mr-1" />
                已配置
              </span>
            ) : (
              <span className="flex items-center text-sm text-yellow-600">
                <AlertCircle className="w-4 h-4 mr-1" />
                未配置
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showRunningHubKey ? 'text' : 'password'}
                placeholder="输入新的 API Key"
                value={runningHubApiKey}
                onChange={e => setRunningHubApiKey(e.target.value)}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowRunningHubKey(!showRunningHubKey)}
              >
                {showRunningHubKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {config?.hasRunningHubKey ? '已保存 API Key（如需更新请输入新值）' : '请输入 API Key'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        保存配置
      </Button>
    </div>
  )
}
