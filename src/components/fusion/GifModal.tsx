/**
 * GIF 生成工作台（融合版）
 * 流程：输入动效描述（+可选参考图）→ 生成 4×3 网格图 → 预览各帧 → 调帧延迟 → 导出 GIF
 * 编码复用 Nova 的 gif-encoder（gifenc）。
 */

import { useEffect, useRef, useState } from 'react'
import { X, Loader2, Film, Upload } from 'lucide-react'
import { encodeGifFromGrid } from '../../lib/gifEncoder'
import { buildGifPrompt, type GifLoopMode } from '../../lib/gifPrompt'
import { normalizeSettings } from '../../lib/apiProfiles'
import { useStore } from '../../store'
import { callImageApi } from '../../lib/api'

interface Props {
  open: boolean
  onClose: () => void
}

type Phase = 'input' | 'generating' | 'preview' | 'error'

export default function GifModal({ open, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('input')
  const [userPrompt, setUserPrompt] = useState('')
  const [loopMode, setLoopMode] = useState<GifLoopMode>('loop')
  const [refImages, setRefImages] = useState<string[]>([])
  const [gridDataUrl, setGridDataUrl] = useState<string | null>(null)
  const [gifUrl, setGifUrl] = useState<string | null>(null)
  const [frameDelayMs, setFrameDelayMs] = useState(120)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 关闭时重置状态，避免下次打开残留上次的 phase
  useEffect(() => {
    if (!open) {
      setPhase('input')
      setError(null)
      setGifUrl(null)
      setGridDataUrl(null)
    }
  }, [open])

  if (!open) return null

  const startGenerate = async () => {
    const state = useStore.getState()
    if (!userPrompt.trim()) {
      state.showToast('请输入动效描述', 'error')
      return
    }
    setPhase('generating')
    setError(null)
    try {
      const prompt = buildGifPrompt(userPrompt.trim(), refImages.length, loopMode)
      const result = await callImageApi({
        settings: normalizeSettings(state.settings),
        prompt,
        params: { ...state.params, n: 1, size: '2048x1536' },
        inputImageDataUrls: refImages,
      })
      const grid = result.images[0]
      if (!grid) throw new Error('生成失败：没有返回图像')
      setGridDataUrl(grid)
      setPhase('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPhase('error')
    }
  }

  const exportGif = async () => {
    if (!gridDataUrl) return
    try {
      const blob = await encodeGifFromGrid(gridDataUrl, { frameDelayMs, repeat: 0 })
      const url = URL.createObjectURL(blob)
      setGifUrl(url)
      const a = document.createElement('a')
      a.href = url
      a.download = `gif-${Date.now()}.gif`
      a.click()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setRefImages((imgs) => [...imgs, String(reader.result)].slice(0, 5))
    reader.readAsDataURL(file)
  }

  const reset = () => {
    setPhase('input')
    setGridDataUrl(null)
    setGifUrl(null)
    setError(null)
  }

  return (
    <div className="fusion-overlay-enter fixed inset-0 z-[190] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => { if (phase !== 'generating') onClose() }}>
      <div
        className="fusion-card fusion-modal-enter flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-700">
          <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-white">
            <Film className="h-5 w-5 text-sky-500" />GIF 生成
          </h3>
          <button onClick={onClose} disabled={phase === 'generating'} className="rounded-lg p-1.5 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {phase === 'input' && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">动效描述</label>
                <textarea
                  className="min-h-[80px] w-full rounded-lg border border-zinc-300 p-3 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  placeholder="描述想要的 12 帧动画，例如：一只橘猫从坐下到站起再伸出爪子"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">循环模式</label>
                <div className="flex gap-2">
                  <button
                    className={`rounded-lg px-4 py-1.5 text-sm ${loopMode === 'loop' ? 'bg-sky-600 text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}
                    onClick={() => setLoopMode('loop')}
                  >无缝循环</button>
                  <button
                    className={`rounded-lg px-4 py-1.5 text-sm ${loopMode === 'linear' ? 'bg-sky-600 text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}
                    onClick={() => setLoopMode('linear')}
                  >线性动画</button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">参考图（可选，最多 5 张：角色/风格）</label>
                <div className="flex flex-wrap gap-2">
                  {refImages.map((img, i) => (
                    <img key={i} src={img} className="h-14 w-14 rounded-lg object-cover" alt="" />
                  ))}
                  {refImages.length < 5 && (
                    <button
                      className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-zinc-400 hover:border-zinc-400 dark:border-zinc-600"
                      onClick={() => fileRef.current?.click()}
                    ><Upload className="h-5 w-5" /></button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>
              <button
                className="w-full fusion-btn-primary rounded-xl py-2.5 text-sm font-medium"
                onClick={() => void startGenerate()}
              >生成网格图（12 帧）</button>
            </>
          )}

          {phase === 'generating' && (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-zinc-500">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-sky-500" />
              正在生成 4×3 网格图（12 帧）… 约需 1-2 分钟
            </div>
          )}

          {phase === 'error' && (
            <div className="py-10 text-center">
              <p className="mb-4 text-sm text-red-500">{error}</p>
              <button className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white" onClick={reset}>返回重试</button>
            </div>
          )}

          {phase === 'preview' && gridDataUrl && (
            <>
              <div>
                <div className="mb-1.5 text-xs text-zinc-400">生成的网格图（左）与预览（右）</div>
                <div className="grid grid-cols-2 gap-3">
                  <img src={gridDataUrl} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700" alt="grid" />
                  <img src={gridDataUrl} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700" style={{ clipPath: 'inset(0 0 0 0)' }} alt="preview" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  帧延迟：{frameDelayMs}ms（每帧显示时长）
                </label>
                <input
                  type="range" min={40} max={400} step={20}
                  value={frameDelayMs}
                  onChange={(e) => setFrameDelayMs(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>
              {gifUrl && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-500/20 dark:bg-green-500/[0.06] dark:text-green-300">
                  GIF 已生成并开始下载。
                </div>
              )}
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-2">
                <button className="flex-1 rounded-xl border border-zinc-300 py-2.5 text-sm dark:border-zinc-600" onClick={reset}>重新生成</button>
                <button className="flex-1 fusion-btn-primary rounded-xl py-2.5 text-sm font-medium" onClick={() => void exportGif()}>
                  合成并下载 GIF
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
