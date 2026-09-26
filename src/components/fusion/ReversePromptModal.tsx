import { useRef, useState } from 'react'
import { ScanSearch, X, Copy, Loader2, Square } from 'lucide-react'
import { streamReversePrompt, type StreamReverseHandle } from '../../lib/reverseClient'
import { REVERSE_PROMPT_MODE_OPTIONS, type ReversePromptMode } from '../../lib/reverseTemplates'
import { resolveTextModel, type TextModelConfig } from '../../lib/textModels'
import { saveReverseHistoryItem, loadReverseHistory, deleteReverseHistoryItem, type ReverseHistoryItem } from '../../lib/reverseHistory'

interface Props {
  open: boolean
  onClose: () => void
  /** 预填图片（data URL），来自画廊"反推此图"入口 */
  initialImage?: string | null
  /** 采纳反推结果：回填到主输入栏 */
  onAdopt: (prompt: string) => void
  textModels: TextModelConfig[]
  textDefaults: Record<string, string | undefined>
}

type ResultState = {
  text: string
  mode: ReversePromptMode
  finished: boolean
  error?: string
}

/** 压缩缩略图（最长边 96px JPEG） */
function makeThumbnail(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 96 / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.max(1, Math.round(img.naturalWidth * scale))
      const h = Math.max(1, Math.round(img.naturalHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no canvas')); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => reject(new Error('img load fail'))
    img.src = dataUrl
  })
}

