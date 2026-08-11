import { useState } from 'react'
import type { AgentConfig } from '../../types'
import { loadAgents } from '../../lib/agents'

const LANGS = ['简体中文', '英语', '日语', '韩语', '法语', '德语', '西班牙语', '俄语']

export default function TranslateScreen({ onGoSettings }: { onGoSettings: () => void }) {
  const [agents] = useState<AgentConfig[]>(() => loadAgents())
  const usable = agents.filter((a) => a.apiKey.trim().length > 0)
  const hasConfigured = usable.length > 0
  const unavailable = typeof window === 'undefined' || !window.eisland

  const [src, setSrc] = useState('')
  const [lang, setLang] = useState(LANGS[0])
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const translate = () => {
    const text = src.trim()
    if (!text || busy || usable.length === 0) return
    const base = usable[0]
    const agent: AgentConfig = {
      ...base,
      systemPrompt: `你是专业翻译。将用户输入翻译成${lang}，只输出译文本身，不要附加任何解释或说明。`
    }
    setResult('')
    setError('')
    setBusy(true)
    let acc = ''
    window.eisland.aiChat({
      agent,
      messages: [{ role: 'user', content: text }],
      onChunk: (t) => {
        acc += t
        setResult(acc)
      },
      onDone: () => setBusy(false),
      onError: (m) => {
        setBusy(false)
        setError(m)
      }
    })
  }

  // 未配置任何 API Key：默认不启用
  if (!hasConfigured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-4xl">🌐</div>
        <div className="text-[15px] font-medium text-white">翻译未启用</div>
        <div className="text-[13px] leading-relaxed text-zinc-500">
          尚未配置 API。前往设置填入你的 API Key，即可使用翻译功能。
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
        <div className="text-3xl">🌐</div>
        <div className="text-[13px]">翻译仅在桌面应用中可用</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 px-4 py-4">
      {/* 目标语言选择 */}
      <div className="flex flex-wrap gap-1.5">
        {LANGS.map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`rounded-full px-3 py-1 text-[12px] transition-colors ${
              lang === l
                  ? 'neon-accent'
                : 'bg-white/5 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* 原文输入 */}
      <textarea
        value={src}
        onChange={(e) => setSrc(e.target.value)}
        placeholder="输入要翻译的文本…"
        rows={3}
        className="min-h-0 flex-1 resize-none rounded-2xl border border-island-line bg-island-card px-3.5 py-2.5 text-[13px] leading-relaxed text-white outline-none placeholder:text-zinc-600 focus:border-island-accent/50"
      />

      {/* 翻译按钮 */}
      <div className="flex items-center gap-2">
        <button
          onClick={translate}
          disabled={busy || !src.trim()}
          className="neon-accent rounded-xl px-5 py-2 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? '翻译中…' : `翻译为${lang}`}
        </button>
        <span className="text-[12px] text-zinc-500">使用已配置的 API</span>
      </div>

      {/* 结果 */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-island-line bg-island-card px-3.5 py-2.5">
        {result ? (
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-100">{result}</div>
        ) : (
          <div className="text-[12px] text-zinc-600">
            {error || (busy ? '正在翻译…' : '译文将显示在这里')}
          </div>
        )}
        {error && result && <div className="mt-2 text-[12px] text-red-400">{error}</div>}
      </div>
    </div>
  )
}
