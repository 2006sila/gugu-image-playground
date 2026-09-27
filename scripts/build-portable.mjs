import { createHash } from 'node:crypto'
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
const productName = 'gugu-image-playground'
const folderName = `${productName}-v${pkg.version}-windows-x64`
const releaseRoot = join(projectRoot, 'release')
const packageRoot = join(releaseRoot, folderName)
const runtimeRoot = join(packageRoot, 'runtime')
const appRoot = join(packageRoot, 'app')
const zipPath = join(releaseRoot, `${folderName}.zip`)
const checksumPath = `${zipPath}.sha256`

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  })
  if (result.status !== 0) throw new Error(`${command} 执行失败，退出码 ${result.status ?? 'unknown'}`)
}

function requireFile(path, label) {
  if (!existsSync(path)) throw new Error(`缺少${label}：${path}`)
}

console.log(`[1/5] 构建 gugu image playground v${pkg.version}`)
const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('无法定位 npm CLI，请通过 npm run build:portable 执行此脚本')
run(process.execPath, [npmCli, 'run', 'build'])
requireFile(join(projectRoot, 'dist', 'index.html'), '生产构建')

console.log('[2/5] 创建便携目录')
rmSync(packageRoot, { recursive: true, force: true })
rmSync(zipPath, { force: true })
rmSync(checksumPath, { force: true })
mkdirSync(runtimeRoot, { recursive: true })
cpSync(join(projectRoot, 'dist'), appRoot, { recursive: true })
copyFileSync(process.execPath, join(runtimeRoot, 'node.exe'))
copyFileSync(join(projectRoot, 'scripts', 'portable-server.mjs'), join(runtimeRoot, 'server.mjs'))
copyFileSync(join(projectRoot, 'LICENSE'), join(packageRoot, 'LICENSE.txt'))
copyFileSync(join(projectRoot, 'LICENSE.AGPL-3.0'), join(packageRoot, 'LICENSE.AGPL-3.0.txt'))

const nodeVersion = process.version
const nodeLicenseUrl = `https://raw.githubusercontent.com/nodejs/node/${nodeVersion}/LICENSE`
console.log(`[3/5] 获取 Node.js ${nodeVersion} 许可证`)
const licenseResponse = await fetch(nodeLicenseUrl)
if (!licenseResponse.ok) throw new Error(`下载 Node.js 许可证失败：${licenseResponse.status} ${licenseResponse.statusText}`)
const noticesRoot = join(packageRoot, 'THIRD-PARTY-NOTICES')
mkdirSync(noticesRoot, { recursive: true })
writeFileSync(join(noticesRoot, 'Node.js-LICENSE.txt'), await licenseResponse.text(), 'utf8')
writeFileSync(join(noticesRoot, 'README.txt'), `本便携包内置 Node.js ${nodeVersion} Windows x64 运行时。\r\n项目地址：https://nodejs.org/\r\n许可证见 Node.js-LICENSE.txt。\r\n`, 'utf8')

writeFileSync(join(packageRoot, 'START.bat'), `@echo off\r\ntitle gugu image playground v${pkg.version}\r\ncd /d "%~dp0"\r\n"%~dp0runtime\\node.exe" "%~dp0runtime\\server.mjs"\r\nif errorlevel 1 (\r\n  echo.\r\n  echo Startup failed. Please keep this window and report the error above.\r\n  pause\r\n)\r\n`, 'utf8')
writeFileSync(join(packageRoot, '使用说明.txt'), `gugu image playground v${pkg.version} Windows x64 便携版\r\n\r\n1. 解压整个压缩包。\r\n2. 双击 START.bat。\r\n3. 浏览器将自动打开 http://127.0.0.1:4173。\r\n4. 关闭启动窗口即可停止服务。\r\n\r\n无需安装 Node.js，无需运行 npm install。\r\n首次使用请在应用的“设置”中配置 API。\r\n所有配置、任务和图片默认保存在当前浏览器的本地存储中。\r\n请勿直接在压缩包内运行，必须先完整解压。\r\n`, 'utf8')

console.log('[4/5] 创建 ZIP 压缩包')
if (process.platform !== 'win32') throw new Error('当前便携包构建脚本仅支持 Windows')
const archiveCommand = `Compress-Archive -LiteralPath '${packageRoot.replaceAll("'", "''")}' -DestinationPath '${zipPath.replaceAll("'", "''")}' -CompressionLevel Optimal -Force`
run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', archiveCommand])
requireFile(zipPath, '便携包 ZIP')

console.log('[5/5] 生成 SHA-256')
const digest = createHash('sha256').update(readFileSync(zipPath)).digest('hex')
writeFileSync(checksumPath, `${digest}  ${basename(zipPath)}\n`, 'utf8')
console.log(`便携包：${zipPath}`)
console.log(`SHA-256：${digest}`)
