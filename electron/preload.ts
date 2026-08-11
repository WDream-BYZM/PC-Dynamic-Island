import { contextBridge, ipcRenderer } from 'electron'

export interface SystemStats {
  cpu: number
  cpuModel: string
  cpuCores: number
  memTotal: number
  memUsed: number
  memPercent: number
  onBattery: boolean
  uptime: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentConfig {
  id: string
  name: string
  description?: string
  systemPrompt: string
  baseUrl: string
  apiKey: string
  model: string
  temperature?: number
}

export interface SocialStatus {
  wechat: { running: boolean; title: string }
  qq: { running: boolean; title: string }
}

export interface UpdateStatus {
  state: 'checking' | 'available' | 'not-available' | 'downloaded' | 'error'
  version?: string
  message?: string
}

export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

const api = {
  /** 折叠态鼠标穿透控制 */
  setIgnoreMouse: (ignore: boolean) => ipcRenderer.send('island:ignore-mouse', ignore),
  togglePin: (): Promise<boolean> => ipcRenderer.invoke('island:toggle-pin'),
  isPinned: (): Promise<boolean> => ipcRenderer.invoke('island:is-pinned'),
  hide: () => ipcRenderer.send('island:hide'),
  quit: () => ipcRenderer.send('island:quit'),
  /** 通知主进程折叠/展开，用于裁剪窗口形状 */
  setState: (expanded: boolean) => ipcRenderer.send('island:set-state', expanded),
  /** 切换显示模式（灵动岛 / 刘海） */
  setMode: (mode: 'island' | 'notch') => ipcRenderer.send('island:set-mode', mode),
  /** 开机自启动：查询当前是否启用 */
  getAutostart: () => ipcRenderer.invoke('island:get-autostart') as Promise<boolean>,
  /** 开机自启动：切换启用状态，返回新状态 */
  setAutostart: (enabled: boolean) =>
    ipcRenderer.invoke('island:set-autostart', enabled) as Promise<boolean>,
  /** 在系统默认浏览器中打开外部链接 */
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  /** 通知主进程折叠态胶囊宽度（窗口按活动类型加宽） */
  setActivity: (width: number) => ipcRenderer.send('island:set-activity', width),
  /** 读取本地网易云音乐当前播放 */
  getMusicStatus: () => ipcRenderer.invoke('music:status') as Promise<{ title: string; artist: string } | null>,
  /** 文件搜索：Everything 可用性检测 */
  searchStatus: () =>
    ipcRenderer.invoke('search:status') as Promise<{
      available: boolean
      method: 'es' | 'http' | 'none'
      esPath?: string
      port?: number
    }>,
  /** 文件搜索：按关键词搜索 */
  searchFiles: (query: string) =>
    ipcRenderer.invoke('search:files', query) as Promise<{
      method: string
      error?: string
      results: Array<{ name: string; path: string; size: number; mtime: number; ext: string }>
    }>,
  /** 文件搜索：打开文件 / 定位文件夹 / 在 Everything 中打开 */
  searchOpen: (filePath: string, mode?: 'file' | 'folder' | 'everything') =>
    ipcRenderer.invoke('search:open', filePath, mode),
  /** 文件搜索：复制完整路径到剪贴板 */
  searchCopyPath: (filePath: string) => ipcRenderer.invoke('search:copy-path', filePath),
  /** 监听窗口失焦（点击其他界面时收起），返回取消订阅函数 */
  onBlur: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('island:blur', handler)
    return () => {
      ipcRenderer.removeListener('island:blur', handler)
    }
  },
  /** 读取系统剪贴板文本 */
  getClipboard: (): Promise<string> => ipcRenderer.invoke('system:clipboard'),
  /** 读取系统状态（CPU / 内存 / 电池 / 运行时间） */
  getSystemStats: (): Promise<SystemStats> => ipcRenderer.invoke('system:stats'),
  /** 读取微信 / QQ 运行状态与当前聊天窗口标题 */
  getSocialStatus: (): Promise<SocialStatus> => ipcRenderer.invoke('social:status'),
  /** 流式 AI 对话（OpenAI 兼容 API），返回取消订阅函数 */
  aiChat: (payload: {
    agent: AgentConfig
    messages: ChatMessage[]
    onChunk: (text: string) => void
    onDone: () => void
    onError: (message: string) => void
  }): (() => void) => {
    const onChunk = (_e: unknown, text: string) => payload.onChunk(text)
    const onDone = () => {
      cleanup()
      payload.onDone()
    }
    const onError = (_e: unknown, message: string) => {
      cleanup()
      payload.onError(message)
    }
    const cleanup = () => {
      ipcRenderer.removeListener('ai:chunk', onChunk)
      ipcRenderer.removeListener('ai:done', onDone)
      ipcRenderer.removeListener('ai:error', onError)
    }
    ipcRenderer.on('ai:chunk', onChunk)
    ipcRenderer.on('ai:done', onDone)
    ipcRenderer.on('ai:error', onError)
    ipcRenderer.send('ai:chat', {
      agent: payload.agent,
      messages: payload.messages
    })
    return cleanup
  },
  /** 自动更新：检查更新 */
  checkUpdate: () => ipcRenderer.invoke('update:check') as Promise<unknown>,
  /** 自动更新：下载更新包 */
  downloadUpdate: () => ipcRenderer.invoke('update:download') as Promise<void>,
  /** 自动更新：立即安装并重启 */
  installUpdate: () => ipcRenderer.invoke('update:install') as Promise<void>,
  /** 自动更新：监听更新状态变化，返回取消订阅函数 */
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const handler = (_e: unknown, status: UpdateStatus) => callback(status)
    ipcRenderer.on('update:status', handler)
    return () => {
      ipcRenderer.removeListener('update:status', handler)
    }
  },
  /** 自动更新：监听下载进度，返回取消订阅函数 */
  onUpdateProgress: (callback: (progress: UpdateProgress) => void) => {
    const handler = (_e: unknown, progress: UpdateProgress) => callback(progress)
    ipcRenderer.on('update:progress', handler)
    return () => {
      ipcRenderer.removeListener('update:progress', handler)
    }
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('eisland', api)

export type EislandAPI = typeof api
