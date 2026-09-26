/**
 * 文本模型注册与存储（融合版）
 * 移植自 nova-image-studio 的文本模型管理，适配 PG 的 zustand store 风格。
 * 支持四种协议：openai-responses / openai-chat-completions / anthropic-messages / google-gemini
 */

export type TextProviderProtocol =
  | 'openai-responses'
  | 'openai-chat-completions'
  | 'anthropic-messages'
  | 'google-gemini'

export const TEXT_PROTOCOLS: { value: TextProviderProtocol; label: string; hint: string }[] = [
  { value: 'openai-responses', label: 'OpenAI Responses', hint: 'gpt-5.x 等新一代接口 /v1/responses' },
  { value: 'openai-chat-completions', label: 'OpenAI Chat', hint: '通用 /v1/chat/completions，绝大多数中转支持' },
  { value: 'anthropic-messages', label: 'Anthropic Messages', hint: 'Claude /v1/messages' },
  { value: 'google-gemini', label: 'Google Gemini', hint: 'Gemini generateContent' },
]

export interface TextModelConfig {
  id: string
  protocol: TextProviderProtocol
  name: string
  modelId: string
  apiKey: string
  baseUrl: string
  note?: string
}

/** 各文本任务的默认模型 key */
export type TextTaskKey = 'reversePrompt' | 'agent' | 'promptOptimize' | 'imageDescribe'

export const TEXT_TASK_KEYS: TextTaskKey[] = ['reversePrompt', 'agent', 'promptOptimize', 'imageDescribe']

export const TEXT_TASK_LABELS: Record<TextTaskKey, string> = {
  reversePrompt: '反推提示词',
  agent: 'Agent 对话',
  promptOptimize: '提示词优化',
  imageDescribe: '图片描述',
}

const STORAGE_KEY = 'fusion-text-models'
const DEFAULTS_KEY = 'fusion-text-defaults'

export function loadTextModels(): TextModelConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(m => m && typeof m.id === 'string' && typeof m.apiKey === 'string')
  } catch {
    return []
  }
}

export function saveTextModels(models: TextModelConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(models))
}

export type TextDefaults = Partial<Record<TextTaskKey, string>>

export function loadTextDefaults(): TextDefaults {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

export function saveTextDefaults(defaults: TextDefaults): void {
  localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults))
}

export function getTextModelById(models: TextModelConfig[], id: string | undefined | null): TextModelConfig | undefined {
  if (!id) return undefined
  return models.find(m => m.id === id)
}

/** 取某个任务的默认文本模型；未设置时回退到第一个可用模型 */
export function resolveTextModel(
  models: TextModelConfig[],
  defaults: TextDefaults,
  task: TextTaskKey,
): TextModelConfig | undefined {
  const byDefault = getTextModelById(models, defaults[task])
  if (byDefault?.apiKey) return byDefault
  return models.find(m => m.apiKey)
}

export function isTextProviderProtocol(value: unknown): value is TextProviderProtocol {
  return typeof value === 'string' && TEXT_PROTOCOLS.some(p => p.value === value)
}
