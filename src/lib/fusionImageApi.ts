/**
 * 多协议图像生成客户端（融合版）
 * 在 PG 的 OpenAI Images/Responses 之外，新增 Gemini 与 Grok 协议的浏览器直连实现。
 * 移植自 nova-image-studio backend/server.js 的 generateNovaGeminiImage / createGrokImageRequestInit。
 */

export type FusionImageProtocol = 'openai' | 'google-gemini' | 'grok'

export interface FusionImageModelConfig {
  id: string
  protocol: FusionImageProtocol
  name: string
  modelId: string
  apiKey: string
  baseUrl: string
  maxRefImages: number
}

export interface FusionImageRequest {
  prompt: string
  images?: string[] // data URLs
  aspectRatio?: string // '1:1' | '16:9' | '9:16' | '4:3' | '3:4' ...
  outputSize?: '1K' | '2K' | '4K'
  signal?: AbortSignal
  onPartialImage?: (b64: string) => void
}

export interface FusionImageResult {
  images: string[] // data URLs
}

const GEMINI_ASPECT_RATIOS = new Set(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'])
const GEMINI_IMAGE_SIZES = new Set(['1K', '2K', '4K'])
const GEMINI_MAX_REF = 3

function normalizeBase(baseUrl: string): string {
  let trimmed = String(baseUrl || '').trim().replace(/\/+$/, '')
  trimmed = trimmed.replace(/\/v\d+$/i, '')
  return trimmed
}

// ===== Gemini 协议 =====

export async function generateGeminiImage(
  model: FusionImageModelConfig,
  request: FusionImageRequest,
): Promise<FusionImageResult> {
  const base = normalizeBase(model.baseUrl)
  const images = (request.images || []).slice(0, Math.min(model.maxRefImages || GEMINI_MAX_REF, GEMINI_MAX_REF))

  const parts: Array<Record<string, unknown>> = [{ text: request.prompt }]
  for (const dataUrl of images) {
    const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/i.exec(dataUrl)
    if (match) {
      parts.push({ inlineData: { data: match[2], mimeType: match[1] || 'image/png' } })
    } else {
      parts.push({ inlineData: { data: dataUrl, mimeType: 'image/png' } })
    }
  }

  const imageSize = request.outputSize && GEMINI_IMAGE_SIZES.has(request.outputSize) ? request.outputSize : '1K'
  const aspectRatio = request.aspectRatio && GEMINI_ASPECT_RATIOS.has(request.aspectRatio) ? request.aspectRatio : '1:1'

  const response = await fetch(`${base}/v1beta/models/${encodeURIComponent(model.modelId)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': model.apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { imageSize, aspectRatio },
      },
    }),
    signal: request.signal,
  })

  if (!response.ok) {
    let detail = ''
    try { detail = await response.text() } catch { /* ignore */ }
    let msg = `Gemini API 请求失败: ${response.status}`
    if (detail) {
      try {
        const parsed = JSON.parse(detail) as { error?: { message?: string } }
        if (parsed.error?.message) msg += ` ${parsed.error.message}`
      } catch {
        if (detail.length < 200) msg += ` ${detail}`
      }
    }
    throw new Error(msg)
  }

  const data = await response.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } }> }
    }>
  }

  const resultImages: string[] = []
  for (const candidate of data.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      const inline = part.inlineData || (part.inline_data ? { data: part.inline_data.data, mimeType: part.inline_data.mime_type } : undefined)
      if (inline?.data) {
        const mime = inline.mimeType || 'image/png'
        resultImages.push(`data:${mime};base64,${inline.data}`)
      }
    }
  }

  if (resultImages.length === 0) {
    throw new Error('Gemini 响应中没有图片数据（可能被安全策略拦截）')
  }
  return { images: resultImages }
}

// ===== Grok 协议 =====

function toGrokDataUrl(dataUrl: string): string {
  return dataUrl.startsWith('data:') ? dataUrl : `data:image/png;base64,${dataUrl}`
}

export async function generateGrokImage(
  model: FusionImageModelConfig,
  request: FusionImageRequest,
): Promise<FusionImageResult> {
  const base = normalizeBase(model.baseUrl)
  const isEdit = (request.images || []).length > 0
  const endpoint = isEdit ? '/v1/images/edits' : '/v1/images/generations'

  const payload: Record<string, unknown> = {
    model: model.modelId,
    prompt: request.prompt,
    response_format: 'url',
    ...(request.aspectRatio && request.aspectRatio !== 'auto' ? { aspect_ratio: request.aspectRatio } : {}),
    ...(request.outputSize === '2K' || request.outputSize === '4K' ? { resolution: request.outputSize.toLowerCase() } : {}),
  }

  if (isEdit) {
    const dataUrls = (request.images || []).slice(0, Math.min(model.maxRefImages || 3, 3)).map(toGrokDataUrl)
    if (dataUrls.length === 0) throw new Error('Grok 图生图需要至少一张参考图')
    payload.images = dataUrls.map(url => ({ type: 'image_url', url }))
  }

  const response = await fetch(`${base}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: request.signal,
  })

  if (!response.ok) {
    let detail = ''
    try { detail = await response.text() } catch { /* ignore */ }
    let msg = `Grok API 请求失败: ${response.status}`
    if (detail) {
      try {
        const parsed = JSON.parse(detail) as { error?: { message?: string } }
        if (parsed.error?.message) msg += ` ${parsed.error.message}`
      } catch {
        if (detail.length < 200) msg += ` ${detail}`
      }
    }
    throw new Error(msg)
  }

  const data = await response.json() as {
    data?: Array<{ b64_json?: string; url?: string }>
  }

  const resultImages: string[] = []
  for (const item of data.data || []) {
    if (item.b64_json) {
      resultImages.push(`data:image/png;base64,${item.b64_json}`)
    } else if (item.url) {
      resultImages.push(item.url) // URL 形态，交给上层下载或直接展示
    }
  }

  if (resultImages.length === 0) throw new Error('Grok 响应中没有图片数据')
  return { images: resultImages }
}

// ===== 统一入口 =====

export async function generateFusionImage(
  model: FusionImageModelConfig,
  request: FusionImageRequest,
): Promise<FusionImageResult> {
  if (model.protocol === 'google-gemini') return generateGeminiImage(model, request)
  if (model.protocol === 'grok') return generateGrokImage(model, request)
  // openai 协议交回 PG 原有链路处理（调用方负责路由），此处兜底报错
  throw new Error('openai 协议请使用 PG 原生链路（openaiCompatibleImageApi）')
}
