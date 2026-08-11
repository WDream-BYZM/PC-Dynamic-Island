import { createStore } from './store'

export interface MusicStatus {
  title: string
  artist: string
  /** 是否正在播放（系统媒体会话提供；缺失时视为未知） */
  playing?: boolean
}

/** 当前网易云音乐播放信息（由 App 常驻轮询主进程更新） */
export const musicStore = createStore<MusicStatus | null>(null)

/** 拉取当前播放状态；未播放 / 无桥接时清空（内容不变则不触发更新） */
export async function refreshMusic(): Promise<void> {
  try {
    if (!window.eisland?.getMusicStatus) {
      musicStore.set(null)
      return
    }
    const s = await window.eisland.getMusicStatus()
    const cur = musicStore.get()
    if (!s || (!s.title && !s.artist)) {
      if (cur) musicStore.set(null)
    } else if (!cur || cur.title !== s.title || cur.artist !== s.artist || cur.playing !== s.playing) {
      musicStore.set(s)
    }
  } catch {
    musicStore.set(null)
  }
}
