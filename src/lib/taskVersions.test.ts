import { describe, expect, it } from 'vitest'
import type { TaskRecord } from '../types'
import { DEFAULT_PARAMS } from '../types'
import { createTaskRetryVersionMeta, getTaskVersionGroupId, getTaskVersionInfo } from './taskVersions'

function task(id: string, patch: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id,
    prompt: 'prompt',
    params: { ...DEFAULT_PARAMS },
    inputImageIds: [],
    outputImages: [],
    status: 'done',
    error: null,
    createdAt: Number(id.replace('task-', '')) || 1,
    finishedAt: 2,
    elapsed: 1,
    ...patch,
  }
}

describe('task versions', () => {
  it('creates a retry version linked to the original group', () => {
    const source = task('task-1', { retryAttempt: 2, versionGroupId: 'group-1' })
    expect(createTaskRetryVersionMeta(source)).toEqual({
      retryOfTaskId: 'task-1',
      retryAttempt: 3,
      versionGroupId: 'group-1',
    })
  })

  it('derives a stable group for legacy tasks without version metadata', () => {
    const source = task('task-legacy', { retryOfTaskId: 'task-root' })
    expect(getTaskVersionGroupId(source)).toBe('task-root')
  })

  it('returns chronological labels for all tasks in one version chain', () => {
    const tasks = [
      task('task-3', { versionGroupId: 'group-1', retryAttempt: 2, createdAt: 30, retryOfTaskId: 'task-2' }),
      task('task-1', { versionGroupId: 'group-1', retryAttempt: 0, createdAt: 10 }),
      task('task-2', { versionGroupId: 'group-1', retryAttempt: 1, createdAt: 20, retryOfTaskId: 'task-1' }),
    ]

    expect(getTaskVersionInfo(tasks[0], tasks)).toMatchObject({ index: 2, count: 3, label: '版本 3/3' })
    expect(getTaskVersionInfo(tasks[1], tasks)).toMatchObject({ index: 0, count: 3, label: '版本 1/3' })
  })

  it('does not label an isolated task as a version', () => {
    const source = task('task-1')
    expect(getTaskVersionInfo(source, [source])).toBeNull()
  })
})
