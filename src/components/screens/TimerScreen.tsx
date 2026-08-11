import { useState } from 'react'
import type { WheelEvent } from 'react'
import { useStore } from '../../lib/store'
import {
  timerStore,
  formatTime,
  startCountdown,
  pauseCountdown,
  resumeCountdown,
  resetCountdown,
  startStopwatch,
  pauseStopwatch,
  resumeStopwatch,
  resetStopwatch,
  setTimerMode
} from '../../lib/timerStore'

const RADIUS = 82
const CIRC = 2 * Math.PI * RADIUS

const numCls =
  'no-drag w-16 rounded-xl border border-island-line bg-island-card px-2 py-1.5 text-center text-[22px] text-island outline-none focus:border-[#22d3ee]/50'

export default function TimerScreen() {
  const s = useStore(timerStore)
  const { mode, total, remaining, cdRunning: running, cdDone: done, swRunning, swElapsed } = s

  const [hh, setHh] = useState('0')
  const [mm, setMm] = useState('5')
  const [ss, setSs] = useState('0')

  const digits = (v: string) => v.replace(/\D/g, '')

  // 滚轮 / 触控板上下滑动调整数字（计时屏本身不滚动，无需 preventDefault）
  const wheel =
    (setter: (v: string) => void, max: number) => (e: WheelEvent<HTMLInputElement>) => {
      const cur = parseInt(e.currentTarget.value, 10) || 0
      const next = Math.min(max, Math.max(0, cur + (e.deltaY < 0 ? 1 : -1)))
      setter(String(next))
    }

  const progress = mode === 'countdown' ? (total > 0 ? remaining / total : 0) : 1
  const display =
    mode === 'countdown'
      ? total > 0
        ? formatTime(remaining)
        : '00:00:00'
      : formatTime(swElapsed)
  const statusText =
    mode === 'countdown'
      ? running
        ? '进行中'
        : done
          ? '时间到'
          : total > 0
            ? '已暂停'
            : '待开始'
      : swRunning
        ? '计时中'
        : swElapsed > 0
          ? '已暂停'
          : '待开始'

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6">
      {/* 模式切换 */}
      <div className="flex gap-1 rounded-full bg-island-overlay p-0.5">
        <button
          onClick={() => setTimerMode('countdown')}
          className={`rounded-full px-5 py-0.5 text-[12px] transition-colors ${
            mode === 'countdown' ? 'neon-accent' : 'text-sub hover:text-island'
          }`}
        >
          倒计时
        </button>
        <button
          onClick={() => setTimerMode('stopwatch')}
          className={`rounded-full px-5 py-0.5 text-[12px] transition-colors ${
            mode === 'stopwatch' ? 'neon-accent' : 'text-sub hover:text-island'
          }`}
        >
          正计时
        </button>
      </div>

      {/* 倒计时：霓虹渐变圆环 */}
      {mode === 'countdown' && (
        <div className="relative h-56 w-56">
          <svg width="224" height="224" viewBox="0 0 224 224" className="-rotate-90">
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="50%" stopColor="#e879f9" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
            <circle
              cx="112"
              cy="112"
              r={RADIUS}
              fill="none"
              stroke="var(--island-overlay)"
              strokeWidth="10"
            />
            <circle
              cx="112"
              cy="112"
              r={RADIUS}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
              className="transition-[stroke-dashoffset] duration-300 ease-out"
              style={{ filter: 'drop-shadow(0 0 6px rgba(34,211,238,.6))' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className={`text-[40px] font-extralight text-island tabular-nums ${
                done ? 'animate-pulse' : ''
              }`}
            >
              {display}
            </div>
            <div className="mt-1 text-[12px] text-sub">{statusText}</div>
          </div>
        </div>
      )}

      {/* 正计时：大时间（无圆环） */}
      {mode === 'stopwatch' && (
        <div className="flex h-56 flex-col items-center justify-center">
          <div className="text-6xl font-extralight text-island tabular-nums">{display}</div>
          <div className="mt-2 text-[12px] text-sub">{statusText}</div>
        </div>
      )}

      {/* 倒计时输入 */}
      {mode === 'countdown' && total === 0 && (
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <input
              value={hh}
              onChange={(e) => setHh(digits(e.target.value))}
              onWheel={wheel(setHh, 99)}
              className={numCls}
            />
            <span className="text-[11px] text-dim">小时</span>
          </div>
          <span className="pb-3 text-[18px] text-faint">:</span>
          <div className="flex flex-col items-center gap-1">
            <input
              value={mm}
              onChange={(e) => setMm(digits(e.target.value))}
              onWheel={wheel(setMm, 59)}
              className={numCls}
            />
            <span className="text-[11px] text-dim">分钟</span>
          </div>
          <span className="pb-3 text-[18px] text-faint">:</span>
          <div className="flex flex-col items-center gap-1">
            <input
              value={ss}
              onChange={(e) => setSs(digits(e.target.value))}
              onWheel={wheel(setSs, 59)}
              className={numCls}
            />
            <span className="text-[11px] text-dim">秒</span>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        {mode === 'countdown' ? (
          total === 0 ? (
            <button
              onClick={() =>
                startCountdown(parseInt(hh, 10) || 0, parseInt(mm, 10) || 0, parseInt(ss, 10) || 0)
              }
              className="neon-accent rounded-full px-8 py-1.5 text-[14px] font-medium transition-opacity hover:opacity-90"
            >
              开始
            </button>
          ) : (
            <>
              <button
                onClick={running ? pauseCountdown : resumeCountdown}
                className="rounded-full bg-island-overlay px-6 py-1.5 text-[14px] font-medium text-island transition-colors hover:bg-white/20"
              >
                {running ? '暂停' : '继续'}
              </button>
              <button
                onClick={resetCountdown}
                disabled={running}
                className="rounded-full bg-island-overlay px-5 py-1.5 text-[14px] text-sub transition-colors hover:bg-white/20 hover:text-island disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-island-overlay disabled:hover:text-sub"
              >
                重置
              </button>
            </>
          )
        ) : swElapsed === 0 && !swRunning ? (
          <button
            onClick={startStopwatch}
            className="neon-accent rounded-full px-8 py-1.5 text-[14px] font-medium transition-opacity hover:opacity-90"
          >
            开始
          </button>
        ) : (
          <>
            <button
              onClick={swRunning ? pauseStopwatch : resumeStopwatch}
              className="rounded-full bg-island-overlay px-6 py-1.5 text-[14px] font-medium text-island transition-colors hover:bg-white/20"
            >
              {swRunning ? '暂停' : '继续'}
            </button>
            <button
              onClick={resetStopwatch}
              disabled={swRunning}
              className="rounded-full bg-island-overlay px-5 py-1.5 text-[14px] text-sub transition-colors hover:bg-white/20 hover:text-island disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-island-overlay disabled:hover:text-sub"
            >
              重置
            </button>
          </>
        )}
      </div>
    </div>
  )
}
