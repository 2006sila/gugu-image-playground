/**
 * 我的素材库（融合版）
 * 移植自 nova-image-studio 的素材库概念：提示词素材的存取。
 * localStorage 持久化，轻量实现。
 */

const STORAGE_KEY = 'fusion-prompt-assets'

export interface PromptAsset {
  id: string
  name: string
  content: string
  createdAt: number
  updatedAt: number
}

export function loadAssets(): PromptAsset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveAsset(name: string, content: string, id?: string): PromptAsset {
  const list = loadAssets()
  const now = Date.now()
  if (id) {
    const idx = list.findIndex((a) => a.id === id)
    if (idx >= 0) {
      list[idx] = { ...list[idx], name, content, updatedAt: now }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
      return list[idx]
    }
  }
  const asset: PromptAsset = {
    id: `pa-${now}-${Math.random().toString(36).slice(2, 7)}`,
    name: name || content.slice(0, 20),
    content,
    createdAt: now,
    updatedAt: now,
  }
  list.unshift(asset)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  return asset
}

export function deleteAsset(id: string): void {
  const list = loadAssets().filter((a) => a.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}
