import type { TaskAdvancedFilters, TaskRecord } from '../types'

export const DEFAULT_TASK_ADVANCED_FILTERS: TaskAdvancedFilters = {
  source: 'all',
  model: '',
  date: 'all',
  agentRoundId: '',
}

export function isAgentSourceTask(task: TaskRecord) {
  return task.sourceMode === 'agent' || Boolean(task.agentConversationId || task.agentRoundId)
}

export function taskMatchesAdvancedFilters(task: TaskRecord, filters: TaskAdvancedFilters, now = Date.now()) {
  const isAgent = isAgentSourceTask(task)
  if (filters.source === 'agent' && !isAgent) return false
  if (filters.source === 'gallery' && isAgent) return false
  if (filters.model && task.apiModel !== filters.model) return false
  if (filters.agentRoundId && task.agentRoundId !== filters.agentRoundId) return false

  if (filters.date !== 'all') {
    const age = Math.max(0, now - task.createdAt)
    if (filters.date === 'today') {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      if (task.createdAt < start.getTime()) return false
    } else {
      const days = filters.date === '7d' ? 7 : 30
      if (age > days * 24 * 60 * 60 * 1000) return false
    }
  }
  return true
}

export function hasTaskAdvancedFilters(filters: TaskAdvancedFilters) {
  return filters.source !== 'all' || Boolean(filters.model) || filters.date !== 'all' || Boolean(filters.agentRoundId)
}
