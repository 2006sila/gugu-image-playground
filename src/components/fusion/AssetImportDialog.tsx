/**
 * 从素材库导入（选择器弹窗）
 * 仿 Nova 的素材导入弹窗：多选素材卡片 → 确认导入为参考图。
 * 供画廊输入栏 / Agent 输入栏调用。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Search, Check } from 'lucide-react'
import { useStore } from '../../store'
import {
  loadImageAssets,
  sortAssets,
  type ImageAsset,
  type AssetSortMode,
} from '../../lib/imageAssets'
import { ensureImageCached, getCachedImage } from '../../lib/imageCache'

const MAX_SELECT = 16
const MAX_IMPORT_PER_BATCH = 5

interface Props {
  open: boolean
  onClose: () => void
  /** 导入完成后回调（拿到 dataUrl 列表） */
  onImported?: (dataUrls: string[]) => void
}

export default function AssetImportDialog({ open, onClose, onImported }: Props) {
  const showToast = useStore((s) => s.showToast)
  const [assets, setAssets] = useState<ImageAsset[]>(() => loadImageAssets())
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<AssetSortMode>('createdAt')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setSelected(new Set())
      setSearch('')
      return
    }
    setAssets(loadImageAssets())
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const map: Record<string, string> = { ...thumbnails }
      for (const a of assets) {
        if (map[a.imageId]) continue
        const thumb = await getCachedImage(a.imageId)
        const dataUrl = thumb ?? (await ensureImageCached(a.imageId).catch(() => null))
        if (cancelled) return
        if (dataUrl) map[a.imageId] = dataUrl
      }
      setThumbnails(map)
    })()
    return () => { cancelled = true }
  }, [assets, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let list = assets
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        (a.note || '').toLowerCase().includes(q) ||
        (a.source || '').toLowerCase().includes(q),
      )
    }
    return sortAssets(list, sortMode)
  }, [assets, search, sortMode])

  if (!open) return null

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < MAX_SELECT) next.add(id)
      return next
    })
  }

  const importSelected = async () => {
    if (selected.size === 0) return
    setImporting(true)
    try {
      const s = useStore.getState()
      const dataUrls: string[] = []
      for (const imageId of selected) {
        const dataUrl = await ensureImageCached(imageId).catch(() => null)
        if (dataUrl) dataUrls.push(dataUrl)
      }
      const inputImages = dataUrls.map((dataUrl, i) => ({ id: `imp-${Date.now()}-${i}`, dataUrl }))
      s.setInputImages([...s.inputImages, ...inputImages])
      onImported?.(dataUrls)
      showToast(`已导入 ${dataUrls.length} 张参考图`, 'success')
      onClose()
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fusion-overlay-enter fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="fusion-card fusion-modal-enter flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">从素材库导入</h3>
            <span className="text-xs text-zinc-400">已选 {selected.size} / {MAX_SELECT}</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-white/[0.06]">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {/* 搜索行 */}
        <div className="flex items-center gap-2 px-5 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-sky-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
              placeholder="搜索名称、标签、备注、来源"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as AssetSortMode)}
          >
            <option value="createdAt">最新添加</option>
            <option value="name">按名称</option>
            <option value="bytes">按大小</option>
          </select>
          <button
            onClick={() => { setAddOpen(true); fileRef.current?.click() }}
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-white/[0.08] dark:text-zinc-300 dark:hover:bg-white/[0.04]"
          >导入图片</button>
        </div>

        {/* 网格 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-400">
              {assets.length === 0 ? '素材库为空——先在「我的素材」里收藏图片' : '没有匹配的素材'}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {filtered.map((asset) => {
                const isSelected = selected.has(asset.id)
                return (
                  <button
                    key={asset.id}
                    onClick={() => toggle(asset.id)}
                    className={`relative overflow-hidden rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-sky-500 shadow-md ring-2 ring-sky-500/30'
                        : 'border-zinc-200 hover:border-zinc-300 dark:border-white/[0.08] dark:hover:border-white/[0.15]'
                    }`}
                  >
                    <div className="relative aspect-square overflow-hidden bg-zinc-50 dark:bg-zinc-800">
                      {thumbnails[asset.imageId] && (
                        <img src={thumbnails[asset.imageId]} className="h-full w-full object-cover" alt="" />
                      )}
                      {isSelected && (
                        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white shadow">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">{asset.name}</div>
                      <div className="mt-0.5 truncate text-[10px] text-zinc-400">
                        {asset.tags.length ? asset.tags.join(' / ') : '无标签'}
                      </div>
                      {notes[asset.imageId] && (
                        <div className="mt-1 line-clamp-2 text-[10px] leading-snug text-zinc-400">{notes[asset.imageId]}</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3 dark:border-white/[0.06]">
          <button
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-white/[0.08] dark:text-zinc-300 dark:hover:bg-white/[0.04]"
            onClick={onClose}
            disabled={importing}
          >取消</button>
          <button
            className="fusion-btn-primary rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-40"
            onClick={() => void importSelected()}
            disabled={importing || selected.size === 0}
          >
            {importing ? '导入中…' : `导入选中${selected.size ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files || [])
          for (const file of files) {
            if (!file.type.startsWith('image/')) continue
            const dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve(String(reader.result))
              reader.readAsDataURL(file)
            })
            const { storeImage } = await import('../../lib/db')
            const { addImageAsset } = await import('../../lib/imageAssets')
            const imageId = await storeImage(dataUrl, 'upload')
            addImageAsset({ imageId, name: file.name.replace(/\.[^.]+$/, ''), source: '上传', bytes: file.size })
          }
          setAddOpen(false)
          setAssets(loadImageAssets())
        }}
      />
    </div>
  )
}
