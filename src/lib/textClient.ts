/**
 * 多协议文本调用客户端（融合版，浏览器直连）
 * 移植自 nova-image-studio 的 nova-proxy-text + 各 client，改为前端直连上游。
 * CORS 受限的上游可通过同源代理（/api-proxy/）转发。
 */

import { normalizeBaseUrl } from './devProxy'
import { parseServerSentEventBlock } from './serverSentEvents'
import type { TextProviderProtocol } from './textModels'

export type TextContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; imageDataUrl: string; mimeType?: string }

export interface TextCallOptions {
  protocol: TextProviderProtocol
  baseUrl: string
  apiKey: string
  model: string
  parts: TextContentPart[]
  systemInstruction?: string
  stream?: boolean
  reasoningEffort?: 'low' | 'medium' | 'high'
  maxTokens?: number
  signal?: AbortSignal
  onDelta?: (token: string) => void
  /** 启用模型原生联网搜索（Anthropic web_search / Gemini google_search / Responses web_search） */
  nativeWebSearch?: boolean
}

export function parseDataUrl(dataUrl: string, fallbackMimeType = 'image/png'): { base64: string; mimeType: string } {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/i.exec(dataUrl)
  if (!match) return { mimeType: fallbackMimeType, base64: dataUrl }
  return { mimeType: match[1] || fallbackMimeType, base64: match[2] }
}

function buildResponsesInputContent(parts: TextContentPart[]) {
  return parts.map(part => (
    part.type === 'text'
      ? { type: 'input_text', text: part.text }
      : { type: 'input_image', image_url: part.imageDataUrl }
  ))
}

function buildChatCompletionsContent(parts: TextContentPart[]) {
  return parts.map(part => (
    part.type === 'text'
      ? { type: 'text', text: part.text }
      : { type: 'image_url', image_url: { url: part.imageDataUrl } }
  ))
}

function buildAnthropicContent(parts: TextContentPart[]) {
  return parts.map(part => {
    if (part.type === 'text') return { type: 'text', text: part.text }
    const parsed = parseDataUrl(part.imageDataUrl, part.mimeType || 'image/png')
    return {
      type: 'image',
      source: { type: 'base64', media_type: parsed.mimeType, data: parsed.base64 },
    }
  })
}

function buildGeminiParts(parts: TextContentPart[]) {
  return parts.map(part => {
    if (part.type === 'text') return { text: part.text }
    const parsed = parseDataUrl(part.imageDataUrl, part.mimeType || 'image/png')
    return { inline_data: { mime_type: parsed.mimeType, data: parsed.base64 } }
  })
}

export function buildTextRequestBody(
  protocol: TextProviderProtocol,
  model: string,
  parts: TextContentPart[],
  options: { stream?: boolean; systemInstruction?: string; reasoningEffort?: 'low' | 'medium' | 'high'; maxTokens?: number } = {},
): Record<string, unknown> {
  const { stream = false, systemInstruction, reasoningEffort, maxTokens } = options

  if (protocol === 'openai-chat-completions') {
    return {
      model,
      ...(stream ? { stream: true } : {}),
      messages: [
        ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
        { role: 'user', content: buildChatCompletionsContent(parts) },
      ],
    }
  }

  if (protocol === 'anthropic-messages') {
    return {
      model,
      ...(stream ? { stream: true } : {}),
      max_tokens: maxTokens || 4096,
      ...(systemInstruction ? { system: systemInstruction } : {}),
      messages: [{ role: 'user', content: buildAnthropicContent(parts) }],
    }
  }

  if (protocol === 'google-gemini') {
    const textPrefix = systemInstruction ? `${systemInstruction}\n\n---\n\n` : ''
    return {
      contents: [
        {
          role: 'user',
          parts: buildGeminiParts([
            ...(textPrefix ? [{ type: 'text' as const, text: textPrefix }] : []),
            ...parts,
          ]),
        },
      ],
      ...(reasoningEffort ? { generationConfig: { thinkingConfig: { thinkingBudget: reasoningEffort === 'high' ? -1 : reasoningEffort === 'medium' ? 4096 : 1024, includeThoughts: false } } } : {}),
    }
  }

  // openai-responses
  return {
    model,
    ...(stream ? { stream: true } : {}),
    ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
    ...(systemInstruction ? { instructions: systemInstruction } : {}),
    input: [{ role: 'user', content: buildResponsesInputContent(parts) }],
  }
}

