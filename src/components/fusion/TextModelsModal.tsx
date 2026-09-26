import { useState, useMemo } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import {
  TEXT_PROTOCOLS,
  TEXT_TASK_KEYS,
  TEXT_TASK_LABELS,
  loadTextModels,
  saveTextModels,
  loadTextDefaults,
  saveTextDefaults,
  type TextModelConfig,
  type TextProviderProtocol,
  type TextDefaults,
} from '../../lib/textModels'

interface Props {
  open: boolean
  onClose: () => void
}

function emptyModel(): TextModelConfig {
  return {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    protocol: 'openai-chat-completions',
    name: '',
    modelId: '',
    apiKey: '',
    baseUrl: '',
  }
}

export default function TextModelsModal({ open, onClose }: Props) {
  const [models, setModels] = useState<TextModelConfig[]>(() => loadTextModels())
  const [defaults, setDefaults] = useState<TextDefaults>(() => loadTextDefaults())
  const [saved, setSaved] = useState(false)

  const update = (next: TextModelConfig[]) => {
    setModels(next)
    saveTextModels(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }
  const updateDefaults = (next: TextDefaults) => {
    setDefaults(next)
    saveTextDefaults(next)
  }

  const usedDefaultIds = useMemo(() => new Set(Object.values(defaults)), [defaults])

  if (!open) return null

  return (
    <div className="fusion-overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="fusion-card fusion-modal-enter max-h-[85vh] w-full max-w-3xl overflow-y-auto p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">文本模型配置</h2>
          <div className="flex items-center gap-3">
            {saved && <span className="flex items-center gap-1 text-xs text-green-600"><Check className="h-3.5 w-3.5" />已保存</span>}
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <X className="h-5 w-5 text-zinc-500" />
            </button>
          </div>
        </div>

        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          文本模型用于反推提示词、提示词优化、Agent 对话等文字能力。与图像模型分开管理。
        </p>

        {/* 默认模型设置 */}
        <div className="mb-5 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <h3 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">各功能默认模型</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TEXT_TASK_KEYS.map(task => (
              <label key={task} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-zinc-600 dark:text-zinc-400">{TEXT_TASK_LABELS[task]}</span>
                <select
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
                  value={defaults[task] || ''}
                  onChange={e => updateDefaults({ ...defaults, [task]: e.target.value || undefined })}
                >
                  <option value="">（未设置，用第一个）</option>
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.name || m.modelId}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        {/* 模型列表 */}
        <div className="space-y-3">
          {models.length === 0 && (
            <p className="py-6 text-center text-sm text-zinc-400">还没有配置文本模型，点击下方按钮添加</p>
          )}
          {models.map((m, idx) => (
            <div key={m.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">模型 {idx + 1}{usedDefaultIds.has(m.id) && <span className="ml-2 text-green-600">默认</span>}</span>
                <button
                  className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => update(models.filter(x => x.id !== m.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="text-xs">
                  <span className="mb-1 block text-zinc-500">名称</span>
                  <input
                    className="w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-600"
                    value={m.name}
                    placeholder="如 DeepSeek / Claude"
                    onChange={e => update(models.map(x => x.id === m.id ? { ...x, name: e.target.value } : x))}
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-zinc-500">协议</span>
                  <select
                    className="w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                    value={m.protocol}
                    onChange={e => update(models.map(x => x.id === m.id ? { ...x, protocol: e.target.value as TextProviderProtocol } : x))}
                  >
                    {TEXT_PROTOCOLS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-zinc-500">模型 ID</span>
                  <input
                    className="w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-600"
                    value={m.modelId}
                    placeholder="deepseek-chat / gemini-2.5-flash..."
                    onChange={e => update(models.map(x => x.id === m.id ? { ...x, modelId: e.target.value } : x))}
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-zinc-500">API Key</span>
                  <input
                    type="password"
                    className="w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-600"
                    value={m.apiKey}
                    onChange={e => update(models.map(x => x.id === m.id ? { ...x, apiKey: e.target.value } : x))}
                  />
                </label>
                <label className="text-xs sm:col-span-2">
                  <span className="mb-1 block text-zinc-500">
                    Base URL（协议端点会自动拼接：chat → /chat/completions，gemini → /models/...）
                  </span>
                  <input
                    className="w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-600"
                    value={m.baseUrl}
                    placeholder="https://api.example.com/v1"
                    onChange={e => update(models.map(x => x.id === m.id ? { ...x, baseUrl: e.target.value } : x))}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <button
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2.5 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:hover:text-zinc-300"
          onClick={() => update([...models, emptyModel()])}
        >
          <Plus className="h-4 w-4" />添加文本模型
        </button>
      </div>
    </div>
  )
}
