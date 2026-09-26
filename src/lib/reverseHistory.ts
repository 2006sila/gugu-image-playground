/**
 * 反推提示词历史存储（融合版）
 * 用 localStorage 轻量持久化（文本数据，无大图），与 Nova 的 reverse-prompt-store 对齐。
 */

const STORAGE_KEY = 'fusion-reverse-history'
const MAX_ITEMS = 200

export interface ReverseHistoryItem {
  id: string
  /** 反推模式：style-extract | replicate */
  mode: string
  /** 反推结果文本 */
  text: string
  /** 参考图缩略图 data URL（压缩过的小图） */
  thumbnail?: string
  /** 使用的模型名称 */
  modelName?: string
  createdAt: number
}

export function loadReverseHistory(): ReverseHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveReverseHistoryItem(item: Omit<ReverseHistoryItem, 'id' | 'createdAt'>): void {
  const list = loadReverseHistory()
  const full: ReverseHistoryItem = {
    ...item,
    id: `rh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  }
  list.unshift(full)
  while (list.length > MAX_ITEMS) list.pop()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function deleteReverseHistoryItem(id: string): void {
  const list = loadReverseHistory().filter((item) => item.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function clearReverseHistory(): void {
  localStorage.removeItem(STORAGE_KEY)
}