export default function ReversePromptModal({ open, onClose, initialImage, onAdopt, textModels, textDefaults }: Props) {
  const [image, setImage] = useState<string | null>(initialImage || null)
  const [mode, setMode] = useState<ReversePromptMode>('replicate')
  const [result, setResult] = useState<ResultState | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<ReverseHistoryItem[]>(() => loadReverseHistory())
  const handleRef = useRef<StreamReverseHandle | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const resolvedModel = resolveTextModel(textModels, textDefaults, 'reversePrompt')

  if (!open) return null

  const start = (dataUrl: string, m: ReversePromptMode) => {
    if (!resolvedModel?.apiKey) return
    setResult({ text: '', mode: m, finished: false })
    setStreaming(true)
    const handle = streamReversePrompt(
      { model: resolvedModel, mode: m, imageDataUrl: dataUrl },
      {
        onDelta: token => setResult(prev => (prev ? { ...prev, text: prev.text + token } : prev)),
        onDone: text => {
          setResult({ text, mode: m, finished: true });
          setStreaming(false);
          // 生成小缩略图再存历史，避免 localStorage 塞入原图
          if (!image) return
          makeThumbnail(image).then((thumb) => {
            saveReverseHistoryItem({
              mode: m,
              text,
              thumbnail: thumb,
              modelName: resolvedModel?.name || resolvedModel?.modelId,
            });
            setHistory((h) => loadReverseHistory());
          }).catch(() => {
            saveReverseHistoryItem({ mode: m, text, modelName: resolvedModel?.name || resolvedModel?.modelId });
          });
        },
        onError: err => {
          setResult(prev => (prev ? { ...prev, finished: true, error: err.message } : prev))
          setStreaming(false)
        },
      },
    )
    handleRef.current = handle
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      setImage(dataUrl)
      setResult(null)
      if (resolvedModel?.apiKey) start(dataUrl, mode)
    }
    reader.readAsDataURL(file)
  }

  const stop = () => {
    handleRef.current?.abort()
    handleRef.current = null
    setStreaming(false)
    setResult(prev => (prev ? { ...prev, finished: true } : prev))
  }

  return (
    <div className="fusion-overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => { if (!streaming) onClose() }}>
      <div
        className="fusion-card fusion-modal-enter max-h-[88vh] w-full max-w-3xl overflow-y-auto p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            <ScanSearch className="h-5 w-5" />反推提示词
          </h2>
          <button onClick={onClose} disabled={streaming} className="rounded-lg p-1.5 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {!resolvedModel?.apiKey && (
          <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            尚未配置文本模型：请先到 设置 → 文本模型 添加一个模型（如 deepseek-chat / gemini-2.5-flash）。
          </div>
        )}

        {/* 模式选择 */}
        <div className="mb-3 flex gap-2">
          {REVERSE_PROMPT_MODE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              disabled={streaming}
              title={opt.description}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                mode === opt.value
                  ? 'bg-sky-600 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
              onClick={() => {
                setMode(opt.value)
                if (image && !streaming) start(image, opt.value)
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 历史记录入口 */}
        <div className="mb-3 flex items-center justify-between text-xs">
          <button
            className="flex items-center gap-1 text-zinc-500 hover:text-blue-600 dark:text-zinc-400"
            onClick={() => { setHistory((h) => loadReverseHistory()); setHistoryOpen((v) => !v) }}
          >
            🕘 反推历史（{history.length}）
          </button>
          {historyOpen && history.length > 0 && (
            <button
              className="text-red-400 hover:text-red-500"
              onClick={() => { history.forEach((h) => deleteReverseHistoryItem(h.id)); setHistory([]) }}
            >清空全部</button>
          )}
        </div>
        {historyOpen && (
          <div className="mb-3 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
            {history.length === 0 && <p className="py-4 text-center text-xs text-zinc-400">暂无历史记录</p>}
            {history.map((item) => (
              <div key={item.id} className="flex items-start gap-2 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800">
                {item.thumbnail && <img src={item.thumbnail} className="h-10 w-10 shrink-0 rounded object-cover" alt="" />}
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-xs text-zinc-700 dark:text-zinc-300">{item.text.slice(0, 120)}{item.text.length > 120 ? '…' : ''}</div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-400">
                    <span>{item.mode === 'replicate' ? '复刻' : '风格'}</span>
                    {item.modelName && <span>· {item.modelName}</span>}
                    <span>· {new Date(item.createdAt).toLocaleString()}</span>
                    <button className="ml-auto text-sky-500 hover:underline" onClick={() => { onAdopt(item.text); onClose() }}>用作提示词</button>
                    <button className="text-red-400 hover:underline" onClick={() => { deleteReverseHistoryItem(item.id); setHistory((h) => h.filter((x) => x.id !== item.id)) }}>删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 图片上传区 */}
        {!image ? (
          <div
            className={`flex h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-sm transition ${
              dragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-zinc-300 text-zinc-400'
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f) handleFile(f)
            }}
          >
            点击选择或拖入图片
            <span className="mt-1 text-xs">上传后自动开始反推</span>
          </div>
        ) : (
          <div className="mb-3 flex items-start gap-3">
            <img src={image} alt="ref" className="max-h-40 rounded-lg border border-zinc-200 dark:border-zinc-700" />
            <div className="flex flex-col gap-2 text-xs">
              <button
                className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                onClick={() => fileRef.current?.click()}
                disabled={streaming}
              >换一张</button>
              <button
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                onClick={() => { setImage(null); setResult(null) }}
                disabled={streaming}
              >移除</button>
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

        {/* 结果区 */}
        {result && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                {streaming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {streaming ? '反推中…' : result.error ? '出错了' : '反推完成'}
                {result.error && <span className="text-red-500">{result.error}</span>}
              </span>
              <div className="flex gap-2">
                {streaming ? (
                  <button onClick={stop} className="flex items-center gap-1 rounded-md bg-red-500 px-2.5 py-1 text-xs text-white hover:bg-red-600">
                    <Square className="h-3 w-3" />停止
                  </button>
                ) : (
                  <>
                    <button
                      className="flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                      onClick={() => navigator.clipboard?.writeText(result.text)}
                    ><Copy className="h-3 w-3" />复制</button>
                    <button
                      className="fusion-btn-primary rounded-md px-2.5 py-1 text-xs"
                      onClick={() => { onAdopt(result.text); onClose() }}
                    >用作提示词</button>
                  </>
                )}
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
              {result.text || '…'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
