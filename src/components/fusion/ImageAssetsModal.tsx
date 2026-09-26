/**
 * 图片素材库（融合版）
 * 仿 Nova 的"我的素材"：网格展示收藏的图片素材，支持搜索、排序、重命名、
 * 复制到输入栏作参考图、下载、删除。数据全部本地。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Search, Trash2, Pencil, Copy, Download, Plus, Check } from 'lucide-react'
import { useStore, addImageFromFile } from '../../store'
import {
  loadImageAssets,
  deleteImageAsset,
  updateImageAsset,
  sortAssets,
  formatBytes,
  type ImageAsset,
  type AssetSortMode,
} from '../../lib/imageAssets'
import { ensureImageCached, getCachedImage } from '../../lib/imageCache'

interface Props {
  open: boolean
  onClose: () => void
}

const SORT_OPTIONS: { value: AssetSortMode; label: string }[] = [
  { value: 'createdAt', label: '最新添加' },
  { value: 'name', label: '按名称' },
  { value: 'bytes', label: '按大小' },
]

export default function ImageAssetsModal({ open, onClose }: Props) {
  const showToast = useStore((s) => s.showToast)
  const [assets, setAssets] = useState<ImageAsset[]>(() => loadImageAssets())
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<AssetSortMode>('createdAt')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setAssets(loadImageAssets())
  }, [open])

  // 加载缩略图
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

  const refresh = () => setAssets(loadImageAssets())

  const handleCopyToInput = async (asset: ImageAsset) => {
    const dataUrl = await ensureImageCached(asset.imageId).catch(() => null)
    if (!dataUrl) {
      showToast('素材图片数据丢失', 'error')
      return
    }
    const s = useStore.getState()
    if (s.appMode === 'agent') {
      // Agent 模式下也回填输入栏（提案模式共用）
      s.setInputImages([...s.inputImages, { id: asset.imageId, dataUrl }])
    } else {
      s.setInputImages([...s.inputImages, { id: asset.imageId, dataUrl }])
    }
    showToast('已添加为参考图', 'success')
  }

  const handleDownload = async (asset: ImageAsset) => {
    const dataUrl = await ensureImageCached(asset.imageId).catch(() => null)
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${asset.name || 'asset'}.png`
    a.click()
  }

  const submitRename = (asset: ImageAsset) => {
    updateImageAsset(asset.id, { name: editName.trim() || asset.name })
    setEditingId(null)
    refresh()
  }

  return (
    <div className="fusion-overlay-enter fixed inset-y-0 right-0 left-0 xl:left-56 z-[190] flex flex-col bg-white dark:bg-gray-950">
      {/* 顶栏 */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-white/[0.06]">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">我的素材库</h2>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-sm text-white hover:bg-sky-600"
            onClick={() => { setAddOpen(true); fileRef.current?.click() }}
          >
            <Plus className="h-4 w-4" />添加素材
          </button>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-white/[0.06]">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>
      </div>

      {/* 工具行 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-5 py-2.5 dark:border-white/[0.06]">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
            placeholder="搜索名称、标签、备注、来源"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as AssetSortMode)}
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>排序：{o.label}</option>)}
        </select>
      </div>

      {/* 网格 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-sm text-zinc-400">
            {assets.length === 0 ? '素材库为空——生成或上传图片后，点图片菜单里的「收藏到素材库」收录进来' : '没有匹配的素材'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {filtered.map((asset) => (
              <div key={asset.id} className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-shadow hover:shadow-lg dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="relative aspect-square overflow-hidden bg-zinc-50 dark:bg-zinc-800">
                  {thumbnails[asset.imageId] && (
                    <img src={thumbnails[asset.imageId]} className="h-full w-full object-cover" alt={asset.name} />
                  )}
                </div>
                <div className="p-3">
                  {editingId === asset.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        className="min-w-0 flex-1 rounded-md border border-sky-400 px-2 py-1 text-sm dark:bg-zinc-800"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') submitRename(asset) }}
                      />
                      <button className="rounded p-1 text-sky-500" onClick={() => submitRename(asset)}>
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{asset.name}</span>
                      <button
                        className="shrink-0 rounded p-1 text-zinc-300 opacity-0 transition group-hover:opacity-100 hover:text-sky-500"
                        onClick={() => { setEditingId(asset.id); setEditName(asset.name) }}
                      ><Pencil className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="truncate">{asset.source || '素材'}{asset.bytes ? ` · ${formatBytes(asset.bytes)}` : ''}</span>
                  </div>
                  {asset.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {asset.tags.map((t) => (
                        <span key={t} className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{t}</span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                    <button className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-sky-500 dark:hover:bg-white/[0.06]" title="用作参考图" onClick={() => void handleCopyToInput(asset)}>
                      <Copy className="h-4 w-4" />
                    </button>
                    <button className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-sky-500 dark:hover:bg-white/[0.06]" title="下载" onClick={() => void handleDownload(asset)}>
                      <Download className="h-4 w-4" />
                    </button>
                    <button className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10" title="删除" onClick={() => { deleteImageAsset(asset.id); refresh() }}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
            const imageId = await storeImage(dataUrl, 'upload')
            const { addImageAsset } = await import('../../lib/imageAssets')
            addImageAsset({
              imageId,
              name: file.name.replace(/\.[^.]+$/, ''),
              source: '上传',
              bytes: file.size,
            })
          }
          setAddOpen(false)
          refresh()
          showToast(`已添加 ${files.length} 个素材`, 'success')
        }}
      />
    </div>
  )
}