function buildEndpoint(protocol: TextProviderProtocol, baseUrl: string, model: string, stream: boolean): { url: string; headers: Record<string, string> } {
  const base = normalizeBaseUrl(baseUrl)
  if (protocol === 'google-gemini') {
    return {
      url: stream
        ? `${base}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`
        : `${base}/models/${encodeURIComponent(model)}:generateContent`,
      headers: { 'x-goog-api-key': '' }, // key 在调用处填
    }
  }
  if (protocol === 'anthropic-messages') {
    return {
      url: `${base}/messages`,
      headers: { 'x-api-key': '', 'anthropic-version': '2023-06-01' },
    }
  }
  if (protocol === 'openai-chat-completions') {
    return { url: `${base}/chat/completions`, headers: {} }
  }
  return { url: `${base}/responses`, headers: {} }
}

function extractTextFromPayload(protocol: TextProviderProtocol, payload: Record<string, unknown>): string {
  if (protocol === 'openai-chat-completions') {
    const record = payload as {
      choices?: Array<{ delta?: { content?: string | Array<{ type?: string; text?: string }> }; message?: { content?: string | Array<{ type?: string; text?: string }> } }>
    }
    const content = record.choices?.[0]?.delta?.content ?? record.choices?.[0]?.message?.content
    if (typeof content === 'string') return content
    if (!Array.isArray(content)) return ''
    return content.filter(part => part.type === 'text' && typeof part.text === 'string').map(part => part.text).join('')
  }

  if (protocol === 'anthropic-messages') {
    const record = payload as { type?: string; delta?: { text?: string }; content_block?: { type?: string; text?: string } }
    if (record.type === 'content_block_delta' && record.delta?.text) return record.delta.text
    if (record.type === 'content_block_start' && record.content_block?.type === 'text') return record.content_block.text || ''
    return ''
  }

  if (protocol === 'google-gemini') {
    const record = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    return (record.candidates || [])
      .flatMap(candidate => candidate.content?.parts || [])
      .map(part => part.text || '')
      .join('')
  }

  // responses SSE
  const record = payload as {
    type?: string
    delta?: string
    response?: { output_text?: string }
    item?: { content?: Array<{ type?: string; text?: string }> }
  }
  if (record.type === 'response.output_text.delta' && typeof record.delta === 'string') return record.delta
  if (record.type === 'response.completed' && record.response?.output_text) return record.response.output_text
  if (record.type === 'response.output_item.done' && Array.isArray(record.item?.content)) {
    return (record.item?.content || [])
      .filter(part => part.type === 'output_text' && typeof part.text === 'string')
      .map(part => part.text)
      .join('')
  }
  return ''
}

function extractError(payload: Record<string, unknown>): string | null {
  const record = payload as { error?: { message?: string } | string; message?: string }
  if (record.error) {
    if (typeof record.error === 'string') return record.error
    if (typeof record.error?.message === 'string') return record.error.message
  }
  if (typeof record.message === 'string') return record.message
  return null
}

export interface TextCallResult {
  text: string
}

