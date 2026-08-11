import { app, BrowserWindow, clipboard, ipcMain, powerMonitor, screen, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// Windows 上透明窗口在部分显卡驱动下存在 GPU 合成 bug，
// 会导致透明区域被渲染成实色（黑色/白色方形背景）。
// 禁用硬件加速是此问题的标准解决方案（灵动岛为轻量 UI，性能影响可忽略）。
app.disableHardwareAcceleration()

interface AiAgent {
  id: string
  name: string
  systemPrompt: string
  baseUrl: string
  apiKey: string
  model: string
  temperature?: number
}

interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

/** 折叠态窗口高度（灵动岛胶囊 + 光晕边距） */
const COLLAPSED_HEIGHT = 84

/** 展开态窗口尺寸（面板 + 霓虹光晕边距） */
const EXPANDED_WIDTH = 556
const EXPANDED_HEIGHT = 484

/** 刘海模式折叠窗口高度（贴屏顶） */
const NOTCH_COLLAPSED_HEIGHT = 80

/** 折叠态光晕边距（窗口宽 = 胶囊宽 + 2*边距） */
const GLOW_MARGIN = 36

let mainWindow: BrowserWindow | null = null
let pinned = true
let mode: 'island' | 'notch' = 'island'
let expanded = false
/** 折叠态胶囊宽度，由渲染层按活动类型分档后通过 IPC 驱动（窗口宽 = 胶囊宽 + 光晕边距） */
let collapsedCapsuleW = 204

function topCenterPos(width: number, height: number) {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: Math.round(workArea.x + workArea.width / 2 - width / 2),
    y: workArea.y + 14
  }
}

/** 切换窗口尺寸：折叠=胶囊宽(渲染层驱动)+光晕边距，展开=面板大小；刘海模式贴屏幕顶部 */
function applySize() {
  if (!mainWindow) return
  const notch = mode === 'notch'
  const w = expanded ? EXPANDED_WIDTH : collapsedCapsuleW + GLOW_MARGIN
  const h = expanded ? EXPANDED_HEIGHT : notch ? NOTCH_COLLAPSED_HEIGHT : COLLAPSED_HEIGHT
  const { workArea } = screen.getPrimaryDisplay()
  const x = Math.round(workArea.x + workArea.width / 2 - w / 2)
  const y = notch ? workArea.y : workArea.y + 14
  mainWindow.setBounds({ x, y, width: w, height: h })
  console.log(
    '[eisland] applySize ->',
    expanded ? 'expanded' : 'collapsed',
    `${w}x${h}`,
    mode,
    `capsule=${collapsedCapsuleW}`
  )
  if (expanded) startCursorCheck()
  else stopCursorCheck()
}

/** 展开时轮询鼠标屏幕坐标：移出窗口即通知收起（透明窗口下 document mouseleave 不可靠的兜底） */
let cursorCheckId: ReturnType<typeof setInterval> | null = null
function startCursorCheck() {
  if (cursorCheckId) return
  cursorCheckId = setInterval(() => {
    const win = mainWindow
    if (!win || win.isDestroyed() || !expanded) return
    const b = win.getBounds()
    const p = screen.getCursorScreenPoint()
    if (p.x < b.x || p.x > b.x + b.width || p.y < b.y || p.y > b.y + b.height) {
      win.webContents.send('island:blur')
    }
  }, 200)
}
function stopCursorCheck() {
  if (cursorCheckId) {
    clearInterval(cursorCheckId)
    cursorCheckId = null
  }
}

