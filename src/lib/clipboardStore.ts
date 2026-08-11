import { createStore } from './store'

export interface ClipboardCapture {
  id: number
  time: string
  text: string
}

/** 全局剪贴板捕获列表（最近 6 条），由 App 常驻轮询写入，社交屏读取展示 */
export const clipboardStore = createStore<ClipboardCapture[]>([])

export function addClipboardCapture(cap: ClipboardCapture) {
  clipboardStore.set((prev) => [cap, ...prev].slice(0, 6))
}
