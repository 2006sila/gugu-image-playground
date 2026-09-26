/**
 * 融合版可选后端：任务队列 + SSE 状态推送 + 静态托管
 *
 * 定位：可选组件。不用它 = 纯前端模式（浏览器直连 API，行为与 PG 原版一致）。
 * 用它（npm run server）= 获得服务端任务队列能力：
 *   - 提交任务后可关闭浏览器，服务端继续跑，结果落盘 backend/data/
 *   - SSE 实时推送任务状态
 *   - 同源 /api-proxy 转发（解决 CORS + key 不落前端日志）
 *
 * 启动：node server/server.js  （默认端口 8787，环境变量 PORT 可改）
 * 前端检测：同源存在 /api/server-info 时自动显示"服务器模式"标识（当前为手动感知）。
 */

import express from 'express'
import { randomUUID } from 'crypto'
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

const PORT = Number(process.env.PORT || 8787)
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'server', 'data')
const IMAGE_DIR = join(DATA_DIR, 'images')
const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY || 4)
const TASK_TTL_MS = 24 * 3600 * 1000

mkdirSync(IMAGE_DIR, { recursive: true })

const app = express()
app.use(express.json({ limit: '256mb' }))

// ===== 简易静态托管 dist（若存在）=====
const DIST_DIR = resolve(process.cwd(), 'dist')
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
}

// ===== API 代理（/api-proxy/* -> 上游）=====
app.use('/api-proxy', (req, res) => {
  const target = req.headers['x-fusion-target']
  if (!target || typeof target !== 'string') {
    res.status(400).json({ error: 'Missing x-fusion-target header' })
    return
  }
  const url = new URL(req.url, target)
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', async () => {
    try {
      const headers = { 'Content-Type': req.headers['content-type'] || 'application/json' }
      const auth = req.headers['x-fusion-auth']
      if (auth) headers['Authorization'] = `Bearer ${String(auth)}`
      const resp = await fetch(url.href, {
        method: req.method,
        headers,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      })
      res.status(resp.status)
      const contentType = resp.headers.get('content-type')
      if (contentType) res.setHeader('Content-Type', contentType)
      const buffer = Buffer.from(await resp.arrayBuffer())
      res.send(buffer)
    } catch (err) {
      res.status(502).json({ error: String(err) })
    }
  })
})

// ===== 任务队列 =====
/** @type {Map<string, {id,status,prompt,images,error,createdAt,finishedAt}>} */
const tasks = new Map()
let active = 0
const waitQueue = []

function saveTaskImage(taskId, index, base64) {
  const dir = join(IMAGE_DIR, taskId)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${index}.png`)
  writeFileSync(file, Buffer.from(base64, 'base64'))
  return `/api/tasks/${taskId}/images/${index}`
}

async function runTask(task) {
  active++
  try {
    const { profile, payload } = task.request
    const base = profile.baseUrl.replace(/\/v\d+$/, '')
    const isEdit = (payload.images || []).length > 0
    const endpoint = isEdit ? '/v1/images/generations' : '/v1/images/generations'
    const body = {
      model: profile.model,
      prompt: payload.prompt,
      n: payload.n || 1,
      ...(payload.size && payload.size !== 'auto' ? { size: payload.size } : {}),
    }
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${profile.apiKey}` }
    // 图生图走 edits（multipart 需要文件，简单实现：JSON b64 模式，多数兼容网关支持）
    let url = `${base}${endpoint}`
    let bodyStr = JSON.stringify(body)
    if (isEdit) {
      url = `${base}/v1/images/edits`
      const form = new FormData()
      form.append('model', profile.model)
      form.append('prompt', payload.prompt)
      if (payload.size && payload.size !== 'auto') form.append('size', payload.size)
      payload.images.forEach((dataUrl, i) => {
        const match = /^data:([^;,]+)?;base64,(.*)$/i.exec(dataUrl)
        const mime = match?.[1] || 'image/png'
        const b64 = match?.[2] || dataUrl
        form.append('image', new Blob([Buffer.from(b64, 'base64')], { type: mime }), `image-${i}.png`)
      })
      delete headers['Content-Type']
      bodyStr = form
    }
    const resp = await fetch(url, { method: 'POST', headers, body: bodyStr })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`上游 ${resp.status}: ${text.slice(0, 300)}`)
    }
    const data = await resp.json()
    const images = []
    for (const item of data.data || []) {
      if (item.b64_json) {
        const url0 = saveTaskImage(task.id, images.length, item.b64_json)
        images.push(url0)
      } else if (item.url) {
        images.push(item.url)
      }
    }
    task.images = images
    task.status = 'completed'
  } catch (err) {
    task.status = 'failed'
    task.error = String(err)
  } finally {
    task.finishedAt = Date.now()
    active--
    drain()
    notify(task.id)
  }
}

