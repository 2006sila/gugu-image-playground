/**
 * 提示词面板（融合版）：提示词广场 + 我的素材
 * 广场页仿 Nova：分类 chips + 大网格 + 类型标签 + 来源链接 + 分页。
 * 数据源：awesome-gpt-image-2、ZeroLu、YouMind、ImgEdify、大香蕉收纳盒（打包内置）+ 用户自定义。
 */

import { useEffect, useMemo, useState } from 'react'
import { X, Plus, Trash2, Copy, Search, ExternalLink, ChevronLeft, ChevronRight, Star, Pencil } from 'lucide-react'
import {
  loadAssets,
  saveAsset,
  deleteAsset,
  type PromptAsset,
} from '../../lib/promptAssets'
import {
  BUILTIN_GALLERY_PROMPTS,
  GALLERY_CATEGORIES,
  GALLERY_SOURCES,
  loadCustomGalleryPrompts,
  saveCustomGalleryPrompt,
  deleteCustomGalleryPrompt,
  type GalleryPrompt,
} from '../../lib/promptGallery'

interface Props {
  open: boolean
  onClose: () => void
  /** 采纳提示词（回填到输入栏/追加） */
  onAdopt: (prompt: string) => void
}

type Tab = 'assets' | 'gallery'

const PAGE_SIZE = 100

