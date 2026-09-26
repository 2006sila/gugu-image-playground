/**
 * 无限画布编辑器（融合版）
 * 轻量自研画布引擎：
 * - 视口：滚轮缩放（以鼠标为中心）、空格/中键拖拽平移
 * - 节点：图片（上传/生成结果）、文本便签、配置节点（prompt + 模型 + 生成）
 * - 连线：从图片节点拖到配置节点（或反向），表示"作为参考图"
 * - 生成：配置节点按连线收集参考图 → PG 的 callImageApi → 结果落为新图片节点
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Plus, Trash2, Play, ImagePlus, StickyNote, Settings2, Loader2 } from 'lucide-react'
import {
  useCanvasStore,
  collectReferences,
  type CanvasNode,
} from '../../lib/canvasStore'
import { callImageApi } from '../../lib/api'
import { normalizeSettings } from '../../lib/apiProfiles'
import { useStore } from '../../store'

const NODE_W = 220

interface Props {
  open: boolean
  onClose: () => void
}

export default function CanvasModal({ open, onClose }: Props) {
  const canvasStore = useCanvasStore()
  const { projects, activeId } = canvasStore
  const project = projects.find((p) => p.id === activeId) ?? null

  const containerRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ x: 0, y: 0, k: 1 })
  const [dragNode, setDragNode] = useState<{ id: string; dx: number; dy: number } | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null)
  const [panning, setPanning] = useState<{ sx: number; sy: number } | null>(null)

  useEffect(() => {
    if (open && !project && projects.length === 0) {
      canvasStore.createProject()
    } else if (open && !project && projects.length > 0) {
      canvasStore.setActive(projects[0].id)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - viewport.x) / viewport.k,
      y: (clientY - rect.top - viewport.y) / viewport.k,
    }
  }, [viewport])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    setViewport((v) => {
      const k = Math.min(3, Math.max(0.15, v.k * factor))
      return {
        k,
        x: mx - ((mx - v.x) / v.k) * k,
        y: my - ((my - v.y) / v.k) * k,
      }
    })
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey || e.target === containerRef.current) {
      setPanning({ sx: e.clientX - viewport.x, sy: e.clientY - viewport.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (panning) {
      setViewport((v) => ({ ...v, x: e.clientX - panning.sx, y: e.clientY - panning.sy }))
      return
    }
    if (dragNode && project) {
      const world = toWorld(e.clientX, e.clientY)
      canvasStore.updateNode(project.id, dragNode.id, { x: world.x - dragNode.dx, y: world.y - dragNode.dy })
    }
  }

  const handleMouseUp = () => {
    setPanning(null)
    setDragNode(null)
  }

  if (!open) return null

  const addImageNode = async () => {
    if (!project) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        canvasStore.addNode(project.id, {
          id: `cn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'image',
          x: -viewport.x / viewport.k + 100,
          y: -viewport.y / viewport.k + 100,
          width: NODE_W,
          height: NODE_W,
          content: String(reader.result),
        })
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const addTextNode = () => {
    if (!project) return
    canvasStore.addNode(project.id, {
      id: `cn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'text',
      x: -viewport.x / viewport.k + 100,
      y: -viewport.y / viewport.k + 100,
      width: 180,
      height: 60,
      content: '双击编辑',
    })
  }

  const addConfigNode = () => {
    if (!project) return
    canvasStore.addNode(project.id, {
      id: `cn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'config',
      x: -viewport.x / viewport.k + 150,
      y: -viewport.y / viewport.k + 150,
      width: 280,
      height: 180,
      prompt: '',
      status: 'idle',
    })
  }

  const runConfigNode = async (node: CanvasNode) => {
    if (!project || !node.prompt?.trim()) return
    canvasStore.updateNode(project.id, node.id, { status: 'loading' })
    try {
      const state = useStore.getState()
      const refs = collectReferences(project, node.id)
      const result = await callImageApi({
        settings: normalizeSettings(state.settings),
        prompt: node.prompt,
        params: { ...state.params, n: 1, size: '1024x1024' },
        inputImageDataUrls: refs,
      })
      const imageDataUrl = result.images[0]
      if (!imageDataUrl) throw new Error('没有返回图像')
      const newX = node.x + node.width + 60
      canvasStore.addNode(project.id, {
        id: `cn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'image',
        x: newX,
        y: node.y,
        width: NODE_W,
        height: NODE_W,
        content: imageDataUrl,
      })
      // 自动连线：生成结果作为下一环（可手动删除）
      canvasStore.updateNode(project.id, node.id, { status: 'done' })
    } catch (err) {
      canvasStore.updateNode(project.id, node.id, { status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }

  const startConnect = (nodeId: string) => {
    setConnectFrom(connectFrom === nodeId ? null : nodeId)
  }

  const handleCanvasClickForConnect = (targetNodeId: string) => {
    if (!connectFrom || !project || connectFrom === targetNodeId) return
    canvasStore.addConnection(project.id, { from: connectFrom, to: targetNodeId })
    setConnectFrom(null)
  }

  return (
    <div className="fixed inset-0 z-[190] flex flex-col bg-zinc-950" onClick={(e) => e.stopPropagation()}>
      {/* 顶栏 */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200"
            value={activeId ?? ''}
            onChange={(e) => canvasStore.setActive(e.target.value || null)}
          >
            {projects.length === 0 && <option value="">（无画布）</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <button
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
            onClick={() => canvasStore.createProject()}
          ><Plus className="mr-1 inline h-3 w-3" />新建</button>
          {project && (
            <button
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-red-400 hover:bg-zinc-800"
              onClick={() => { canvasStore.deleteProject(project.id); }}
            ><Trash2 className="mr-1 inline h-3 w-3" />删除画布</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {project && (
            <>
              <button className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700" onClick={addImageNode}>
                <ImagePlus className="h-3.5 w-3.5" />图片
              </button>
              <button className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700" onClick={addTextNode}>
                <StickyNote className="h-3.5 w-3.5" />便签
              </button>
              <button className="flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-500" onClick={addConfigNode}>
                <Settings2 className="h-3.5 w-3.5" />生成节点
              </button>
            </>
          )}
          <button className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 画布区域 */}
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ cursor: panning ? 'grabbing' : 'default', background: 'radial-gradient(circle, #27272a 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!project ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            创建或选择一个画布开始
          </div>
        ) : (
          <div
            className="absolute left-0 top-0"
            style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.k})`, transformOrigin: '0 0' }}
          >
            {/* 连线（SVG） */}
            <svg className="pointer-events-none absolute left-0 top-0 h-1 w-1 overflow-visible" style={{ width: 1, height: 1 }}>
              {project.connections.map((conn) => {
                const from = project.nodes.find((n) => n.id === conn.from)
                const to = project.nodes.find((n) => n.id === conn.to)
                if (!from || !to) return null
                const x1 = from.x + from.width
                const y1 = from.y + from.height / 2
                const x2 = to.x
                const y2 = to.y + to.height / 2
                return (
                  <path
                    key={conn.id}
                    d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fill="none"
                  />
                )
              })}
            </svg>

            {/* 节点 */}
            {project.nodes.map((node) => (
              <div
                key={node.id}
                className={`absolute rounded-xl shadow-lg ${node.type === 'config' ? 'bg-zinc-800 border border-sky-500/40' : 'bg-zinc-800 border border-zinc-700'}`}
                style={{ left: node.x, top: node.y, width: node.width, minHeight: 40 }}
                onMouseDown={(e) => {
                  if ((e.target as HTMLElement).closest('button, textarea, input, select')) return
                  setDragNode({ id: node.id, dx: toWorld(e.clientX, e.clientY).x - node.x, dy: toWorld(e.clientY, e.clientY).y - node.y })
                }}
                onClick={() => {
                  if (connectFrom && connectFrom !== node.id) handleCanvasClickForConnect(node.id)
                  else if (node.type === 'config') setSelectedConfig(node.id)
                }}
              >
                {/* 节点内容 */}
                {node.type === 'image' && node.content && (
                  <img src={node.content} className="w-full rounded-xl object-cover" style={{ height: node.height }} alt="" draggable={false} />
                )}
                {node.type === 'text' && (
                  <textarea
                    className="w-full resize-none rounded-xl bg-yellow-100/90 p-2 text-xs text-zinc-800 outline-none"
                    style={{ height: node.height }}
                    value={node.content ?? ''}
                    onChange={(e) => canvasStore.updateNode(project.id, node.id, { content: e.target.value })}
                  />
                )}
                {node.type === 'config' && (
                  <div className="space-y-1.5 p-2.5">
                    <div className="flex items-center justify-between text-[10px] font-medium text-sky-400">
                      <span>生成节点</span>
                      {node.status === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                    <textarea
                      className="w-full resize-none rounded-md bg-zinc-900 p-2 text-[11px] text-zinc-200 outline-none"
                      style={{ height: 90 }}
                      placeholder="输入生成提示词…"
                      value={node.prompt ?? ''}
                      onChange={(e) => canvasStore.updateNode(project.id, node.id, { prompt: e.target.value })}
                    />
                    <div className="flex items-center justify-between">
                      <button
                        className="flex items-center gap-1 rounded bg-sky-600 px-2 py-1 text-[10px] text-white hover:bg-sky-500 disabled:opacity-40"
                        disabled={node.status === 'loading' || !node.prompt?.trim()}
                        onClick={(e) => { e.stopPropagation(); void runConfigNode(node) }}
                      >
                        <Play className="h-2.5 w-2.5" />生成
                      </button>
                      {node.status === 'error' && <span className="truncate text-[9px] text-red-400" title={node.error}>失败</span>}
                    </div>
                  </div>
                )}

                {/* 连线/删除操作条 */}
                <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 gap-1 opacity-0 transition group-hover:opacity-100" style={{ opacity: connectFrom ? 1 : undefined }}>
                  {node.type === 'image' && (
                    <button
                      className={`rounded-full px-2 py-0.5 text-[9px] ${connectFrom === node.id ? 'bg-sky-500 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
                      onClick={(e) => { e.stopPropagation(); startConnect(node.id) }}
                    >
                      {connectFrom === node.id ? '点击目标节点' : '连线'}
                    </button>
                  )}
                  <button
                    className="rounded-full bg-red-500/80 px-1.5 py-0.5 text-[9px] text-white hover:bg-red-500"
                    onClick={(e) => { e.stopPropagation(); canvasStore.removeNode(project.id, node.id) }}
                  >×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 底部提示 */}
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-[11px] text-zinc-400">
          滚轮缩放 · Alt/中键拖拽平移 · 图片节点点「连线」→ 点生成节点作为参考图
        </div>
      </div>
    </div>
  )
}
