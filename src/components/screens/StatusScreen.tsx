import { useEffect, useState } from 'react'
import type { SystemStats } from '../../types'
import { useStore } from '../../lib/store'
import { musicStore } from '../../lib/music'

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}天 ${h}小时 ${m}分`
  if (h > 0) return `${h}小时 ${m}分`
  return `${m}分`
}

function fmtGB(bytes: number) {
  return (bytes / 1024 ** 3).toFixed(1)
}

function Bar({ value }: { value: number }) {
  const v = Math.min(100, Math.max(0, value))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full origin-left rounded-full transition-transform duration-300 ${
          v > 80 ? 'bg-red-400' : 'bg-[#22d3ee]'
        }`}
        style={{ transform: `scaleX(${v / 100})` }}
      />
    </div>
  )
}

export default function StatusScreen() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [error, setError] = useState(false)
  const music = useStore(musicStore)
  const mediaControl = (action: 'prev' | 'toggle' | 'next') => window.eisland?.musicControl(action)

  useEffect(() => {
    if (!window.eisland) {
      setError(true)
      return
    }
    let stop = false
    const tick = async () => {
      try {
        const s = await window.eisland.getSystemStats()
        if (!stop) setStats(s)
      } catch {
        if (!stop) setError(true)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [])

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-zinc-500">
        <div className="text-3xl">💻</div>
        <div className="text-[13px]">系统状态仅在桌面应用中可用</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-zinc-500">
        正在读取系统状态
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-5">
      {/* 正在播放 + 媒体控制 */}
      {music && (
        <div className="rounded-2xl bg-island-card px-4 py-3">
          <div className="mb-2 text-[12px] tracking-widest text-zinc-500">正在播放</div>
          <div className="truncate text-[14px] text-white">{music.title}</div>
          {music.artist && <div className="truncate text-[12px] text-zinc-500">{music.artist}</div>}
          <div className="mt-3 flex items-center justify-center gap-4">
            <button
              onClick={() => mediaControl('prev')}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-zinc-300 transition-colors hover:bg-white/20"
              aria-label="上一首"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3 3h2v10H3zM13 3l-7 5 7 5z" />
              </svg>
            </button>
            <button
              onClick={() => mediaControl('toggle')}
              className="neon-accent grid h-11 w-11 place-items-center rounded-full"
              aria-label="播放/暂停"
            >
              {music.playing === false ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2l10 6-10 6z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3.5" y="2.5" width="3.5" height="11" rx="1" />
                  <rect x="9" y="2.5" width="3.5" height="11" rx="1" />
                </svg>
              )}
            </button>
            <button
              onClick={() => mediaControl('next')}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-zinc-300 transition-colors hover:bg-white/20"
              aria-label="下一首"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11 3h2v10h-2zM3 3l7 5-7 5z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* CPU */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] tracking-widest text-zinc-500">CPU 使用率</span>
          <span className="text-[15px] font-medium text-white tabular-nums">{stats.cpu}%</span>
        </div>
        <Bar value={stats.cpu} />
        <div className="mt-1.5 truncate text-[11px] text-zinc-600">
          {stats.cpuModel} · {stats.cpuCores} 核
        </div>
      </div>

      {/* 内存 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] tracking-widest text-zinc-500">内存</span>
          <span className="text-[15px] font-medium text-white tabular-nums">
            {fmtGB(stats.memUsed)} / {fmtGB(stats.memTotal)} GB
          </span>
        </div>
        <Bar value={stats.memPercent} />
        <div className="mt-1.5 text-[11px] text-zinc-600">已使用 {stats.memPercent}%</div>
      </div>

      {/* 电源 */}
      <div className="flex items-center justify-between rounded-2xl bg-island-card px-4 py-3">
        <div>
          <div className="text-[14px] text-white">电源</div>
          <div className="text-[12px] text-zinc-500">
            {stats.onBattery
              ? `使用电池 · ${stats.batteryPercent}%`
              : stats.charging
                ? `充电中 · ${stats.batteryPercent}%`
                : '已接通电源'}
          </div>
        </div>
        <div className="text-2xl">{stats.onBattery ? '🔋' : '🔌'}</div>
      </div>

      {/* 运行时间 */}
      <div className="flex items-center justify-between rounded-2xl bg-island-card px-4 py-3">
        <div>
          <div className="text-[14px] text-white">系统运行时间</div>
          <div className="text-[12px] text-zinc-500">{fmtUptime(stats.uptime)}</div>
        </div>
        <div className="text-2xl">⏱️</div>
      </div>
    </div>
  )
}
