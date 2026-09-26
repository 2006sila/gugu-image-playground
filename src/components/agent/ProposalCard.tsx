import { Check, X, Loader2, Sparkles } from 'lucide-react'
import { useStore, approveProposalAndGenerate, rejectProposal } from '../../store'

/** 提案式 Agent 的确认卡片：挂在 Agent 会话消息流下方 */
export default function ProposalCard() {
  const pending = useStore((s) => s.agentPendingProposal)
  const streaming = useStore((s) => s.agentProposalStreaming)
  const showToast = useStore((s) => s.showToast)
  const webSearch = useStore((s) => s.agentProposalWebSearch)

  if (streaming) {
    return (
      <div className="mx-auto mb-3 flex max-w-3xl items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/[0.06] dark:text-blue-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在分析你的意图并生成提案…
      </div>
    )
  }

  if (!pending) return null

  const { proposal } = pending

  return (
    <div className="mx-auto mb-3 max-w-3xl rounded-xl border border-blue-300 bg-white p-4 shadow-lg dark:border-blue-500/30 dark:bg-zinc-900">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
        <Sparkles className="h-4 w-4" />
        {proposal.action === 'edit' ? '修改图片提案' : '生成新图提案'}
      </div>

      {proposal.reason && (
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">{proposal.reason}</p>
      )}

      <div className="mb-3 flex items-center justify-between text-[11px]">
        <label className="flex cursor-pointer items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={webSearch}
            onChange={(e) => useStore.getState().setAgentProposalWebSearch(e.target.checked)}
            className="h-3.5 w-3.5 accent-blue-500"
          />
          允许模型联网搜索（需上游支持）
        </label>
      </div>

      <div className="mb-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
        {proposal.prompt}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
        {proposal.referencedImageIndexes.length > 0 && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
            参考图：{proposal.referencedImageIndexes.map((i) => `图${i}`).join('、')}
          </span>
        )}
        {proposal.aspectRatio && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            比例 {proposal.aspectRatio}
          </span>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          onClick={() => rejectProposal()}
        >
          <X className="h-4 w-4" />取消
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm text-white transition hover:bg-blue-700 disabled:opacity-50"
          onClick={() => {
            approveProposalAndGenerate().catch((err) => {
              showToast(err instanceof Error ? err.message : String(err), 'error')
            })
          }}
        >
          <Check className="h-4 w-4" />确认生成
        </button>
      </div>
    </div>
  )
}