function createWindow() {
  const pos = topCenterPos(collapsedCapsuleW + GLOW_MARGIN, COLLAPSED_HEIGHT)

  mainWindow = new BrowserWindow({
    width: collapsedCapsuleW + GLOW_MARGIN,
    height: COLLAPSED_HEIGHT,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    maximizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.setAlwaysOnTop(pinned, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    applySize() // 确保初始为折叠尺寸
    mainWindow?.show()
    // 初始为折叠态：让透明区域鼠标穿透
    mainWindow?.setIgnoreMouseEvents(true, { forward: true })
  })

  // 失焦（点击其他界面）时通知渲染进程收起，避免透明窗口残留白屏
  mainWindow.on('blur', () => {
    const win = mainWindow
    if (win && !win.isDestroyed()) {
      win.webContents.send('island:blur')
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ---------------- 系统状态采样 ----------------

let lastCpus = os.cpus()

/** 通过两次采样差计算整体 CPU 使用率（%） */
function readCpuUsage(): number {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (let i = 0; i < cpus.length; i++) {
    const cur = cpus[i].times
    const prev = lastCpus[i]?.times
    if (!prev) continue
    const dIdle = cur.idle - prev.idle
    const dTotal =
      cur.user + cur.nice + cur.sys + cur.irq + cur.idle - (prev.user + prev.nice + prev.sys + prev.irq + prev.idle)
    idle += dIdle
    total += dTotal
  }
  lastCpus = cpus
  return total > 0 ? Math.max(0, Math.min(100, Math.round((1 - idle / total) * 100))) : 0
}

// ---------------- IPC ----------------

/** 折叠态时让透明区域鼠标穿透；展开态恢复正常 */
ipcMain.on('island:ignore-mouse', (_event, ignore: boolean) => {
  mainWindow?.setIgnoreMouseEvents(ignore, { forward: true })
})

ipcMain.handle('island:toggle-pin', () => {
  pinned = !pinned
  mainWindow?.setAlwaysOnTop(pinned, 'screen-saver')
  return pinned
})

ipcMain.handle('island:is-pinned', () => pinned)

ipcMain.on('island:hide', () => mainWindow?.hide())

ipcMain.on('island:quit', () => app.quit())

/** 折叠/展开时调整窗口尺寸：窗口贴合内容，消除方形背景 */
ipcMain.on('island:set-state', (_event, exp: boolean) => {
  expanded = exp
  applySize()
})

/** 有活动上岛时按渲染层给出的胶囊宽度加宽窗口（宽度随活动类型分档；宽度不变则跳过，避免频繁 setBounds） */
ipcMain.on('island:set-activity', (_event, w: number) => {
  if (typeof w === 'number' && w >= 100 && w <= 800 && w !== collapsedCapsuleW) {
    collapsedCapsuleW = w
    applySize()
  }
})

/** 切换显示模式（灵动岛 / 刘海） */
ipcMain.on('island:set-mode', (_event, m: string) => {
  mode = m === 'notch' ? 'notch' : 'island'
  console.log('[eisland] mode ->', mode)
})

/** 读取系统剪贴板文本（用于安全捕获复制的消息） */
ipcMain.handle('system:clipboard', () => clipboard.readText())

/** 在系统默认浏览器中打开外部链接 */
ipcMain.handle('shell:open-external', (_event, url: string) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) {
    shell.openExternal(url)
  }
})

/** 开机自启动：查询当前是否已启用 */
ipcMain.handle('island:get-autostart', () => app.getLoginItemSettings().openAtLogin)

/** 开机自启动：切换（写入 Windows 登录启动项） */
ipcMain.handle('island:set-autostart', (_event, enabled: boolean) => {
  app.setLoginItemSettings({ openAtLogin: !!enabled, path: process.execPath })
  return app.getLoginItemSettings().openAtLogin
})

/** 读取系统状态（CPU / 内存 / 电池 / 运行时间） */
ipcMain.handle('system:stats', () => {
  const memTotal = os.totalmem()
  const memUsed = memTotal - os.freemem()
  const cpus = os.cpus()
  return {
    cpu: readCpuUsage(),
    cpuModel: cpus[0]?.model ?? '',
    cpuCores: cpus.length,
    memTotal,
    memUsed,
    memPercent: Math.round((memUsed / memTotal) * 100),
    onBattery: powerMonitor.onBatteryPower,
    uptime: os.uptime()
  }
})

/** AI 流式对话：调用 OpenAI 兼容 chat/completions，逐段转发给渲染进程 */
ipcMain.on('ai:chat', async (event, payload: { agent: AiAgent; messages: AiMessage[] }) => {
  const { agent, messages } = payload
  try {
    const res = await fetch(`${agent.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agent.apiKey}`
      },
      body: JSON.stringify({
        model: agent.model,
        messages: [{ role: 'system', content: agent.systemPrompt }, ...messages],
        stream: true,
        temperature: agent.temperature ?? 0.7
      })
    })

    if (!res.ok) {
      const text = await res.text()
      event.sender.send('ai:error', `请求失败 (HTTP ${res.status}): ${text.slice(0, 200)}`)
      return
    }

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) event.sender.send('ai:chunk', delta)
        } catch {
          /* 忽略不完整片段 */
        }
      }
    }
    event.sender.send('ai:done')
  } catch (e) {
    event.sender.send('ai:error', e instanceof Error ? e.message : String(e))
  }
})

