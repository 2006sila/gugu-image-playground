/**
 * 反推提示词客户端（融合版）
 * 用多协议 textClient 直连，替代 nova 的后端代理方案。
 */

import { callTextModel } from './textClient'
import { REVERSE_PROMPT_TEMPLATES, type ReversePromptMode } from './reverseTemplates'
import type { TextModelConfig } from './textModels'

export interface StreamReverseInput {
  model: TextModelConfig
  mode: ReversePromptMode
  imageDataUrl: string
  mimeType?: string
}

export interface StreamReverseCallbacks {
  onDelta: (token: string) => void
  onDone: (fullText: string) => void
  onError: (err: Error) => void
}

export interface StreamReverseHandle {
  abort: () => void
  promise: Promise<void>
}

export function streamReversePrompt(
  input: StreamReverseInput,
  callbacks: StreamReverseCallbacks,
): StreamReverseHandle {
  const controller = new AbortController()

  const promise = (async () => {
    try {
      const result = await callTextModel({
        protocol: input.model.protocol,
        baseUrl: input.model.baseUrl,
        apiKey: input.model.apiKey,
        model: input.model.modelId,
        parts: [
          { type: 'text', text: REVERSE_PROMPT_TEMPLATES[input.mode] },
          { type: 'image', imageDataUrl: input.imageDataUrl, mimeType: input.mimeType || 'image/png' },
        ],
        stream: true,
        reasoningEffort: 'high',
        signal: controller.signal,
        onDelta: callbacks.onDelta,
      })
      callbacks.onDone(result.text)
    } catch (err) {
      if (controller.signal.aborted) return
      callbacks.onError(err instanceof Error ? err : new Error(String(err)))
    }
  })()

  return {
    abort: () => controller.abort(),
    promise,
  }
}
