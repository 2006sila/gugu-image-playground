/**
 * 图片素材库元数据（融合版）
 * 参考 nova-image-studio 的"我的素材"：收藏的图片素材集合。
 * 图片本体复用 PG 的 IndexedDB images store（按 imageId 引用，自动去重+缩略图），
 * 这里只存素材的元数据（名称、标签、备注、引用的 imageId、来源）。
 */

const STORAGE_KEY = 'fusion-image-assets'

export interface ImageAsset {
  id: string
  /** 素材名称（默认取文件名/任务提示词截断） */
  name: string
  /** 引用 PG 图片存储的 imageId */
  imageId: string
  /** 标签 */
  tags: string[]
  /** 备注 */
  note?: string
  /** 来源描述：如 "图生图历史结果"、"上传" */
  source?: string
  /** 文件大小（字节，用于展示） */
  bytes?: number
  createdAt: number
}

export function loadImageAssets(): ImageAsset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(list: ImageAsset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function addImageAsset(input: {
  imageId: string
  name?: string
  tags?: string[]
  note?: string
  source?: string
  bytes?: number
}): ImageAsset {
  const list = loadImageAssets()
  // 去重：同一 imageId 只收录一次
  const existing = list.find((a) => a.imageId === input.imageId)
  if (existing) return existing
  const asset: ImageAsset = {
    id: `ia-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    imageId: input.imageId,
    name: input.name || `素材 ${list.length + 1}`,
    tags: input.tags || [],
    note: input.note,
    source: input.source,
    bytes: input.bytes,
    createdAt: Date.now(),
  }
  list.unshift(asset)
  persist(list)
  return asset
}

export function updateImageAsset(id: string, patch: Partial<Pick<ImageAsset, 'name' | 'tags' | 'note'>>): void {
  const list = loadImageAssets()
  const idx = list.findIndex((a) => a.id === id)
  if (idx < 0) return
  list[idx] = { ...list[idx], ...patch }
  persist(list)
}

export function deleteImageAsset(id: string): void {
  persist(loadImageAssets().filter((a) => a.id !== id))
}

export type AssetSortMode = 'createdAt' | 'name' | 'bytes'

export function sortAssets(assets: ImageAsset[], mode: AssetSortMode): ImageAsset[] {
  const list = [...assets]
  if (mode === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  else if (mode === 'bytes') list.sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0))
  else list.sort((a, b) => b.createdAt - a.createdAt)
  return list
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(2)} MB`
}
