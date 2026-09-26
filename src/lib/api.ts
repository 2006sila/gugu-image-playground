import { getActiveApiProfile, getCustomProviderDefinition } from './apiProfiles'
import { callFalAiImageApi } from './falAiImageApi'
import { callOpenAICompatibleImageApi } from './openaiCompatibleImageApi'
import { generateFusionImage, type FusionImageModelConfig } from './fusionImageApi'
import type { CallApiOptions, CallApiResult } from './imageApiShared'

export type { CallApiOptions, CallApiResult } from './imageApiShared'
export { normalizeBaseUrl } from './devProxy'

/** 判断是否为融合版多协议图像供应商 */
export function isFusionImageProvider(provider: string): boolean {
  return provider === 'fusion-gemini' || provider === 'fusion-grok'
}

async function callFusionImageApi(opts: CallApiOptions, provider: 'fusion-gemini' | 'fusion-grok'): Promise<CallApiResult> {
  const profile = getActiveApiProfile(opts.settings)
  const model: FusionImageModelConfig = {
    id: profile.id,
    protocol: provider === 'fusion-gemini' ? 'google-gemini' : 'grok',
    name: profile.name,
    modelId: profile.model,
    apiKey: profile.apiKey,
    baseUrl: profile.baseUrl,
    maxRefImages: provider === 'fusion-gemini' ? 3 : 3,
  }
  const result = await generateFusionImage(model, {
    prompt: opts.prompt,
    images: opts.inputImageDataUrls,
    outputSize: (() => {
      const m = /([24])K/.exec(opts.params.size)
      if (m) return `${m[1]}K` as '2K' | '4K'
      const sm = /(\d+)x(\d+)/.exec(opts.params.size)
      if (sm) {
        const px = Number(sm[1]) * Number(sm[2])
        if (px > 4_000_000) return '4K' as const
        if (px > 1_500_000) return '2K' as const
      }
      return undefined
    })(),
    signal: undefined,
  })
  return { images: result.images }
}

export async function callImageApi(opts: CallApiOptions): Promise<CallApiResult> {
  const profile = getActiveApiProfile(opts.settings)
  if (profile.provider === 'fal') return callFalAiImageApi(opts, profile)
  if (isFusionImageProvider(profile.provider)) return callFusionImageApi(opts, profile.provider as 'fusion-gemini' | 'fusion-grok')

  return callOpenAICompatibleImageApi(opts, profile, getCustomProviderDefinition(opts.settings, profile.provider))
}
