import { useEffect, useRef, useState } from 'react'
import type { AgentConfig, ChatMessage } from '../../types'
import { getActiveAgentId, loadAgents, setActiveAgentId } from '../../lib/agents'
import { setActivity, clearActivity } from '../../lib/activity'
import { loadHistory, saveHistory } from '../../lib/chatHistory'

export default function AiScreen({ onGoSettings }: { onGoSettings: () => void }) {
  const [agents] = useState<AgentConfig[]>(() => loadAgents())
  const [activeId, setActiveId] = useState(() => getActiveAgentId())
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory(getActiveAgentId()))
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const messagesRef = useRef<ChatMessage[]>(messages)

  // 聊天记录持久化：消息变化自动保存到当前智能体（含流式过程）
  useEffect(() => {
    messagesRef.current = messages
    saveHistory(activeId, messages)
  }, [messages, activeId])

  const unavailable = typeof window === 'undefined' || !window.eisland

  // 进入 AI 屏即视为已查看，清除上岛提示
  useEffect(() => {
    clearActivity('ai')
  }, [])
  // 仅统计已配置 API Key 的智能体：未配置任何 Key 时 AI 功能默认不启用
  const configuredAgents = agents.filter((a) => a.apiKey.trim().length > 0)
  const hasConfigured = configuredAgents.length > 0
  const active =
    agents.find((a) => a.id === activeId && a.apiKey.trim().length > 0) ??
    configuredAgents[0] ??
    agents[0]

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const switchAgent = (id: string) => {
    if (busy) return
    // 先保存当前智能体的记录，再加载目标智能体的
    saveHistory(activeId, messagesRef.current)
    setActiveAgentId(id)
    setActiveId(id)
    setMessages(loadHistory(id))
    setError(null)
  }

  const send = () => {
    const text = input.trim()
    if (!text || busy) return
    if (!active?.apiKey) {
      setError('请先在「设置」中为该智能体填写 API Key')
      return
    }
    setInput('')
    setError(null)
    const history: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setBusy(true)
    let acc = ''
    stopRef.current = window.eisland.aiChat({
      agent: active,
      messages: history.slice(-12),
      onChunk: (t) => {
        acc += t
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: acc }
          return next
        })
      },
      onDone: () => {
        stopRef.current = null
        setBusy(false)
        // AI 回复完成：若用户没在看，上岛提示
        setActivity(
          { type: 'ai', title: active?.name ?? 'AI', subtitle: '回复完成', icon: '🤖', target: 'ai' },
          8000
        )
      },
      onError: (msg) => {
        stopRef.current = null
        setBusy(false)
        setError(msg)
        setMessages((prev) => (acc ? prev : prev.slice(0, -1)))
      }
    })
  }

  const clearChat = () => {
    if (busy) return
    setMessages([])
    setError(null)
  }

  // 未配置任何 API Key：AI 功能默认不启用，引导用户去设置接入
  if (!hasConfigured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-4xl">🤖</div>
        <div className="text-[15px] font-medium text-white">AI 对话未启用</div>
        <div className="text-[13px] leading-relaxed text-zinc-500">
          尚未配置 API。前往设置填入你的 API Key，即可开始 AI 对话。
        </div>
        <button
          onClick={onGoSettings}
          className="neon-accent mt-1 rounded-full px-5 py-2 text-[13px] font-medium transition-opacity hover:opacity-90"
        >
          去配置
        </button>
      </div>
    )
  }

  if (unavailable) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-zinc-500">
        <div className="text-3xl">🤖</div>
        <div className="text-[13px]">AI 对话仅在桌面应用中可用</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* agent 选择器 */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2 pt-3">
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => switchAgent(a.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-[12px] transition-colors ${
              active?.id === a.id
                  ? 'neon-accent'
                : 'bg-white/5 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {a.name}
          </button>
        ))}
      </div>

      {/* 消息列表 */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-1.5 text-center text-zinc-500">
            <div className="text-3xl">🤖</div>
            <div className="text-[13px]">和「{active?.name}」打个招呼吧</div>
            <div className="text-[11px] text-zinc-600">{active?.description ?? ''}</div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                m.role === 'user'
                  ? 'rounded-br-md bg-[#22d3ee] text-black'
                  : 'rounded-bl-md bg-white/10 text-zinc-100'
              }`}
            >
              {m.content}
              {busy && i === messages.length - 1 && m.role === 'assistant' && m.content === '' && (
                <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-[#22d3ee] align-middle" />
              )}
            </div>
          </div>
        ))}

        {error && <div className="text-center text-[12px] text-red-400">{error}</div>}
      </div>

      {/* 输入区 */}
      <div className="shrink-0 border-t border-island-line px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            placeholder={`问「${active?.name}」点什么…`}
            className="max-h-[88px] min-h-[38px] flex-1 resize-none rounded-xl border border-island-line bg-island-card px-3 py-2 text-[13px] text-white outline-none placeholder:text-zinc-600 focus:border-island-accent/50"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="neon-accent grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-opacity disabled:opacity-40"
            aria-label="发送"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M14 2 2 8l4.5 1L8 14l6-12Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between px-0.5 text-[10px] text-zinc-600">
          <span>Enter 发送 · Shift+Enter 换行</span>
          <button onClick={clearChat} className="hover:text-zinc-400">
            清空对话
          </button>
        </div>
      </div>
    </div>
  )
}
