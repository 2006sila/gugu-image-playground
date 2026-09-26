/**
 * 提案式 Agent 调用器（融合版）
 * 思路来自 nova-image-studio 的 propose_image_action 模式：
 * 用任意协议的文本模型分析用户意图，输出结构化提案 JSON（含改图/生图动作、
 * 提示词、引用图片、理由），交由用户确认后走图像链路出图。
 * 不依赖 Responses API / function calling —— 各协议统一用「输出 JSON」约定解析。
 */
import { callTextModel } from './textClient'
import type { TextModelConfig } from './textModels'
import { loadTextModels, loadTextDefaults, resolveTextModel } from './textModels'
import { describeImage } from './imageDescribe'
export type AgentProposalAction = 'generate' | 'edit'
export interface AgentTextProposal {
  action: AgentProposalAction
  /** 面向图像模型的完整提示词（用 图1/图2 指代参考图） */
  prompt: string
  /** 引用的参考图序号（1-based，对应输入图片顺序） */
  referencedImageIndexes: number[]
  /** 一句话向用户说明判断 */
  reason: string
  /** 建议比例，可空 */
  aspectRatio?: string
}
const AGENT_PROPOSAL_SYSTEM = `你是一个图像生成与编辑助手。你帮助用户澄清想要的画面，并在用户想「生成新图」或「修改已有图片」时输出一份生图提案。
## 输出格式（严格遵守）
你必须只输出一个 JSON 对象，不要输出任何其他文字、不要用代码块包裹：
{
  "action": "generate" | "edit",
  "prompt": "面向图像模型的完整中文提示词",
  "referenced_image_indexes": [1],
  "reason": "一句话向用户说明你的判断",
  "aspect_ratio": "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "2:3" | null
}
## 判断规则
- 用户想从零画一张新图 → action="generate"，referenced_image_indexes 通常为空。
- 用户想基于已有图片修改/延续（如"把这张图的发卡改了""保持这个人换背景"）→ action="edit"，referenced_image_indexes 填要参考的图片序号（第1张图=1）。
- 用户同时在聊天/提问、未明确要出图 → 仍然按意图输出提案；如果用户的话完全是闲聊且与图像无关，prompt 里也要给出一个最贴近的图像化建议。
## prompt 撰写规则
- prompt 是给图像模型看的完整提示词，聚焦画面效果与修改意图，中文。
- 用「图1」「图2」指代 referenced_image_indexes 中对应位置的参考图（第1个=图1）。
- 禁止描述参考图的具体内容（如"一只橘猫"），因为图像模型能看到图本身；只写要做什么。
- 一致性优先：action="edit" 时，prompt 必须明确要求与参考图保持一致——主体的造型、比例、颜色、材质、服装款式、面部特征完全保持原样，只按用户意图调整指定部分，禁止重新设计人物或新增原图中没有的元素。
- 一次只做用户要求的修改，不要擅自增加额外的改动。`
interface BuildAgentInputOptions {
  prompt: string
  /** 图片目录描述（每张图的 id + 描述） */
  imageCatalog?: string
  /** 对话历史（简易拼接） */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}
export function buildAgentProposalParts(opts: BuildAgentInputOptions) {
  const { prompt, imageCatalog, history } = opts
  const textParts: string[] = []
  if (history?.length) {
    textParts.push('## 最近对话')
    for (const msg of history.slice(-6)) {
      textParts.push(`${msg.role === 'user' ? '用户' : '助手'}：${msg.content.slice(0, 300)}`)
    }
  }
  if (imageCatalog) {
    textParts.push(`## 当前图片目录\n${imageCatalog}`)
  }
  textParts.push(`## 用户消息\n${prompt}`)
  textParts.push('请输出提案 JSON。')
  return textParts
}
function extractJson(text: string): Record<string, unknown> | null {
  // 去掉可能的 markdown 代码块包裹
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    return typeof parsed === 'object' && parsed ? parsed : null
  } catch {
    // 尝试从第一个 { 到最后一个 } 截取
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1))
        return typeof parsed === 'object' && parsed ? parsed : null
      } catch { return null }
    }
    return null
  }
}
export function parseAgentProposal(text: string): AgentTextProposal {
  const json = extractJson(text)
  if (!json) throw new Error('模型未返回有效的提案 JSON，原始输出：' + text.slice(0, 200))
  const action = json.action === 'edit' ? 'edit' : 'generate'
  const prompt = typeof json.prompt === 'string' && json.prompt.trim() ? json.prompt.trim() : (() => {
    throw new Error('提案缺少 prompt 字段')
  })()
  const rawIndexes = Array.isArray(json.referenced_image_indexes) ? json.referenced_image_indexes : []
  const referencedImageIndexes = rawIndexes
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 1)
  const reason = typeof json.reason === 'string' ? json.reason : ''
  const aspectRatio = typeof json.aspect_ratio === 'string' && json.aspect_ratio !== 'null' ? json.aspect_ratio : undefined
  return { action, prompt, referencedImageIndexes, reason, aspectRatio }
}
export async function requestAgentProposal(opts: {
  textModel: TextModelConfig
  prompt: string
  /** 输入图片的 data URL 列表（顺序即 图1、图2…） */
  imageDataUrls: string[]
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  /** 是否启用模型原生联网搜索（Anthropic web_search / Gemini google_search / Responses web_search） */
  enableWebSearch?: boolean
  signal?: AbortSignal
  onDelta?: (token: string) => void
}): Promise<AgentTextProposal> {
  const { textModel, prompt, imageDataUrls, history, enableWebSearch, signal, onDelta } = opts
  const catalogLines = imageDataUrls.map((_, idx) => `- 图${idx + 1}（已上传）`).join('\n')
  // 提案模式：为参考图生成视觉描述，帮助文本模型理解每张图内容
  const describeModel = resolveTextModel(loadTextModels(), loadTextDefaults(), 'imageDescribe') ?? textModel
  const catalogWithDescriptions: string[] = await Promise.all(
    imageDataUrls.map(async (dataUrl, i) => {
      try {
        const desc = await describeImage({ textModel: describeModel, imageDataUrl: dataUrl, signal })
        return desc ? `- 图${i + 1}：${desc}` : `- 图${i + 1}（描述生成失败）`
      } catch {
        return `- 图${i + 1}（描述生成失败）`
      }
    }),
  )
  const finalCatalog = catalogWithDescriptions.length ? catalogWithDescriptions.join('\n') : catalogLines

  const textParts = buildAgentProposalParts({ prompt, imageCatalog: finalCatalog || undefined, history })
  const parts = [
    { type: 'text' as const, text: textParts.join('\n\n') },
    ...imageDataUrls.map(dataUrl => ({ type: 'image' as const, imageDataUrl: dataUrl })),
  ]
  const result = await callTextModel({
    protocol: textModel.protocol,
    baseUrl: textModel.baseUrl,
    apiKey: textModel.apiKey,
    model: textModel.modelId,
    parts,
    systemInstruction: AGENT_PROPOSAL_SYSTEM,
    stream: true,
    signal,
    onDelta,
    nativeWebSearch: enableWebSearch,
  })
  return parseAgentProposal(result.text)
}
