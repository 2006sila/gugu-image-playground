import type { TaskRecord } from '../types'

export interface TaskVersionInfo {
  groupId: string
  index: number
  count: number
  label: string
}

export function getTaskVersionGroupId(task: TaskRecord) {
  return task.versionGroupId ?? task.retryOfTaskId ?? task.id
}

export function createTaskRetryVersionMeta(task: TaskRecord): Pick<TaskRecord, 'retryOfTaskId' | 'retryAttempt' | 'versionGroupId'> {
  return {
    retryOfTaskId: task.id,
    retryAttempt: Math.max(0, task.retryAttempt ?? 0) + 1,
    versionGroupId: getTaskVersionGroupId(task),
  }
}

export function getTaskVersions(task: TaskRecord, tasks: TaskRecord[]) {
  const groupId = getTaskVersionGroupId(task)
  return tasks
    .filter((item) => getTaskVersionGroupId(item) === groupId)
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
}

export function getTaskVersionInfo(task: TaskRecord, tasks: TaskRecord[]): TaskVersionInfo | null {
  const groupId = getTaskVersionGroupId(task)
  const versions = getTaskVersions(task, tasks)
  if (versions.length <= 1) return null

  const index = versions.findIndex((item) => item.id === task.id)
  if (index < 0) return null
  return {
    groupId,
    index,
    count: versions.length,
    label: `版本 ${index + 1}/${versions.length}`,
  }
}
