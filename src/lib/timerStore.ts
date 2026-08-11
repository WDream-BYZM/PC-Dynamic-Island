import { createStore } from './store'

export type TimerMode = 'countdown' | 'stopwatch'

export interface TimerState {
  mode: TimerMode
  // 倒计时
  total: number
  remaining: number
  cdRunning: boolean
  cdDone: boolean
  endAt: number
  // 正计时（秒表）
  swRunning: boolean
  swElapsed: number
  swAccumMs: number
  swStartStamp: number
}

const initial: TimerState = {
  mode: 'countdown',
  total: 0,
  remaining: 0,
  cdRunning: false,
  cdDone: false,
  endAt: 0,
  swRunning: false,
  swElapsed: 0,
  swAccumMs: 0,
  swStartStamp: 0
}

export const timerStore = createStore<TimerState>(initial)

export function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function formatTime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

let tickId: ReturnType<typeof setInterval> | null = null

function stopTick() {
  if (tickId) {
    clearInterval(tickId)
    tickId = null
  }
}

/** 全局计时驱动：只要有任一计时在跑就启动 interval，全部停止即停 */
function ensureTick() {
  if (tickId) return
  tickId = setInterval(() => {
    const s = timerStore.get()
    if (!s.cdRunning && !s.swRunning) {
      stopTick()
      return
    }
    const next = { ...s }
    let dirty = false
    if (s.cdRunning) {
      const left = Math.max(0, Math.round((s.endAt - Date.now()) / 1000))
      if (left !== s.remaining) {
        next.remaining = left
        dirty = true
      }
      if (left <= 0) {
        next.cdRunning = false
        next.cdDone = true
        dirty = true
        window.dispatchEvent(new CustomEvent('eisland:glow'))
      }
    }
    if (s.swRunning) {
      const el = Math.floor((s.swAccumMs + (Date.now() - s.swStartStamp)) / 1000)
      if (el !== s.swElapsed) {
        next.swElapsed = el
        dirty = true
      }
    }
    if (dirty) timerStore.set(next)
    if (!next.cdRunning && !next.swRunning) stopTick()
  }, 200)
}

export function setTimerMode(mode: TimerMode) {
  timerStore.set((s) => ({ ...s, mode }))
}

export function startCountdown(h: number, m: number, sec: number) {
  const total = h * 3600 + m * 60 + sec
  if (total <= 0) return
  timerStore.set((s) => ({
    ...s,
    total,
    remaining: total,
    cdDone: false,
    endAt: Date.now() + total * 1000,
    cdRunning: true
  }))
  ensureTick()
}

export function pauseCountdown() {
  timerStore.set((s) => ({
    ...s,
    endAt: Date.now() + s.remaining * 1000,
    cdRunning: false
  }))
}

export function resumeCountdown() {
  const s = timerStore.get()
  if (s.total <= 0) return
  timerStore.set((prev) => ({
    ...prev,
    cdDone: false,
    endAt: Date.now() + prev.remaining * 1000,
    cdRunning: true
  }))
  ensureTick()
}

export function resetCountdown() {
  timerStore.set((s) => ({
    ...s,
    total: 0,
    remaining: 0,
    cdRunning: false,
    cdDone: false,
    endAt: 0
  }))
}

export function startStopwatch() {
  timerStore.set((s) => ({
    ...s,
    swAccumMs: 0,
    swStartStamp: Date.now(),
    swElapsed: 0,
    swRunning: true,
    cdDone: false
  }))
  ensureTick()
}

export function pauseStopwatch() {
  timerStore.set((s) => ({
    ...s,
    swAccumMs: s.swAccumMs + (Date.now() - s.swStartStamp),
    swRunning: false
  }))
}

export function resumeStopwatch() {
  timerStore.set((s) => ({ ...s, swStartStamp: Date.now(), swRunning: true }))
  ensureTick()
}

export function resetStopwatch() {
  timerStore.set((s) => ({
    ...s,
    swAccumMs: 0,
    swStartStamp: 0,
    swElapsed: 0,
    swRunning: false
  }))
}