// ---------------- 微信 / QQ 状态 ----------------

function runPowershell(script: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 8000, windowsHide: true },
      (err, stdout) => {
        resolve(stdout?.toString() ?? '')
      }
    )
  })
}

/** 读取微信 / QQ 运行状态与主窗口标题（当前聊天对象） */
ipcMain.handle('social:status', async () => {
  const script = `
$apps = @('WeChat','QQ')
foreach ($n in $apps) {
  $p = Get-Process -Name $n -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($p) {
    $title = $p.MainWindowTitle
    Write-Output ("{0}=ON|{1}" -f $n, $title)
  } else {
    Write-Output ("{0}=OFF" -f $n)
  }
}
`
  const out = await runPowershell(script)
  const result: Record<string, { running: boolean; title: string }> = {
    wechat: { running: false, title: '' },
    qq: { running: false, title: '' }
  }
  for (const line of out.split(/\r?\n/)) {
    const m = /^(WeChat|QQ)=(ON|OFF)(?:\|(.*))?$/.exec(line.trim())
    if (!m) continue
    const key = m[1] === 'WeChat' ? 'wechat' : 'qq'
    result[key] = { running: m[2] === 'ON', title: m[3] ?? '' }
  }
  return result
})

// ---------------- 网易云音乐状态 ----------------

/** 从网易云音乐主窗口标题解析出歌名 / 歌手（标题形如「晴天 - 周杰伦 - 网易云音乐」） */
function parseMusicTitle(raw: string): { title: string; artist: string } | null {
  if (!raw) return null
  const t = raw
    .replace(/\s*-\s*(网易云音乐|网易云音乐Mac版|NetEaseCloudMusic|cloudmusic)\s*$/i, '')
    .trim()
  if (!t) return null
  const parts = t
    .split(/\s*-\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length >= 2) {
    return { title: parts[0], artist: parts.slice(1).join(' - ') }
  }
  return { title: parts[0] ?? t, artist: '' }
}

/** 读取本地网易云音乐当前播放（通过进程主窗口标题，安全方式） */
ipcMain.handle('music:status', async () => {
  const script = `
$p = Get-Process cloudmusic -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($p) { Write-Output $p.MainWindowTitle }
`
  const out = (await runPowershell(script)).trim()
  return parseMusicTitle(out)
})

// ---------------- 文件搜索 (Everything) ----------------

const ES_CANDIDATES = [
  'es.exe',
  'C:\\Program Files\\Everything\\es.exe',
  'C:\\Program Files (x86)\\Everything\\es.exe'
]