/** 统一入口：按协议直连上游，流式或非流式 */
export async function callTextModel(opts: TextCallOptions): Promise<TextCallResult> {
  const { protocol, baseUrl, apiKey, model, parts, systemInstruction, stream = false, reasoningEffort, maxTokens, signal, onDelta, nativeWebSearch } = opts
  const { url, headers } = buildEndpoint(protocol, baseUrl, model, stream)
  const body = buildTextRequestBody(protocol, model, parts, { stream, systemInstruction, reasoningEffort, maxTokens })
  if (nativeWebSearch) {
    if (protocol === 'anthropic-messages') {
      (body as any).tools = [...((body as any).tools || []), { type: 'web_search_20250305', name: 'web_search', max_uses: 5 }]
    } else if (protocol === 'google-gemini') {
      ;(body as any).tools = [...((body as any).tools || []), { google_search: {} }]
    } else if (protocol === 'openai-responses') {
      ;(body as any).tools = [...((body as any).tools || []), { type: 'web_search' }]
    }
  }

  const authHeaders: Record<string, string> = { ...headers }
  if (protocol === 'google-gemini') authHeaders['x-goog-api-key'] = apiKey
  else if (protocol === 'anthropic-messages') authHeaders['x-api-key'] = apiKey
  else authHeaders['Authorization'] = `Bearer ${apiKey}`
  if (stream) authHeaders['Accept'] = 'text/event-stream'

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    let detail = ''
    try { detail = await response.text() } catch { /* ignore */ }
    let msg = `${response.status} ${response.statusText}`
    if (detail) {
      try {
        const err = extractError(JSON.parse(detail))
        if (err) msg = `${response.status}: ${err}`
      } catch {
        if (detail.length < 300) msg = `${response.status}: ${detail}`
      }
    }
    throw new Error(msg)
  }

  if (!stream) {
    const data = await response.json()
    if (protocol === 'openai-chat-completions' || protocol === 'openai-responses') {
      // 非流式也复用 extract 逻辑
      const text = extractNonStreamText(protocol, data)
      return { text }
    }
    return { text: extractNonStreamText(protocol, data) }
  }

  // SSE 流式
  if (!response.body) throw new Error('响应没有可读流')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let accumulated = ''

  const handlePayload = (payloadText: string) => {
    if (payloadText === '[DONE]') return
    let payload: Record<string, unknown>
    try { payload = JSON.parse(payloadText) } catch { return }
    const err = extractError(payload)
    if (err) throw new Error(err)
    const delta = extractTextFromPayload(protocol, payload)
    if (delta) {
      accumulated += delta
      onDelta?.(delta)
    }
  }

  try {
    while (true) {
      if (signal?.aborted) break
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // 按 SSE 块切分（双换行分隔）
      let idx: number
      while ((idx = buffer.indexOf('\n\n')) >= 0 || (idx = buffer.indexOf('\r\n\r\n')) >= 0) {
        const block = buffer.slice(0, idx)
        buffer = buffer.slice(idx + (buffer.startsWith('\r\n', idx) ? 4 : 2))
        const data = parseServerSentEventBlock(block)
        if (data) handlePayload(data)
      }
    }
  } finally {
    reader.releaseLock?.()
  }
  // 处理残余
  const rest = parseServerSentEventBlock(buffer)
  if (rest) handlePayload(rest)

  return { text: accumulated }
}

function extractNonStreamText(protocol: TextProviderProtocol, data: Record<string, unknown>): string {
  if (protocol === 'openai-chat-completions') {
    const record = data as { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }> }
    const content = record.choices?.[0]?.message?.content
    if (typeof content === 'string') return content
    if (!Array.isArray(content)) return ''
    return content.filter(part => part.type === 'text' && typeof part.text === 'string').map(part => part.text).join('')
  }
  if (protocol === 'anthropic-messages') {
    const record = data as { content?: Array<{ type?: string; text?: string }> }
    return (record.content || []).filter(part => part.type === 'text' && typeof part.text === 'string').map(part => part.text).join('')
  }
  if (protocol === 'google-gemini') {
    const record = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    return (record.candidates || []).flatMap(c => c.content?.parts || []).map(p => p.text || '').join('')
  }
  const record = data as { output_text?: unknown; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }
  if (typeof record.output_text === 'string') return record.output_text
  return (record.output || []).flatMap(item => item.content || []).filter(part => part.type === 'output_text' && typeof part.text === 'string').map(part => part.text).join('')
}