function drain() {
  while (active < MAX_CONCURRENCY && waitQueue.length > 0) {
    const task = waitQueue.shift()
    void runTask(task)
  }
}

function notify(taskId) {
  const payload = `data: ${JSON.stringify(tasks.get(taskId))}\n\n`
  for (const res of subscribers.get(taskId) || []) {
    res.write(payload)
  }
  // 广播队列摘要
  const summary = `data: ${JSON.stringify({ type: 'summary', queued: waitQueue.length, active })}\n\n`
  for (const res of allSubscribers) res.write(summary)
}

/** @type {Map<string, Set<import('express').Response>>} */
const subscribers = new Map()
const allSubscribers = new Set()

// ===== 路由 =====
app.get('/api/server-info', (_req, res) => {
  res.json({ server: 'fusion', version: 1, queued: waitQueue.length, active, tasks: tasks.size })
})

app.post('/api/tasks', (req, res) => {
  const { profile, payload } = req.body || {}
  if (!profile?.baseUrl || !payload?.prompt) {
    res.status(400).json({ error: 'Missing profile or payload' })
    return
  }
  const task = {
    id: randomUUID(),
    status: 'queued',
    prompt: payload.prompt,
    images: [],
    error: null,
    createdAt: Date.now(),
    finishedAt: null,
    request: req.body,
  }
  tasks.set(task.id, task)
  waitQueue.push(task)
  drain()
  res.json({ id: task.id, status: task.status })
})

app.get('/api/tasks/:id', (req, res) => {
  const task = tasks.get(req.params.id)
  if (!task) { res.status(404).json({ error: 'not found' }); return }
  res.json({ id: task.id, status: task.status, images: task.images, error: task.error })
})

app.get('/api/tasks/:id/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  if (!subscribers.has(req.params.id)) subscribers.set(req.params.id, new Set())
  subscribers.get(req.params.id).add(res)
  req.on('close', () => subscribers.get(req.params.id)?.delete(res))
})

app.get('/api/tasks/:id/images/:index', (req, res) => {
  // 防路径穿越：id/index 只允许安全字符
  const id = String(req.params.id || '')
  const index = String(req.params.index || '')
  if (!/^[a-f0-9-]+$/i.test(id) || !/^\d+$/.test(index)) {
    res.status(400).end()
    return
  }
  const file = join(IMAGE_DIR, id, `${index}.png`)
  if (!file.startsWith(IMAGE_DIR) || !existsSync(file)) { res.status(404).end(); return }
  res.setHeader('Content-Type', 'image/png')
  res.send(readFileSync(file))
})

// 定期清理过期任务
setInterval(() => {
  const now = Date.now()
  for (const [id, task] of tasks) {
    if (task.finishedAt && now - task.finishedAt > TASK_TTL_MS) {
      tasks.delete(id)
      subscribers.delete(id)
    }
  }
}, 5 * 60 * 1000)

app.listen(PORT, () => {
  console.log(`[fusion-server] listening on http://localhost:${PORT}`)
  console.log(`[fusion-server] task queue: max ${MAX_CONCURRENCY} concurrent, TTL 24h`)
  if (existsSync(DIST_DIR)) console.log(`[fusion-server] serving static dist/`)
})
