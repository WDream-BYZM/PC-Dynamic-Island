import { useEffect, useState } from 'react'

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
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden">
      {/* 霓虹微光背景：青 / 品红 / 紫三色光晕叠加 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/4 h-52 w-64 -translate-x-1/2 rounded-full bg-[#22d3ee]/10 blur-[80px]" />
        <div className="absolute -top-16 right-1/4 h-52 w-64 translate-x-1/2 rounded-full bg-[#e879f9]/10 blur-[80px]" />
        <div className="absolute -bottom-8 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-[#a78bfa]/10 blur-[90px]" />
      </div>

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
  )
}