export default function PromptPanelModal({ open, onClose, onAdopt }: Props) {
  const [tab, setTab] = useState<Tab>('gallery')
  const [assets, setAssets] = useState<PromptAsset[]>(() => loadAssets())
  const [editingName, setEditingName] = useState('')
  const [editingContent, setEditingContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingAsset, setSavingAsset] = useState(false)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('全部')
  const [page, setPage] = useState(0)
  const [customPrompts, setCustomPrompts] = useState<GalleryPrompt[]>(() => loadCustomGalleryPrompts())
  const refreshCustom = () => setCustomPrompts(loadCustomGalleryPrompts())

  const [showSources, setShowSources] = useState(false)

  // 保留旧的 useStates
  void setEditingName
  void editingName
  void setEditingContent
  void editingContent
  void editingId
  void setEditingId

  useEffect(() => {
    if (open) refreshCustom()
  }, [open])

  const allPrompts = useMemo(() => [...customPrompts, ...BUILTIN_GALLERY_PROMPTS], [customPrompts])

  const filtered = useMemo(() => {
    let list = allPrompts
    if (category !== '全部') list = list.filter((p) => p.category === category)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        (p.sourceLabel || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [allPrompts, category, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  if (!open) return null

  const adopt = (text: string) => {
    onAdopt(text)
    onClose()
  }

  return (
    <div className="fusion-overlay-enter fixed inset-y-0 right-0 left-0 xl:left-56 z-[190] flex flex-col bg-white dark:bg-gray-950">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-white/[0.06]">
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
            <button
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === 'gallery' ? 'bg-white text-sky-600 shadow-sm dark:bg-zinc-700 dark:text-sky-400' : 'text-zinc-500'}`}
              onClick={() => setTab('gallery')}
            >提示词广场</button>
            <button
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === 'assets' ? 'bg-white text-sky-600 shadow-sm dark:bg-zinc-700 dark:text-sky-400' : 'text-zinc-500'}`}
              onClick={() => setTab('assets')}
            >我的收藏</button>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-white/[0.06]">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {/* ============ 提示词广场 ============ */}
        {tab === 'gallery' && (
          <>
            <div className="border-b border-zinc-200 px-6 pt-3 dark:border-white/[0.06]">
              {/* 搜索 + 添加 */}
              <div className="mb-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
                    placeholder="搜索提示词、标题、作者或标签…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                  />
                </div>
                <button
                  className="fusion-btn-primary flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium"
                  onClick={() => {
                    const content = window.prompt('输入提示词内容：')
                    if (!content) return
                    const title = window.prompt('给这条提示词起个名字：') || content.slice(0, 20)
                    saveCustomGalleryPrompt({ category: '其他应用场景', title, content, tags: [] })
                    refreshCustom()
                  }}
                ><Plus className="h-4 w-4" />添加模板</button>
              </div>
              {/* 分类 chips */}
              <div className="flex flex-wrap gap-1.5 pb-3">
                {GALLERY_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                      category === cat ? 'bg-sky-500 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                    }`}
                    onClick={() => { setCategory(cat); setPage(0) }}
                  >{cat}</button>
                ))}
              </div>
            </div>

            {/* 统计行 */}
            <div className="flex items-center justify-between px-6 py-2 text-xs text-zinc-400">
              <span>找到 {filtered.length} 个提示词 · 显示 {pageItems.length} 个</span>
              <button className="flex items-center gap-1 hover:text-sky-500" onClick={() => setShowSources((v) => !v)}>
                提示词来源 <ExternalLink className="h-3 w-3" />
              </button>
            </div>

            {showSources && (
              <div className="mx-5 mb-3 rounded-xl border border-zinc-200 p-3 text-sm dark:border-white/[0.08]">
                <p className="mb-2 text-xs font-medium text-zinc-400">提示词来源（{GALLERY_SOURCES.length}）</p>
                <div className="space-y-1.5">
                  {GALLERY_SOURCES.map((src) => (
                    <a key={src.url} href={src.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-zinc-600 transition hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-white/[0.04]">
                      <span>{src.name}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 网格 */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {pageItems.map((p) => (
                  <div key={p.id} className="group overflow-hidden rounded-2xl border border-zinc-200 transition-all hover:border-sky-300/60 hover:shadow-md dark:border-white/[0.08] dark:hover:border-sky-500/30">
                    {p.preview && (
                      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                        <img
                          src={p.preview.startsWith('http') ? p.preview : `${import.meta.env.BASE_URL}${p.preview}`}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      </div>
                    )}
                    <div className="p-3.5">
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <span className="line-clamp-1 text-sm font-semibold text-zinc-800 dark:text-zinc-100">{p.title}</span>
                      {p.custom && <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-600 dark:bg-sky-500/15 dark:text-sky-400">自定义</span>}
                    </div>
                    {p.type && <span className="mb-1.5 inline-block rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{p.type}</span>}
                    <p className="line-clamp-3 min-h-[48px] text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{p.content}</p>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="max-w-[40%] truncate text-[10px] text-zinc-500 dark:text-zinc-400">{p.sourceLabel || p.category}</span>
                      <div className="flex items-center gap-0.5">
                        {p.custom && (
                          <button
                            className="rounded p-1.5 text-zinc-300 hover:text-red-500"
                            onClick={() => { deleteCustomGalleryPrompt(p.id); refreshCustom() }}
                          ><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                        {!p.custom && (
                          <button
                            className="rounded p-1.5 text-zinc-300 hover:text-amber-500"
                            title="收藏到我的收藏"
                            onClick={() => { saveAsset(p.title, p.content); setAssets(loadAssets()) }}
                          ><Star className="h-3.5 w-3.5" /></button>
                        )}
                        <button className="rounded p-1.5 text-zinc-300 hover:text-sky-500" title="复制" onClick={() => navigator.clipboard?.writeText(p.content)}>
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button className="text-xs text-sky-500 hover:underline" onClick={() => adopt(p.content)}>使用</button>
                      </div>
                    </div>
                    {p.sourceUrl && (
                      <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-[10px] text-zinc-300 hover:text-sky-400">
                        原始来源 <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 分页 */}
              {pageCount > 1 && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 disabled:opacity-30 dark:border-white/[0.08]"
                    disabled={safePage === 0}
                    onClick={() => setPage(safePage - 1)}
                  ><ChevronLeft className="h-4 w-4" /></button>
                  <span className="text-xs text-zinc-500">{safePage + 1} / {pageCount}</span>
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 disabled:opacity-30 dark:border-white/[0.08]"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage(safePage + 1)}
                  ><ChevronRight className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ============ 我的收藏（提示词素材）============ */}
        {tab === 'assets' && (
          <div className="flex min-h-0 flex-1 flex-col p-6">
            {!savingAsset && (
              <button
                className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2.5 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:hover:text-zinc-300"
                onClick={() => { setSavingAsset(true); setEditingId(null); setEditingName(''); setEditingContent('') }}
              >
                <Plus className="h-4 w-4" />新建素材
              </button>
            )}
            {savingAsset && (
              <div className="mb-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                <input
                  className="mb-2 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  placeholder="素材名称"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                />
                <textarea
                  className="mb-2 min-h-[80px] w-full rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  placeholder="提示词内容"
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button className="rounded-md border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-600" onClick={() => { setSavingAsset(false); setEditingId(null) }}>取消</button>
                  <button
                    className="rounded-md bg-sky-500 px-3 py-1 text-xs text-white hover:bg-sky-600"
                    onClick={() => {
                      if (!editingContent.trim()) return
                      saveAsset(editingName.trim(), editingContent.trim(), editingId ?? undefined)
                      setAssets(loadAssets())
                      setSavingAsset(false)
                      setEditingId(null)
                    }}
                  >保存</button>
                </div>
              </div>
            )}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {assets.length === 0 && <p className="py-10 text-center text-sm text-zinc-400">收藏为空——在提示词广场点 ⭐ 收藏进来</p>}
              {assets.map((asset) => (
                <div key={asset.id} className="group rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{asset.name}</span>
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        className="rounded p-1 text-zinc-400 hover:text-sky-500"
                        onClick={() => {
                          setSavingAsset(true)
                          setEditingId(asset.id)
                          setEditingName(asset.name)
                          setEditingContent(asset.content)
                        }}
                      ><Pencil className="h-3.5 w-3.5" /></button>
                      <button className="rounded p-1 text-zinc-400 hover:text-sky-500" title="复制" onClick={() => navigator.clipboard?.writeText(asset.content)}>
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button className="rounded p-1 text-zinc-400 hover:text-red-500" title="删除" onClick={() => { deleteAsset(asset.id); setAssets(loadAssets()) }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{asset.content}</p>
                  <div className="mt-1.5 text-right">
                    <button className="text-xs text-sky-500 hover:underline" onClick={() => adopt(asset.content)}>使用</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  )
}
