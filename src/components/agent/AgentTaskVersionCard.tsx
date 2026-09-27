import { useEffect, useMemo, useRef, useState } from 'react'
import type { TaskRecord } from '../../types'
import { getTaskVersionGroupId, getTaskVersions } from '../../lib/taskVersions'
import TaskCard from '../TaskCard'

interface Props {
  task: TaskRecord
  allTasks: TaskRecord[]
  onOpen: (task: TaskRecord) => void
  onPreview: (task: TaskRecord) => void
  onDownload: (task: TaskRecord) => void
  onAddToAssets: (task: TaskRecord) => void
  onContinueEdit: (task: TaskRecord) => void
  onReuse: (task: TaskRecord) => void
  onEditOutputs: (task: TaskRecord) => void
  onDelete: (task: TaskRecord) => void
  onCancel?: (task: TaskRecord) => void
}

function getVersionStatusClass(task: TaskRecord) {
  if (task.status === 'running') return 'bg-blue-500'
  if (task.status === 'error' && (task.falRecoverable || task.customRecoverable)) return 'bg-amber-500'
  if (task.status === 'error') return 'bg-red-500'
  return 'bg-emerald-500'
}

export default function AgentTaskVersionCard({
  task,
  allTasks,
  onOpen,
  onPreview,
  onDownload,
  onAddToAssets,
  onContinueEdit,
  onReuse,
  onEditOutputs,
  onDelete,
  onCancel,
}: Props) {
  const groupId = getTaskVersionGroupId(task)
  const versions = useMemo(() => getTaskVersions(task, allTasks), [allTasks, groupId, task])
  const [selectedTaskId, setSelectedTaskId] = useState(() => versions[versions.length - 1]?.id ?? task.id)
  const previousVersionCountRef = useRef(versions.length)

  useEffect(() => {
    const latestTaskId = versions[versions.length - 1]?.id ?? task.id
    if (versions.length > previousVersionCountRef.current || !versions.some((item) => item.id === selectedTaskId)) {
      setSelectedTaskId(latestTaskId)
    }
    previousVersionCountRef.current = versions.length
  }, [selectedTaskId, task.id, versions])

  const selectedTask = versions.find((item) => item.id === selectedTaskId) ?? versions[versions.length - 1] ?? task

  return (
    <div className="w-full max-w-sm">
      {versions.length > 1 && (
        <div className="mb-2 rounded-xl border border-purple-100 bg-purple-50/60 p-2 dark:border-purple-500/15 dark:bg-purple-500/[0.05]">
          <div className="mb-1.5 flex items-center justify-between px-1 text-[11px] text-purple-600 dark:text-purple-300">
            <span className="font-medium">版本历史</span>
            <span>{versions.length} 个版本</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
            {versions.map((version, index) => {
              const selected = version.id === selectedTask.id
              return (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => setSelectedTaskId(version.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                    selected
                      ? 'border-purple-400 bg-white text-purple-700 shadow-sm dark:border-purple-400/60 dark:bg-purple-500/15 dark:text-purple-200'
                      : 'border-transparent bg-white/60 text-gray-500 hover:border-purple-200 hover:text-purple-600 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:border-purple-500/20 dark:hover:text-purple-300'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${getVersionStatusClass(version)}`} />
                  版本 {index + 1}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <TaskCard
        task={selectedTask}
        allTasks={allTasks}
        disableSwipe={true}
        onClick={() => onOpen(selectedTask)}
        onPreview={() => onPreview(selectedTask)}
        onDownload={() => onDownload(selectedTask)}
        onAddToAssets={() => onAddToAssets(selectedTask)}
        onContinueEdit={() => onContinueEdit(selectedTask)}
        onReuse={() => onReuse(selectedTask)}
        onEditOutputs={() => onEditOutputs(selectedTask)}
        onDelete={() => onDelete(selectedTask)}
        onCancel={onCancel ? () => onCancel(selectedTask) : undefined}
      />
    </div>
  )
}
