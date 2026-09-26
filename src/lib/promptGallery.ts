/**
 * 提示词广场数据（融合版）
 * 内置来源：awesome-gpt-image-2 案例库（freestylefly/awesome-gpt-image-2, 33504★）
 * 数据打包进 bundle，离线可用。来源仓库见页脚"提示词来源"。
 */

export interface GalleryPrompt {
  id: string
  category: string
  title: string
  content: string
  tags: string[]
  /** 图生图 / 文生图 */
  type?: string
  /** 原始作者 */
  sourceLabel?: string
  /** 原始来源链接 */
  sourceUrl?: string
  /** 预览图（相对路径，源自上游仓库） */
  preview?: string
  /** 是否用户自定义 */
  custom?: boolean
}

import awesomeRaw from './promptsAwesome.json'

interface AwesomeCase {
  id: string
  category: string
  title: string
  content: string
  tags: string[]
  type?: string
  sourceLabel?: string
  sourceUrl?: string
  preview?: string
}

export const GALLERY_CATEGORIES = [
  '全部',
  'UI 与界面',
  '图表与信息可视化',
  '海报与排版',
  '商品与电商',
  '品牌与标志',
  '建筑与空间',
  '摄影与写实',
  '插画与艺术',
  '人物与角色',
  '场景与叙事',
  '历史与古风题材',
  '文档与出版物',
  '其他应用场景',
] as const

export const BUILTIN_GALLERY_PROMPTS: GalleryPrompt[] = (awesomeRaw as AwesomeCase[]).map((c) => ({
  id: c.id,
  category: c.category,
  title: c.title,
  content: c.content,
  tags: c.tags.filter(Boolean),
  type: c.type,
  sourceLabel: c.sourceLabel,
  sourceUrl: c.sourceUrl,
  preview: c.preview,
}))

export const GALLERY_SOURCES = [
  { name: 'freestylefly/awesome-gpt-image-2', url: 'https://github.com/freestylefly/awesome-gpt-image-2' },
  { name: 'ZeroLu/awesome-gpt-image', url: 'https://github.com/ZeroLu/awesome-gpt-image' },
  { name: 'YouMind-OpenLab/awesome-nano-banana-pro-prompts', url: 'https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts' },
  { name: 'ImgEdify/Awesome-GPT4o-Image-Prompts', url: 'https://github.com/ImgEdify/Awesome-GPT4o-Image-Prompts' },
  { name: 'unknowlei/nanobanana-website（大香蕉收纳盒）', url: 'https://nanobanana-website.vercel.app/' },
]

const CUSTOM_KEY = 'fusion-gallery-custom'

export function loadCustomGalleryPrompts(): GalleryPrompt[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((p) => ({ ...p, custom: true })) : []
  } catch {
    return []
  }
}

export function saveCustomGalleryPrompt(prompt: Omit<GalleryPrompt, 'id'>): GalleryPrompt {
  const list = loadCustomGalleryPrompts()
  const full: GalleryPrompt = { ...prompt, id: `gp-custom-${Date.now()}`, custom: true }
  list.unshift(full)
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list))
  return full
}

export function deleteCustomGalleryPrompt(id: string): void {
  const list = loadCustomGalleryPrompts().filter((p) => p.id !== id)
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list))
}