/** 查找 es.exe（Everything 命令行工具）：PATH、标准安装目录、EverythingPath 环境变量 */
function findEsPath(): string | null {
  if (process.env.EverythingPath) {
    const p = path.join(process.env.EverythingPath, 'es.exe')
    if (fs.existsSync(p)) return p
  }
  for (const c of ES_CANDIDATES) {
    if (c === 'es.exe') {
      try {
        const r = execFileSync('where', ['es.exe'], { encoding: 'utf8' })
        const first = r.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0]
        if (first) return first
      } catch {
        /* not in PATH */
      }
    } else if (fs.existsSync(c)) {
      return c
    }
  }
  return null
}

/** 检测 Everything HTTP 服务是否可用（默认端口 80） */
async function httpAvailable(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/?search=&json=1&count=1`, {
      signal: AbortSignal.timeout(1200)
    })
    return res.ok
  } catch {
    return false
  }
}

/** 搜索可用性：Everything(es/http) 优先，其次内置 Windows 索引，内置始终可用 */
ipcMain.handle('search:status', async () => {
  const esPath = findEsPath()
  if (esPath) return { available: true, method: 'es', esPath }
  const httpOk = await httpAvailable(80)
  if (httpOk) return { available: true, method: 'http', port: 80 }
  return { available: true, method: 'builtin' }
})

/** 内置搜索 1：Windows Search 索引器（SystemIndex），利用系统索引，无需额外软件 */
async function searchSystemIndex(q: string, limit = 60) {
  const esc = q.replace(/'/g, "''")
  const script = `
try {
  $conn = New-Object -ComObject ADODB.Connection
  $conn.Open("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';")
  $sql = "SELECT TOP ${limit} System.ItemNameDisplay, System.ItemPathDisplay, System.Size, System.DateModified FROM SystemIndex WHERE (System.ItemNameDisplay LIKE '%${esc}%')"
  $rs = $conn.Execute($sql)
  $out = @()
  while (-not $rs.EOF) {
    $n = $rs.Fields("System.ItemNameDisplay").Value
    $p = $rs.Fields("System.ItemPathDisplay").Value
    $s = $rs.Fields("System.Size").Value
    $d = $rs.Fields("System.DateModified").Value
    $out += ($n + "|" + $p + "|" + ([string]$s) + "|" + ([string]$d))
    $rs.MoveNext()
  }
  Write-Output ($out -join "\`n")
} catch {
  Write-Output "__ERR__"
}
`
  const out = await runPowershell(script)
  if (out.includes('__ERR__')) return null
  const results: SearchResultLike[] = []
  for (const line of out.split(/\r?\n/)) {
    const idx = line.indexOf('|')
    if (idx <= 0) continue
    const name = line.slice(0, idx).trim()
    const rest = line.slice(idx + 1)
    const pipe2 = rest.indexOf('|')
    if (pipe2 <= 0) continue
    const p = rest.slice(0, pipe2).trim()
    const [sizeStr, dateStr] = rest.slice(pipe2 + 1).split('|')
    if (!name || !p) continue
    results.push({
      name,
      path: p.replace(/^file:\/\//, '').replace(/^file:\/\//, ''),
      size: parseInt(sizeStr ?? '0', 10) || 0,
      mtime: dateStr ? new Date(dateStr).getTime() : 0,
      ext: path.extname(name).replace(/^\./, '').toUpperCase()
    })
  }
  return results.length ? results : null
}

interface SearchResultLike {
  name: string
  path: string
  size: number
  mtime: number
  ext: string
}

/** 内置搜索 2：递归文件系统扫描（Everything / 索引都不可用时的兜底） */
const SKIP_DIRS = new Set([
  '$Recycle.Bin',
  'System Volume Information',
  'Windows',
  'Windows.old',
  'ProgramData',
  'node_modules',
  '.git',
  'AppData',
  'OneDriveTemp',
  '$RECYCLE.BIN'
])

async function listSearchRoots(): Promise<string[]> {
  const roots: string[] = []
  for (const letter of 'CDEFGHIJK'.split('')) {
    if (fs.existsSync(`${letter}:\\`)) roots.push(`${letter}:\\`)
  }
  return roots
}

async function walkSearch(
  dir: string,
  q: string,
  acc: SearchResultLike[],
  max: number,
  depth: number,
  deadline: number
): Promise<boolean> {
  if (acc.length >= max || Date.now() > deadline) return true
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    return false
  }
  for (const ent of entries) {
    if (acc.length >= max || Date.now() > deadline) return true
    const full = path.join(dir, ent.name)
    if (ent.isSymbolicLink()) continue
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue
      if (depth < 7) {
        const done = await walkSearch(full, q, acc, max, depth + 1, deadline)
        if (done) return true
      }
    } else if (ent.isFile()) {
      if (ent.name.toLowerCase().includes(q.toLowerCase())) {
        let size = 0
        let mtime = 0
        try {
          const st = await fsp.stat(full)
          size = st.size
          mtime = st.mtimeMs
        } catch {
          /* ignore */
        }
        acc.push({
          name: ent.name,
          path: full,
          size,
          mtime,
          ext: path.extname(ent.name).replace(/^\./, '').toUpperCase()
        })
      }
    }
  }
  return false
}

async function searchRecursive(q: string): Promise<SearchResultLike[]> {
  const acc: SearchResultLike[] = []
  const deadline = Date.now() + 15000
  const roots = await listSearchRoots()
  for (const root of roots) {
    const done = await walkSearch(root, q, acc, 60, 0, deadline)
    if (done) break
  }
  return acc
}

/** 搜索文件：Everything(es/http) → Windows 索引 → 递归扫描（内置，无需安装 Everything） */
ipcMain.handle('search:files', async (_event, query: string) => {
  const q = (query || '').trim()
  if (!q) return { method: 'builtin', results: [] }

  // 1. Everything es.exe
  const esPath = findEsPath()
  if (esPath) {
    try {
      const out = execFileSync(esPath, ['-n', '60', '-utf8', '-s', q], {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 15000
      })
      const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      const results = lines.map((p) => {
        let size = 0
        let mtime = 0
        try {
          const st = fs.statSync(p)
          size = st.isDirectory() ? 0 : st.size
          mtime = st.mtimeMs
        } catch {
          /* ignore */
        }
        return {
          name: path.basename(p),
          path: p,
          size,
          mtime,
          ext: path.extname(p).replace(/^\./, '').toUpperCase()
        }
      })
      if (results.length) return { method: 'es', results }
    } catch {
      /* 落到下一后端 */
    }
  }

  // 2. Everything HTTP 服务
  try {
    const res = await fetch(
      `http://127.0.0.1:80/?search=${encodeURIComponent(q)}&json=1&count=60`,
      { signal: AbortSignal.timeout(3000) }
    )
    if (res.ok) {
      const data = (await res.json()) as {
        results?: Array<{
          type: number
          name: string
          full_path_and_file_name: string
          size?: number
          date_modified?: string
        }>
      }
      const results = (data.results ?? []).slice(0, 60).map((r) => ({
        name: r.name,
        path: r.full_path_and_file_name,
        size: r.type === 0 ? (r.size ?? 0) : 0,
        mtime: r.date_modified ? new Date(r.date_modified).getTime() : 0,
        ext: path.extname(r.name).replace(/^\./, '').toUpperCase()
      }))
      if (results.length) return { method: 'http', results }
    }
  } catch {
    /* ignore */
  }

  // 3. Windows Search 索引器（内置）
  try {
    const idx = await searchSystemIndex(q)
    if (idx && idx.length) return { method: 'systemindex', results: idx }
  } catch {
    /* ignore */
  }

  // 4. 递归扫描（内置兜底）
  const rec = await searchRecursive(q)
  if (rec.length) return { method: 'recursive', results: rec }

  return { method: 'builtin', results: [] }
})

