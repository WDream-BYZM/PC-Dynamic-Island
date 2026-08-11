import { createStore } from './store'

export interface ClipboardCapture {
  id: number
  time: string
  text: string
}

const STORAGE_KEY = 'eisland.clipboard'
const MAX = 20

function load(): ClipboardCapture[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as ClipboardCapture[]
  } catch {
    return []
  }
}

/** 全局剪贴板捕获列表（最近 20 条，持久化），由 App 常驻轮询写入，社交屏读取展示 */
export const clipboardStore = createStore<ClipboardCapture[]>(load())

export function addClipboardCapture(cap: ClipboardCapture) {
  clipboardStore.set((prev) => {
    const next = [cap, ...prev].slice(0, MAX)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* 忽略写入失败 */
    }
    return next
  })
}
