/**
 * 图片描述服务（融合版）
 * 移植自 nova-image-studio 的 imageDescribe 任务 + AGENT_IMAGE_DESCRIBE_PROMPT。
 * 用任意协议文本模型生成图片的一句话描述，供提案 Agent、素材库、画布引用。
 */

import { callTextModel } from './textClient'
import type { TextModelConfig } from './textModels'

export const IMAGE_DESCRIBE_PROMPT = `用一到两句简体中文描述这张图片，覆盖主体、风格、主要颜色和关键元素，便于后续判断是否复用它作为参考图。只输出描述本身，不要任何前缀、解释或标点装饰。`

export interface DescribeImageInput {
  textModel: TextModelConfig
  imageDataUrl: string
  signal?: AbortSignal
}

/** 生成图片的简短中文描述 */
export async function describeImage(input: DescribeImageInput): Promise<string> {
  const result = await callTextModel({
    protocol: input.textModel.protocol,
    baseUrl: input.textModel.baseUrl,
    apiKey: input.textModel.apiKey,
    model: input.textModel.modelId,
    parts: [
      { type: 'text', text: IMAGE_DESCRIBE_PROMPT },
      { type: 'image', imageDataUrl: input.imageDataUrl },
    ],
    stream: false,
    maxTokens: 200,
    signal: input.signal,
  })
  return result.text.trim()
}