/** 打开文件 / 定位文件夹 / 在 Everything 中打开（借鉴 EverythingToolbar 交互） */
ipcMain.handle('search:open', (_event, p: string, mode?: string) => {
  if (typeof p !== 'string' || !p) return
  if (mode === 'folder') {
    shell.showItemInFolder(p)
  } else if (mode === 'everything') {
    openInEverything(p)
  } else {
    shell.openPath(p)
  }
})

/** 复制完整路径到剪贴板 */
ipcMain.handle('search:copy-path', (_event, p: string) => {
  if (typeof p === 'string' && p) clipboard.writeText(p)
})

/** 查找 Everything 主程序（用于在 Everything 中打开搜索） */
function findEverythingExe(): string | null {
  const candidates = [
    'C:\\Program Files\\Everything\\Everything.exe',
    'C:\\Program Files (x86)\\Everything\\Everything.exe'
  ]
  for (const c of candidates) if (fs.existsSync(c)) return c
  return null
}

/** 在 Everything 主窗口中对文件执行搜索（打开其所在/按路径过滤） */
function openInEverything(pathOrQuery: string) {
  const exe = findEverythingExe()
  if (exe) {
    execFile(exe, ['-search', pathOrQuery])
  }
}

// ---------------- Lifecycle ----------------

