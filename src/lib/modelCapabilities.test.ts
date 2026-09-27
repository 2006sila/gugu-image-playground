import { describe, expect, it } from 'vitest'
import type { ApiProfile, AppSettings } from '../types'
import { DEFAULT_SETTINGS } from './apiProfiles'
import {
  diagnoseAgentConfiguration,
  diagnoseImageProfile,
  diagnoseTextModel,
} from './modelCapabilities'
import type { TextModelConfig } from './textModels'

function imageProfile(patch: Partial<ApiProfile> = {}): ApiProfile {
  return {
    id: 'image-1',
    name: 'Image',
    provider: 'openai',
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'key',
    model: 'gpt-image-1',
    timeout: 600,
    apiMode: 'images',
    codexCli: false,
    apiProxy: false,
    transparentBackgroundMethod: 'api',
    ...patch,
  }
}

function textModel(patch: Partial<TextModelConfig> = {}): TextModelConfig {
  return {
    id: 'text-1',
    name: 'Text',
    protocol: 'openai-chat-completions',
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'key',
    modelId: 'gpt-4.1-mini',
    ...patch,
  }
}

function settings(profiles: ApiProfile[], patch: Partial<AppSettings> = {}): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    profiles,
    activeProfileId: profiles[0]?.id || DEFAULT_SETTINGS.activeProfileId,
    ...patch,
  }
}

describe('model capability diagnostics', () => {
  it('reports missing fields for an incomplete image profile', () => {
    const result = diagnoseImageProfile(imageProfile({ apiKey: '' }))
    expect(result.level).toBe('error')
    expect(result.summary).toContain('缺少 API Key')
  })

  it('explains Images API Agent compatibility', () => {
    const result = diagnoseImageProfile(imageProfile())
    expect(result.level).toBe('ready')
    expect(result.checks.some((check) => check.detail.includes('混合模式或提案模式'))).toBe(true)
  })

  it('reports incomplete text model configuration', () => {
    const result = diagnoseTextModel(textModel({ baseUrl: '', modelId: '' }))
    expect(result.level).toBe('error')
    expect(result.summary).toContain('模型 ID')
    expect(result.summary).toContain('Base URL')
  })

  it('treats an empty text model display name as informational', () => {
    const result = diagnoseTextModel(textModel({ name: '' }))
    expect(result.level).toBe('ready')
    expect(result.checks.some((check) => check.label === '显示名称' && check.state === 'info')).toBe(true)
  })

  it('rejects Images API when Agent follows the active config', () => {
    const profile = imageProfile()
    const result = diagnoseAgentConfiguration(settings([profile], { agentApiConfigMode: 'off' }), [], {})
    expect(result.level).toBe('error')
    expect(result.summary).toContain('Responses')
  })

  it('marks proposal mode ready when text and image configs are valid', () => {
    const profile = imageProfile()
    const result = diagnoseAgentConfiguration(
      settings([profile], { agentApiConfigMode: 'proposal', agentImageProfileId: profile.id }),
      [textModel()],
      { agent: 'text-1' },
    )
    expect(result.level).toBe('ready')
    expect(result.title).toBe('提案模式已就绪')
  })

  it('warns that native tool availability needs a real request', () => {
    const profile = imageProfile({ apiMode: 'responses', model: 'gpt-5', imageGenerationModel: 'gpt-image-1' })
    const result = diagnoseAgentConfiguration(
      settings([profile], { agentApiConfigMode: 'native', agentTextProfileId: profile.id }),
      [],
      {},
    )
    expect(result.level).toBe('warning')
    expect(result.summary).toContain('实际请求确认')
  })
})
