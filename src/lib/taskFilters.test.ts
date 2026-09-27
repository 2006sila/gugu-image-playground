import { describe, expect, it } from 'vitest'
import type { TaskAdvancedFilters, TaskRecord } from '../types'
import { DEFAULT_PARAMS } from '../types'
import { DEFAULT_TASK_ADVANCED_FILTERS, hasTaskAdvancedFilters, isAgentSourceTask, taskMatchesAdvancedFilters } from './taskFilters'

function task(patch: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-a',
    prompt: 'prompt',
    params: { ...DEFAULT_PARAMS },
    inputImageIds: [],
    outputImages: [],
    status: 'done',
    error: null,
    createdAt: 1_700_000_000_000,
    finishedAt: 1_700_000_001_000,
    elapsed: 1_000,
    ...patch,
  }
}

function filters(patch: Partial<TaskAdvancedFilters> = {}): TaskAdvancedFilters {
  return { ...DEFAULT_TASK_ADVANCED_FILTERS, ...patch }
}

describe('task advanced filters', () => {
  it('detects Agent tasks from source and legacy relationship fields', () => {
    expect(isAgentSourceTask(task({ sourceMode: 'agent' }))).toBe(true)
    expect(isAgentSourceTask(task({ agentRoundId: 'round-a' }))).toBe(true)
    expect(isAgentSourceTask(task({ sourceMode: 'gallery' }))).toBe(false)
  })

  it('filters by source, model and Agent round', () => {
    const value = task({ sourceMode: 'agent', apiModel: 'image-model', agentRoundId: 'round-a' })
    expect(taskMatchesAdvancedFilters(value, filters({ source: 'agent', model: 'image-model', agentRoundId: 'round-a' }))).toBe(true)
    expect(taskMatchesAdvancedFilters(value, filters({ source: 'gallery' }))).toBe(false)
    expect(taskMatchesAdvancedFilters(value, filters({ model: 'other-model' }))).toBe(false)
    expect(taskMatchesAdvancedFilters(value, filters({ agentRoundId: 'round-b' }))).toBe(false)
  })

  it('filters today and rolling date ranges', () => {
    const now = new Date('2026-09-27T12:00:00').getTime()
    expect(taskMatchesAdvancedFilters(task({ createdAt: new Date('2026-09-27T01:00:00').getTime() }), filters({ date: 'today' }), now)).toBe(true)
    expect(taskMatchesAdvancedFilters(task({ createdAt: new Date('2026-09-26T23:59:59').getTime() }), filters({ date: 'today' }), now)).toBe(false)
    expect(taskMatchesAdvancedFilters(task({ createdAt: now - 6 * 24 * 60 * 60 * 1000 }), filters({ date: '7d' }), now)).toBe(true)
    expect(taskMatchesAdvancedFilters(task({ createdAt: now - 8 * 24 * 60 * 60 * 1000 }), filters({ date: '7d' }), now)).toBe(false)
  })

  it('reports whether any advanced filter is active', () => {
    expect(hasTaskAdvancedFilters(filters())).toBe(false)
    expect(hasTaskAdvancedFilters(filters({ source: 'agent' }))).toBe(true)
    expect(hasTaskAdvancedFilters(filters({ model: 'model-a' }))).toBe(true)
  })
})
