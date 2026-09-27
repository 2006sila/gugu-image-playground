import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const host = '127.0.0.1'
const firstPort = Number(process.env.PORT) || 4173
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app')
const indexFile = join(appRoot, 'index.html')

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function resolveRequestFile(requestUrl) {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(requestUrl || '/', 'http://localhost').pathname)
  } catch {
    return null
  }

  const relativePath = normalize(pathname.replace(/^[/\\]+/, ''))
  const candidate = resolve(appRoot, relativePath)
  if (candidate !== appRoot && !candidate.startsWith(`${appRoot}${sep}`)) return null
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  if (!extname(relativePath)) return indexFile
  return null
}

function sendFile(req, res, filePath) {
  const stat = statSync(filePath)
  res.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': filePath === indexFile ? 'no-cache' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(filePath).pipe(res)
}

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' })
    res.end('Method Not Allowed')
    return
  }

  const filePath = resolveRequestFile(req.url)
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not Found')
    return
  }

  try {
    sendFile(req, res, filePath)
  } catch (error) {
    console.error(error)
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Internal Server Error')
  }
})

function listen(port) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < firstPort + 20) {
      listen(port + 1)
      return
    }
    console.error(`启动失败：${error.message}`)
    process.exitCode = 1
  })
  server.listen(port, host, () => {
    const url = `http://${host}:${port}`
    console.log('gugu image playground 已启动')
    console.log(`访问地址：${url}`)
    console.log('关闭此窗口即可停止服务。')
    if (process.platform === 'win32' && process.env.NO_OPEN !== '1') {
      const child = spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${url}"`], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.unref()
    }
  })
}

if (!existsSync(indexFile)) {
  console.error(`缺少应用文件：${indexFile}`)
  process.exit(1)
}

listen(firstPort)
