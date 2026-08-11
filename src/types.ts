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

/** AI 智能体配置（OpenAI 兼容 API） */
export interface AgentConfig {
  id: string
  name: string
  description?: string
  systemPrompt: string
  /** API 端点，如 https://api.deepseek.com/v1 */
  baseUrl: string
  apiKey: string
  model: string
  temperature?: number
}

export interface AiChatPayload {
  agent: AgentConfig
  messages: ChatMessage[]
  onChunk: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
}

export interface SocialStatus {
  wechat: { running: boolean; title: string }
  qq: { running: boolean; title: string }
}

export interface SearchResult {
  name: string
  path: string
  size: number
  mtime: number
  ext: string
}

export interface SearchStatus {
  available: boolean
  method: 'es' | 'http' | 'systemindex' | 'recursive' | 'builtin'
  esPath?: string
  port?: number
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

export interface EislandAPI {
  setIgnoreMouse: (ignore: boolean) => void
  togglePin: () => Promise<boolean>
  isPinned: () => Promise<boolean>
  hide: () => void
  quit: () => void
  setState: (expanded: boolean) => void
  setMode: (mode: 'island' | 'notch') => void
  getAutostart: () => Promise<boolean>
  setAutostart: (enabled: boolean) => Promise<boolean>
  openExternal: (url: string) => void
  setActivity: (width: number) => void
  getMusicStatus: () => Promise<{ title: string; artist: string } | null>
  searchStatus: () => Promise<SearchStatus>
  searchFiles: (query: string) => Promise<{ method: string; error?: string; results: SearchResult[] }>
  searchOpen: (filePath: string, mode?: 'file' | 'folder' | 'everything') => void
  searchCopyPath: (filePath: string) => void
  onBlur: (callback: () => void) => () => void
  getSystemStats: () => Promise<SystemStats>
  getClipboard: () => Promise<string>
  getSocialStatus: () => Promise<SocialStatus>
  aiChat: (payload: AiChatPayload) => () => void
  checkUpdate: () => Promise<unknown>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
  onUpdateProgress: (callback: (progress: UpdateProgress) => void) => () => void
  setAutoHide: (enabled: boolean) => void
  platform: string
}

declare global {
  interface Window {
    eisland: EislandAPI
  }
}

export {}
