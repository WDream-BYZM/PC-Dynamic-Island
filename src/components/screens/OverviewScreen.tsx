import { useEffect, useState } from 'react'
import { useStore } from '../../lib/store'
import { musicStore } from '../../lib/music'
import { audioActivity } from '../../lib/audioActivity'
import MusicVisualizer from '../MusicVisualizer'

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function greeting(h: number) {
  if (h < 5) return '夜深了'
  if (h < 9) return '早上好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  if (h < 22) return '晚上好'
  return '夜深了'
}

export default function OverviewScreen() {
  const [now, setNow] = useState(() => new Date())
  const music = useStore(musicStore)
  const audio = useStore(audioActivity)
  const mediaControl = (action: 'prev' | 'toggle' | 'next') => window.eisland?.musicControl(action)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
  const week = `星期${WEEK[now.getDay()]}`

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* 霓虹微光背景：青 / 品红 / 紫三色光晕叠加 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/4 h-52 w-64 -translate-x-1/2 rounded-full bg-[#22d3ee]/10 blur-[80px]" />
        <div className="absolute -top-16 right-1/4 h-52 w-64 translate-x-1/2 rounded-full bg-[#e879f9]/10 blur-[80px]" />
        <div className="absolute -bottom-8 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-[#a78bfa]/10 blur-[90px]" />
      </div>
      {music && (audio.isPlaying || !audio.analyser) && <MusicVisualizer />}

      {/* 主内容区：在剩余空间中垂直居中，不受底部音乐控制挤压 */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        <div className="text-[13px] tracking-[0.35em] text-zinc-400">{greeting(now.getHours())}</div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-[76px] font-extralight leading-none tracking-tight text-white tabular-nums">
            {hh}:{mm}
          </span>
          <span className="text-[22px] font-light text-zinc-500 tabular-nums">{ss}</span>
        </div>

        <div className="mt-4 text-[15px] text-zinc-300">
          {dateStr}
          <span className="mx-2 text-zinc-600">·</span>
          {week}
        </div>

        <div className="mt-8 flex items-center gap-2 text-[12px] text-zinc-500">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
          正以灵动岛模式运行
        </div>
      </div>

      {/* 底部音乐控制 */}
      {music && (audio.isPlaying || !audio.analyser) && (
        <div className="relative z-10 flex w-full items-center justify-between gap-3 px-6 pb-5 pt-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] text-white">{music.title}</div>
            {music.artist && <div className="truncate text-[11px] text-zinc-500">{music.artist}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => mediaControl('prev')}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-zinc-300 transition-colors hover:bg-white/20"
              aria-label="上一首"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3 3h2v10H3zM13 3l-7 5 7 5z" />
              </svg>
            </button>
            <button
              onClick={() => mediaControl('toggle')}
              className="neon-accent grid h-10 w-10 place-items-center rounded-full"
              aria-label="播放/暂停"
            >
              {/* 图标由真实音频检测驱动：有声音=暂停钮（点击暂停），无声音=播放钮（点击播放） */}
              {audio.isPlaying ? (
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3.5" y="2.5" width="3.5" height="11" rx="1" />
                  <rect x="9" y="2.5" width="3.5" height="11" rx="1" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2l10 6-10 6z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => mediaControl('next')}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-zinc-300 transition-colors hover:bg-white/20"
              aria-label="下一首"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11 3h2v10h-2zM3 3l7 5-7 5z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
