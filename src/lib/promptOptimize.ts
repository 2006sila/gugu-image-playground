/**
 * 提示词优化客户端（融合版）
 * 移植自 nova-image-studio prompt-optimize-client 的系统提示词，
 * 用融合版 textClient 直连任意协议文本模型。
 */

import { callTextModel } from './textClient'
import type { TextModelConfig } from './textModels'

export type OptimizeMode = 'text-to-image' | 'image-to-image'

const SYSTEM_PROMPTS: Record<OptimizeMode, string> = {
  'text-to-image': `你是一位专业的 AI 绘图提示词优化专家。
你的任务是将用户的简短描述优化为高质量的文生图提示词。
优化规则：
- 保留用户的原始意图和核心描述
- 补充画面主体的细节（外观、材质、姿态等）
- 补充环境、光影、构图、氛围、艺术风格等维度
- 输出一段连贯自然的中文提示词，不要分点列表
- 不要添加任何解释、前言或结语，直接输出优化后的提示词
- 如果用户的要求过于模糊，做合理化补充而不是反问`,
  'image-to-image': `你是一位专业的 AI 绘图提示词优化专家。
你的任务是优化「基于参考图修改/生成」的提示词。
优化规则：
- 保留用户对参考图的修改意图，明确写出要改什么、保持什么
- 提示词中必须强调与参考图保持一致的部分（主体特征、服装款式、构图等）
- 修改点要具体、可执行，避免模糊表述
- 用「图1」「图2」指代参考图
- 输出一段连贯自然的中文提示词，不要分点列表
- 不要添加任何解释、前言或结语，直接输出优化后的提示词`,
}

export interface OptimizeInput {
  textModel: TextModelConfig
  mode: OptimizeMode
  prompt: string
  signal?: AbortSignal
  onDelta?: (token: string) => void
}

export async function optimizePrompt(input: OptimizeInput): Promise<string> {
  const result = await callTextModel({
    protocol: input.textModel.protocol,
    baseUrl: input.textModel.baseUrl,
    apiKey: input.textModel.apiKey,
    model: input.textModel.modelId,
    parts: [{ type: 'text', text: input.prompt }],
    systemInstruction: SYSTEM_PROMPTS[input.mode],
    stream: true,
    signal: input.signal,
    onDelta: input.onDelta,
  })
  return result.text.trim()
}
