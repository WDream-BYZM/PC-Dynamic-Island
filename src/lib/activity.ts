import { createStore, useStore } from './store'
import { timerStore, formatTime } from './timerStore'
import { musicStore } from './music'
import { audioActivity } from './audioActivity'

export type ActivityType = 'timer' | 'message' | 'ai' | 'weather' | 'music'

export interface IslandActivity {
  type: ActivityType
  title: string
  subtitle?: string
  icon?: string
  /** 点击上岛内容时跳转的目标屏 */
  target?: string
}

/** 临时活动（消息 / AI）：被新的覆盖或 autoClear 清除；常驻活动（计时）由合成层生成 */
const activityStore = createStore<IslandActivity | null>(null)

const clearTimers = new Map<ActivityType, ReturnType<typeof setTimeout>>()

export function setActivity(act: IslandActivity, autoClearMs?: number) {
  if (autoClearMs) {
    const prev = clearTimers.get(act.type)
    if (prev) clearTimeout(prev)
    clearTimers.set(
      act.type,
      setTimeout(() => {
        clearTimers.delete(act.type)
        const cur = activityStore.get()
        if (cur?.type === act.type) activityStore.set(null)
      }, autoClearMs)
    )
  }
  activityStore.set(act)
}

export function clearActivity(type?: ActivityType) {
  if (type) {
    const t = clearTimers.get(type)
    if (t) {
      clearTimeout(t)
      clearTimers.delete(type)
    }
    const cur = activityStore.get()
    if (cur?.type === type) activityStore.set(null)
  } else {
    clearTimers.forEach((t) => clearTimeout(t))
    clearTimers.clear()
    activityStore.set(null)
  }
}

/**
 * 合成胶囊要显示的"上岛"内容：
 * 计时（运行/时间到）常驻优先，其次为本地音乐（常驻），最后为消息 / AI 临时活动。
 */
export function useIslandActivity(): IslandActivity | null {
  const timer = useStore(timerStore)
  const music = useStore(musicStore)
  const audio = useStore(audioActivity)
  const temp = useStore(activityStore)

  if (timer.cdRunning) {
    return { type: 'timer', title: formatTime(timer.remaining), subtitle: '倒计时', icon: '⏳', target: 'timer' }
  }
  if (timer.cdDone) {
    return { type: 'timer', title: '时间到', subtitle: '倒计时结束', icon: '⏰', target: 'timer' }
  }
  if (timer.swRunning || timer.swElapsed > 0) {
    return { type: 'timer', title: formatTime(timer.swElapsed), subtitle: '正计时', icon: '⏱️', target: 'timer' }
  }
  // 检测到真实音频输出时才上岛显示音乐（避免未播放时误显示，不再用捕获失败降级）
  if (music && audio.isPlaying) {
    return { type: 'music', title: music.title, subtitle: music.artist || undefined, icon: '🎵' }
  }
  return temp
}

/**
 * 折叠胶囊宽度按活动类型分档（避免倒计时这类内容短的活动把胶囊撑太宽）：
 * 无活动最窄 → 计时中等 → 音乐较宽 → 消息/AI/天气最宽。
 */
export function capsuleWidth(mode: 'island' | 'notch', activity: IslandActivity | null): number {
  // CPU 圆环 + 网速预留
  const extra = 30 + 64
  if (!activity) return (mode === 'notch' ? 280 : 204) + extra
  if (activity.type === 'timer') return (mode === 'notch' ? 340 : 280) + extra
  if (activity.type === 'music') {
    // 歌名/歌手按长度动态撑宽（长短差异大，固定档会裁长歌名）：标题 14px≈13px/字、字幕 11px≈10px/字
    const titleW = Math.min((activity.title?.length ?? 0) * 13, 260)
    const subW = Math.min((activity.subtitle?.length ?? 0) * 10, 130)
    const base = 66 // 分隔线 + 图标 + 间距 + 左右留白
    const min = mode === 'notch' ? 380 : 320
    const max = 800 - extra // 主进程窗口宽上限 800
    return Math.min(max, Math.max(min, base + titleW + subW)) + extra
  }
  return (mode === 'notch' ? 440 : 380) + extra
}
