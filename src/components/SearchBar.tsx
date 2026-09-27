import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { clearFailedTasks, useStore, taskMatchesFilterStatus, taskMatchesSearchQuery } from '../store'
import { ALL_FAVORITES_COLLECTION_ID, getTaskFavoriteCollectionIds } from '../lib/favoriteState'
import { hasTaskAdvancedFilters, taskMatchesAdvancedFilters } from '../lib/taskFilters'
import { useTooltip } from '../hooks/useTooltip'
import Select from './Select'
import { ChevronLeftIcon, CollectionManageIcon, FavoriteIcon, TrashIcon } from './icons'
import ViewportTooltip from './ViewportTooltip'

function SearchActionButton({
  tooltip,
  className,
  disabled = false,
  onClick,
  children,
}: {
  tooltip: string
  className: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  const tooltipState = useTooltip()

  return (
    <span className="relative inline-flex" {...tooltipState.handlers}>
      <button
        type="button"
        onClick={() => {
          tooltipState.dismiss()
          if (disabled) return
          onClick()
        }}
        disabled={disabled}
        className={className}
        aria-label={tooltip}
      >
        {children}
      </button>
      <ViewportTooltip visible={tooltipState.visible} className="whitespace-nowrap">
        {tooltip}
      </ViewportTooltip>
    </span>
  )
}

export default function SearchBar() {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchQuery = useStore((s) => s.searchQuery)
  const setSearchQuery = useStore((s) => s.setSearchQuery)
  const filterStatus = useStore((s) => s.filterStatus)
  const setFilterStatus = useStore((s) => s.setFilterStatus)
  const clearSelection = useStore((s) => s.clearSelection)
  const filterFavorite = useStore((s) => s.filterFavorite)
  const setFilterFavorite = useStore((s) => s.setFilterFavorite)
  const tasks = useStore((s) => s.tasks)
  const conversations = useStore((s) => s.agentConversations)
  const advancedTaskFilters = useStore((s) => s.advancedTaskFilters)
  const setAdvancedTaskFilters = useStore((s) => s.setAdvancedTaskFilters)
  const resetAdvancedTaskFilters = useStore((s) => s.resetAdvancedTaskFilters)
  const activeFavoriteCollectionId = useStore((s) => s.activeFavoriteCollectionId)
  const setActiveFavoriteCollectionId = useStore((s) => s.setActiveFavoriteCollectionId)
  const openManageCollectionsModal = useStore((s) => s.openManageCollectionsModal)
  const failedCount = useStore((s) => {
    const q = s.searchQuery.trim().toLowerCase()
    return s.tasks.filter((task) => {
      if (!taskMatchesFilterStatus(task, 'error')) return false
      if (s.filterFavorite) {
        if (!task.isFavorite) return false
        if (s.activeFavoriteCollectionId && s.activeFavoriteCollectionId !== ALL_FAVORITES_COLLECTION_ID && !getTaskFavoriteCollectionIds(task, s.defaultFavoriteCollectionId).includes(s.activeFavoriteCollectionId)) return false
      }
      if (!taskMatchesAdvancedFilters(task, s.advancedTaskFilters)) return false
      return taskMatchesSearchQuery(task, q)
    }).length
  })
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const inCollectionOverview = filterFavorite && !activeFavoriteCollectionId
  const isFailedFilter = filterStatus === 'error'
  const favoriteTooltip = activeFavoriteCollectionId ? '返回收藏夹' : filterFavorite ? '退出收藏夹' : '收藏夹'
  const modelOptions = useMemo(() => Array.from(new Set(tasks.map((task) => task.apiModel).filter((value): value is string => Boolean(value))))
    .sort((a, b) => a.localeCompare(b))
    .map((model) => ({ label: model, value: model })), [tasks])
  const roundOptions = useMemo(() => conversations.flatMap((conversation) => conversation.rounds.map((round) => ({
    label: `${conversation.title} · 第 ${round.index} 轮`,
    value: round.id,
  }))), [conversations])
  const hasAdvancedFilters = hasTaskAdvancedFilters(advancedTaskFilters)

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (document.activeElement !== inputRef.current) return

      const target = event.target instanceof Element ? event.target : document.elementFromPoint(event.clientX, event.clientY)
      if (!target) return
      if (rootRef.current?.contains(target)) return
      if (!target.closest('[data-drag-select-surface]')) return
      if (target.closest('.task-card-wrapper, .favorite-collection-card-wrapper')) return

      inputRef.current?.blur()
    }

    document.addEventListener('mousedown', handleDocumentMouseDown, true)
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown, true)
  }, [])

  const handleFavoriteClick = () => {
    if (activeFavoriteCollectionId) {
      setActiveFavoriteCollectionId(null)
      return
    }
    setFilterFavorite(!filterFavorite)
  }

  const handleClearFailed = () => {
    const state = useStore.getState()
    const q = state.searchQuery.trim().toLowerCase()
    const failedTaskIds = state.tasks
      .filter((task) => {
        if (!taskMatchesFilterStatus(task, 'error')) return false
        if (state.filterFavorite) {
          if (!task.isFavorite) return false
          if (state.activeFavoriteCollectionId && state.activeFavoriteCollectionId !== ALL_FAVORITES_COLLECTION_ID && !getTaskFavoriteCollectionIds(task, state.defaultFavoriteCollectionId).includes(state.activeFavoriteCollectionId)) return false
        }
        if (!taskMatchesAdvancedFilters(task, state.advancedTaskFilters)) return false
        return taskMatchesSearchQuery(task, q)
      })
      .map((task) => task.id)
    const failedTaskCount = failedTaskIds.length
    if (failedTaskCount === 0) return

    setConfirmDialog({
      title: '清除失败记录',
      message: `确定清除筛选范围内的失败记录吗？\n纯失败任务会被删除；部分失败任务只会清除失败标记，保留已成功图片。共 ${failedTaskCount} 条记录。`,
      confirmText: '清除',
      cancelText: '取消',
      tone: 'danger',
      action: () => clearFailedTasks(failedTaskIds),
    })
  }

  const handleStatusChange = (val: any) => {
    if (val === filterStatus) return
    setFilterStatus(val)
    clearSelection()
  }

  return (
    <div ref={rootRef} data-no-drag-select className="mt-6 mb-4 flex flex-wrap gap-3">
      <div className="flex gap-2 flex-shrink-0 z-20">
        <SearchActionButton
          tooltip={favoriteTooltip}
          onClick={handleFavoriteClick}
          className={`p-2.5 rounded-xl border transition-all ${
            filterFavorite
              ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-500'
              : 'border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06]'
          }`}
        >
          {activeFavoriteCollectionId ? <ChevronLeftIcon className="w-5 h-5" /> : <FavoriteIcon filled={filterFavorite} className="w-5 h-5" />}
        </SearchActionButton>
        {inCollectionOverview && (
          <SearchActionButton
            tooltip="管理收藏夹"
            onClick={openManageCollectionsModal}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-all"
          >
            <CollectionManageIcon className="w-5 h-5" />
          </SearchActionButton>
        )}
        {!inCollectionOverview && (
          <>
            <div className="relative w-[88px]">
              <Select
                value={filterStatus}
                onChange={handleStatusChange}
                options={[
                  { label: '全部', value: 'all' },
                  { label: '已完成', value: 'done' },
                  { label: '生成中', value: 'running' },
                  { label: '失败', value: 'error' },
                ]}
                className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-white/[0.06] text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 transition"
              />
            </div>
            {isFailedFilter && (
              <button
                type="button"
                onClick={handleClearFailed}
                disabled={failedCount === 0}
                title={failedCount > 0 ? `清除 ${failedCount} 条失败记录` : '没有失败记录'}
                aria-label={failedCount > 0 ? `清除 ${failedCount} 条失败记录` : '没有失败记录'}
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-white disabled:hover:text-gray-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-500 dark:hover:bg-white/[0.06] dark:hover:text-gray-300 dark:disabled:hover:bg-gray-900 dark:disabled:hover:text-gray-500"
              >
                <TrashIcon className="h-[18px] w-[18px]" />
              </button>
            )}
          </>
        )}
      </div>
      <div className="relative z-10 min-w-[14rem] flex-1">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          type="text"
          placeholder={inCollectionOverview ? '搜索收藏夹名称...' : '搜索提示词、参数...'}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 transition"
        />
      </div>
      {!inCollectionOverview && (
        <div className="flex w-full flex-wrap items-center gap-2">
          <div className="w-[112px]">
            <Select
              value={advancedTaskFilters.source}
              onChange={(source) => setAdvancedTaskFilters({ source, ...(source === 'agent' ? {} : { agentRoundId: '' }) })}
              options={[
                { label: '全部来源', value: 'all' },
                { label: '画廊', value: 'gallery' },
                { label: 'Agent', value: 'agent' },
              ]}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs dark:border-white/[0.08] dark:bg-gray-900"
            />
          </div>
          <div className="min-w-[140px] max-w-[220px] flex-1">
            <Select
              value={advancedTaskFilters.model}
              onChange={(model) => setAdvancedTaskFilters({ model })}
              options={[{ label: '全部模型', value: '' }, ...modelOptions]}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs dark:border-white/[0.08] dark:bg-gray-900"
            />
          </div>
          <div className="w-[110px]">
            <Select
              value={advancedTaskFilters.date}
              onChange={(date) => setAdvancedTaskFilters({ date })}
              options={[
                { label: '全部日期', value: 'all' },
                { label: '今天', value: 'today' },
                { label: '近 7 天', value: '7d' },
                { label: '近 30 天', value: '30d' },
              ]}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs dark:border-white/[0.08] dark:bg-gray-900"
            />
          </div>
          <div className="min-w-[160px] max-w-[260px] flex-1">
            <Select
              value={advancedTaskFilters.agentRoundId}
              onChange={(agentRoundId) => setAdvancedTaskFilters({ agentRoundId, source: agentRoundId ? 'agent' : advancedTaskFilters.source })}
              options={[{ label: '全部 Agent 轮次', value: '' }, ...roundOptions]}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs dark:border-white/[0.08] dark:bg-gray-900"
            />
          </div>
          {hasAdvancedFilters && (
            <button
              type="button"
              onClick={resetAdvancedTaskFilters}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            >
              清除高级筛选
            </button>
          )}
        </div>
      )}
    </div>
  )
}
