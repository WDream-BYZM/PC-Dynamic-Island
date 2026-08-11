import { useEffect, useState } from 'react'
import type { SocialStatus } from '../../types'
import { useStore } from '../../lib/store'
import { clipboardStore } from '../../lib/clipboardStore'
import { clearActivity } from '../../lib/activity'

function AppCard({
  name,
  icon,
  running,
  title
}: {
  name: string
  icon: string
  running: boolean
  title: string
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-island-card px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-[14px] text-white">{name}</div>
          <div className="text-[12px] text-zinc-500">
            {running ? (title.trim() ? `正在与「${title.trim()}」聊天` : '运行中') : '未运行'}
          </div>
        </div>
      </div>
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${
          running ? 'bg-emerald-400' : 'bg-zinc-600'
        }`}
      />
    </div>
  )
}

export default function SocialScreen() {
  const [status, setStatus] = useState<SocialStatus | null>(null)
  const [error, setError] = useState(false)
  const [copied, setCopied] = useState(false)
  const captures = useStore(clipboardStore)
  const unavailable = typeof window === 'undefined' || !window.eisland

  // 点击历史项：复制回剪贴板
  const copyHistory = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* 忽略 */
    }
  }

  // 进入消息屏即视为已查看，清除上岛提示
  useEffect(() => {
    clearActivity('message')
  }, [])

  useEffect(() => {
    if (unavailable) return
    let stop = false
    const tick = async () => {
      try {
        const s = await window.eisland.getSocialStatus()
        if (!stop) setStatus(s)
      } catch {
        if (!stop) setError(true)
      }
    }
    tick()
    const id = setInterval(tick, 3000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [unavailable])

  if (unavailable) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-zinc-500">
        <div className="text-3xl">💬</div>
        <div className="text-[13px]">社交状态仅在桌面应用中可用</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-zinc-500">
        <div className="text-3xl">💬</div>
        <div className="text-[13px]">读取失败，请确认系统支持</div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-zinc-500">
        正在读取…
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-4">
      <AppCard
        name="微信"
        icon="💬"
        running={status.wechat.running}
        title={status.wechat.title}
      />
      <AppCard name="QQ" icon="🐧" running={status.qq.running} title={status.qq.title} />

      {/* 剪贴板捕获 */}
      <div className="rounded-2xl bg-island-card px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] tracking-widest text-zinc-500">剪贴板历史</span>
          <span className="text-[11px] text-zinc-600">点击复制回剪贴板</span>
        </div>
        {copied && <div className="mb-2 text-[12px] text-emerald-400">✓ 已复制到剪贴板</div>}
        {captures.length === 0 ? (
          <div className="text-[12px] text-zinc-600">
            在微信 / QQ 里复制一条消息，它会出现在这里。
          </div>
        ) : (
          <div className="space-y-2">
            {captures.map((c, i) => (
              <button
                key={i}
                onClick={() => copyHistory(c.text)}
                className="w-full rounded-xl bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10"
              >
                <div className="mb-0.5 text-[10px] text-zinc-600">{c.time}</div>
                <div className="whitespace-pre-wrap break-all text-[12px] leading-relaxed text-zinc-200">
                  {c.text}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-1 rounded-2xl bg-white/5 px-4 py-3">
        <div className="text-[12px] leading-relaxed text-zinc-500">
          微信 / QQ 运行状态通过 Windows 无障碍接口读取，每 3 秒刷新。
          <br />
          消息正文安全获取方式：复制到剪贴板后自动捕获，可配合「翻译」使用。
          <br />
          Hook 类工具有封号风险，请谨慎。
        </div>
      </div>
    </div>
  )
}
