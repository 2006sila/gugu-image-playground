/**
 * 文本模型管理（设置页内嵌版）
 * 直接在设置 tab 里展示模型列表与默认模型设置，内联编辑，实时保存。
 * 取代旧的"引导卡 + 二级弹窗"方案。
 */

import { useMemo, useState } from 'react'
import { Check, Plus, Trash2, ChevronDown } from 'lucide-react'
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

const inputCls =
  'w-full rounded-lg border border-gray-200/80 bg-white/70 px-3 py-2 text-sm text-gray-800 outline-none transition-all placeholder:text-gray-300 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100 dark:placeholder:text-zinc-600'

export default function TextModelsTab() {
  const [models, setModels] = useState<TextModelConfig[]>(() => loadTextModels())
  const [defaults, setDefaults] = useState<TextDefaults>(() => loadTextDefaults())
  const [expandedId, setExpandedId] = useState<string | null>(null)
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

  return (
    <div className="space-y-5">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">文本模型</h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            用于反推提示词、提示词优化、Agent 对话。支持 OpenAI / Anthropic / Gemini 协议。更改实时保存。
          </p>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-sky-500">
            <Check className="h-3.5 w-3.5" />已保存
          </span>
        )}
      </div>

      {/* 默认模型分配 */}
      <div className="rounded-2xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">各功能默认模型</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {TEXT_TASK_KEYS.map((task) => (
            <label key={task} className="flex items-center gap-2.5 text-xs">
              <span className="w-20 shrink-0 text-gray-500 dark:text-gray-400">{TEXT_TASK_LABELS[task]}</span>
              <select
                className="min-w-0 flex-1 rounded-lg border border-gray-200/80 bg-white px-2.5 py-2 text-xs text-gray-700 outline-none transition focus:border-sky-400 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200"
                value={defaults[task] || ''}
                onChange={(e) => updateDefaults({ ...defaults, [task]: e.target.value || undefined })}
              >
                <option value="">（未设置）</option>
                {models.filter((m) => m.apiKey).map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.modelId}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      {/* 模型卡片列表 */}
      <div className="space-y-2.5">
        {models.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400 dark:border-white/[0.08]">
            还没有文本模型，点击下方按钮添加
          </div>
        )}
        {models.map((m) => {
          const expanded = expandedId === m.id
          return (
            <div
              key={m.id}
              className={`overflow-hidden rounded-2xl border transition-all ${
                expanded
                  ? 'border-sky-400/60 shadow-[0_4px_20px_rgba(14,165,233,0.1)]'
                  : 'border-gray-200/80 hover:border-gray-300 dark:border-white/[0.08] dark:hover:border-white/[0.15]'
              }`}
            >
              {/* 折叠头 */}
              <button
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                onClick={() => setExpandedId(expanded ? null : m.id)}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-xs font-bold text-sky-600 dark:bg-sky-500/15 dark:text-sky-400">
                  {(m.name || m.modelId || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-800 dark:text-zinc-100">
                      {m.name || m.modelId || '未命名模型'}
                    </span>
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {TEXT_PROTOCOLS.find((p) => p.value === m.protocol)?.label}
                    </span>
                    {usedDefaultIds.has(m.id) && (
                      <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-600 dark:bg-sky-500/15 dark:text-sky-400">默认</span>
                    )}
                  </div>
                  {!expanded && m.modelId && (
                    <div className="truncate text-[11px] text-gray-400">{m.modelId}</div>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>

              {/* 展开编辑区 */}
              {expanded && (
                <div className="space-y-3 border-t border-gray-100 px-4 py-3.5 dark:border-white/[0.06]">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-gray-400">名称</span>
                      <input
                        className={inputCls}
                        value={m.name}
                        placeholder="如 DeepSeek"
                        onChange={(e) => update(models.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)))}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-gray-400">协议</span>
                      <select
                        className={inputCls}
                        value={m.protocol}
                        onChange={(e) => update(models.map((x) => (x.id === m.id ? { ...x, protocol: e.target.value as TextProviderProtocol } : x)))}
                      >
                        {TEXT_PROTOCOLS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-gray-400">模型 ID</span>
                      <input
                        className={inputCls}
                        value={m.modelId}
                        placeholder="deepseek-chat / gemini-2.5-flash"
                        onChange={(e) => update(models.map((x) => (x.id === m.id ? { ...x, modelId: e.target.value } : x)))}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-gray-400">API Key</span>
                      <input
                        type="password"
                        className={inputCls}
                        value={m.apiKey}
                        onChange={(e) => update(models.map((x) => (x.id === m.id ? { ...x, apiKey: e.target.value } : x)))}
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-[11px] text-gray-400">Base URL（协议端点自动拼接）</span>
                      <input
                        className={inputCls}
                        value={m.baseUrl}
                        placeholder="https://api.example.com/v1"
                        onChange={(e) => update(models.map((x) => (x.id === m.id ? { ...x, baseUrl: e.target.value } : x)))}
                      />
                    </label>
                  </div>
                  <div className="flex justify-end">
                    <button
                      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                      onClick={() => {
                        update(models.filter((x) => x.id !== m.id))
                        if (expandedId === m.id) setExpandedId(null)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />删除此模型
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 添加 */}
      <button
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gray-300 py-3 text-sm text-gray-500 transition-all hover:border-sky-400 hover:text-sky-600 dark:border-white/[0.1] dark:hover:text-sky-400"
        onClick={() => {
          const nm = emptyModel()
          update([...models, nm])
          setExpandedId(nm.id)
        }}
      >
        <Plus className="h-4 w-4" />添加文本模型
      </button>
    </div>
  )
}