/**
 * 首次安装（打包环境）默认开启开机自启动；
 * 用 userData 下的标志文件记录"已做首次初始化"，避免用户手动关闭后被强制重新开启。
 */
function ensureFirstRunAutostart() {
  if (!app.isPackaged) return
  const flagPath = path.join(app.getPath('userData'), 'autostart-set')
  if (fs.existsSync(flagPath)) return
  try {
    fs.writeFileSync(flagPath, '1')
    app.setLoginItemSettings({ openAtLogin: true, path: process.execPath })
  } catch {
    /* 忽略：写入登录项失败不阻塞启动 */
  }
}

// ---------------- 自动更新 (electron-updater) ----------------

/** 主进程 → 渲染层：发送更新状态 / 进度 */
function sendUpdate(channel: string, payload: unknown) {
  mainWindow?.webContents.send(channel, payload)
}

function setupAutoUpdater() {
  // 开发模式（未打包）不做更新检查
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false // 先通知渲染层，由用户决定是否下载
  autoUpdater.autoInstallOnAppQuit = true // 下载完成后，退出应用时自动安装

  autoUpdater.on('checking-for-update', () => {
    sendUpdate('update:status', { state: 'checking' })
  })
  autoUpdater.on('update-available', (info) => {
    sendUpdate('update:status', { state: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', () => {
    sendUpdate('update:status', { state: 'not-available' })
  })
  autoUpdater.on('download-progress', (p) => {
    sendUpdate('update:progress', {
      percent: Math.round(p.percent * 10) / 10,
      transferred: p.transferred,
      total: p.total,
      bytesPerSecond: p.bytesPerSecond
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdate('update:status', { state: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', (err) => {
    sendUpdate('update:status', { state: 'error', message: err?.message ?? String(err) })
  })

  // 启动后静默检查一次（延迟避免干扰首次启动）
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      /* 网络异常等静默忽略 */
    })
  }, 15000)
}

/** 手动检查更新 */
ipcMain.handle('update:check', () => {
  if (!app.isPackaged) return { state: 'not-available' }
  return autoUpdater.checkForUpdates()
})

/** 下载更新 */
ipcMain.handle('update:download', () => {
  if (!app.isPackaged) return
  return autoUpdater.downloadUpdate()
})

/** 立即安装并重启 */
ipcMain.handle('update:install', () => {
  if (!app.isPackaged) return
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true)
  })
})

app.whenReady().then(() => {
  ensureFirstRunAutostart()
  createWindow()
  setupAutoUpdater()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 常驻应用：关闭窗口不退出，除非显式调用 island:quit
app.on('window-all-closed', () => {
  /* keep alive */
})
