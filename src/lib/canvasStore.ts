/**
 * 无限画布状态管理（融合版）
 * 轻量自研：图片节点 / 文本节点 / 配置节点 / 连线，zustand 持久化到 localStorage。
 * 生成走 PG 的 callImageApi（支持全部已配置供应商，包括 Gemini/Grok 直连）。
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CanvasNodeType = 'image' | 'text' | 'config'

export interface CanvasNode {
  id: string
  type: CanvasNodeType
  x: number
  y: number
  width: number
  height: number
  /** image: data URL；text: 文本内容；config: prompt */
  content?: string
  prompt?: string
  modelProfileId?: string
  aspectRatio?: string
  status?: 'idle' | 'loading' | 'done' | 'error'
  error?: string
}

export interface CanvasConnection {
  id: string
  /** from 节点输出 -> to 配置节点输入 */
  from: string
  to: string
}

export interface CanvasProject {
  id: string
  title: string
  nodes: CanvasNode[]
  connections: CanvasConnection[]
  viewport: { x: number; y: number; k: number }
  createdAt: number
  updatedAt: number
}

interface CanvasState {
  projects: CanvasProject[]
  activeId: string | null
  createProject: (title?: string) => string
  deleteProject: (id: string) => void
  setActive: (id: string | null) => void
  renameProject: (id: string, title: string) => void
  updateProject: (id: string, patch: Partial<CanvasProject>) => void
  addNode: (projectId: string, node: CanvasNode) => void
  updateNode: (projectId: string, nodeId: string, patch: Partial<CanvasNode>) => void
  removeNode: (projectId: string, nodeId: string) => void
  addConnection: (projectId: string, conn: Omit<CanvasConnection, 'id'>) => void
  removeConnection: (projectId: string, connId: string) => void
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeId: null,
      createProject: (title) => {
        const id = genId('cp')
        const now = Date.now()
        set((s) => ({
          projects: [
            ...s.projects,
            { id, title: title || `画布 ${s.projects.length + 1}`, nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 }, createdAt: now, updatedAt: now },
          ],
          activeId: id,
        }))
        return id
      },
      deleteProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id), activeId: s.activeId === id ? null : s.activeId })),
      setActive: (id) => set({ activeId: id }),
      renameProject: (id, title) => {
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, title } : p)) }))
      },
      updateProject: (id, patch) => {
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)) }))
      },
      addNode: (projectId, node) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId ? { ...p, nodes: [...p.nodes, node], updatedAt: Date.now() } : p,
          ),
        }))
      },
      updateNode: (projectId, nodeId, patch) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId
              ? { ...p, nodes: p.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)), updatedAt: Date.now() }
              : p,
          ),
        }))
      },
      removeNode: (projectId, nodeId) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  nodes: p.nodes.filter((n) => n.id !== nodeId),
                  connections: p.connections.filter((c) => c.from !== nodeId && c.to !== nodeId),
                  updatedAt: Date.now(),
                }
              : p,
          ),
        }))
      },
      addConnection: (projectId, conn) => {
        const project = get().projects.find((p) => p.id === projectId)
        if (!project) return
        const exists = project.connections.some((c) => c.from === conn.from && c.to === conn.to)
        if (exists) return
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId ? { ...p, connections: [...p.connections, { ...conn, id: genId('cc') }], updatedAt: Date.now() } : p,
          ),
        }))
      },
      removeConnection: (projectId, connId) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId ? { ...p, connections: p.connections.filter((c) => c.id !== connId), updatedAt: Date.now() } : p,
          ),
        }))
      },
    }),
    { name: 'fusion-canvas' },
  ),
)

/** 收集配置节点的所有参考图（沿连线回溯 image 节点） */
export function collectReferences(project: CanvasProject, configNodeId: string): string[] {
  const refs: string[] = []
  const visit = (nodeId: string, depth: number): void => {
    if (depth > 8) return
    for (const conn of project.connections) {
      if (conn.to !== nodeId) continue
      const from = project.nodes.find((n) => n.id === conn.from)
      if (!from) continue
      if (from.type === 'image' && from.content) refs.push(from.content)
      else if (from.type === 'config') visit(from.id, depth + 1)
    }
  }
  visit(configNodeId, 0)
  return refs
}
