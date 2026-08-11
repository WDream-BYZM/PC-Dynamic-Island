import { useEffect, useState } from 'react'
import type { AgentConfig } from '../../types'
import { loadAgents, newAgentId, saveAgents } from '../../lib/agents'

const INPUT_CLS =
  'min-w-0 flex-1 rounded-xl border border-island-line bg-island-card px-3 py-2 text-[13px] text-white outline-none placeholder:text-zinc-600 focus:border-island-accent/50'

export default function SettingsScreen() {
  const [city, setCity] = useState(() => localStorage.getItem('eisland.city') ?? '北京')
  const [pinned, setPinned] = useState(true)
  const [autostart, setAutostart] = useState(false)
  const [saved, setSaved] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('eisland.theme') as 'dark' | 'light') || 'dark'
  )
  const [mode, setMode] = useState<'island' | 'notch'>(
    () => (localStorage.getItem('eisland.mode') as 'island' | 'notch') || 'island'
  )

  // AI 智能体管理
  const [agents, setAgents] = useState<AgentConfig[]>(() => loadAgents())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<AgentConfig | null>(null)
  const [aiSaved, setAiSaved] = useState(false)

  // 自动更新状态
  const [updateState, setUpdateState] = useState<
    'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  >('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateError, setUpdateError] = useState('')
  const [updateProgress, setUpdateProgress] = useState(0)

  useEffect(() => {
    window.eisland?.isPinned().then(setPinned).catch(() => {})
    window.eisland?.getAutostart().then(setAutostart).catch(() => {})
  }, [])

  // 订阅自动更新事件（启动后主进程会静默检查一次）
  useEffect(() => {
    const offStatus = window.eisland?.onUpdateStatus((s) => {
      if (s.state === 'checking') {
        setUpdateState('checking')
      } else if (s.state === 'available') {
        setUpdateState('available')
        setUpdateVersion(s.version ?? '')
      } else if (s.state === 'not-available') {
        setUpdateState('not-available')
      } else if (s.state === 'downloaded') {
        setUpdateState('downloaded')
      } else if (s.state === 'error') {
        setUpdateState('error')
        setUpdateError(s.message ?? '更新失败，请稍后重试')
      }
    })
    const offProgress = window.eisland?.onUpdateProgress((p) => {
      setUpdateState('downloading')
      setUpdateProgress(p.percent)
    })
    return () => {
      offStatus?.()
      offProgress?.()
    }
  }, [])

  const checkUpdate = () => {
    setUpdateState('checking')
    window.eisland?.checkUpdate()
  }
  const downloadUpdate = () => {
    setUpdateState('downloading')
    setUpdateProgress(0)
    window.eisland?.downloadUpdate()
  }
  const installUpdate = () => window.eisland?.installUpdate()

  const togglePin = async () => {
    if (!window.eisland) return
    const next = await window.eisland.togglePin()
    setPinned(next)
  }

  const toggleAutostart = async () => {
    if (!window.eisland) return
    const next = await window.eisland.setAutostart(!autostart)
    setAutostart(next)
  }

  // 打开官网（Electron 用系统浏览器，浏览器预览用新窗口兜底）
  const openWebsite = () => {
    const url = 'https://byzmovo.cn'
    if (window.eisland?.openExternal) {
      window.eisland.openExternal(url)
    } else {
      window.open(url, '_blank', 'noopener')
    }
  }

  const saveCity = () => {
    localStorage.setItem('eisland.city', city.trim() || '北京')
    // 通知全局刷新天气（折叠胶囊常驻天气）
    window.dispatchEvent(new CustomEvent('eisland:city-change'))
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  const switchTheme = (t: 'dark' | 'light') => {
    setTheme(t)
    localStorage.setItem('eisland.theme', t)
    document.documentElement.dataset.theme = t
  }

  const switchMode = (m: 'island' | 'notch') => {
    setMode(m)
    localStorage.setItem('eisland.mode', m)
    window.dispatchEvent(new CustomEvent('eisland:mode-change', { detail: m }))
  }

  const selectAgent = (id: string) => {
    const a = agents.find((x) => x.id === id)
    if (a) {
      setEditingId(id)
      setDraft({ ...a })
    }
  }

  const addAgent = () => {
    const a: AgentConfig = {
      id: newAgentId(),
      name: '新智能体',
      description: '自定义智能体',
      systemPrompt: '你是一个乐于助人的 AI 助手。',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: '',
      model: 'deepseek-chat',
      temperature: 0.7
    }
    const list = [...agents, a]
    setAgents(list)
    saveAgents(list)
    setEditingId(a.id)
    setDraft({ ...a })
  }

  const updateDraft = (patch: Partial<AgentConfig>) => {
    if (!draft) return
    setDraft({ ...draft, ...patch })
  }

  const saveDraft = () => {
    if (!draft) return
    const exists = agents.some((a) => a.id === draft.id)
    const list = exists ? agents.map((a) => (a.id === draft.id ? draft : a)) : [...agents, draft]
    setAgents(list)
    saveAgents(list)
    setAiSaved(true)
    setTimeout(() => setAiSaved(false), 1600)
  }

  const removeAgent = () => {
    if (!draft) return
    const list = agents.filter((a) => a.id !== draft.id)
    setAgents(list)
    saveAgents(list)
    setEditingId(null)
    setDraft(null)
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-5">
      {/* 城市 */}
      <div>
        <div className="mb-2 text-[12px] tracking-widest text-zinc-500">天气城市</div>
        <div className="flex items-center gap-2">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="输入城市名，如 上海"
            className={INPUT_CLS}
          />
          <button
            onClick={saveCity}
            className="shrink-0 rounded-xl bg-white/10 px-4 py-2 text-[13px] text-white transition-colors hover:bg-white/15"
          >
            {saved ? '已保存' : '保存'}
          </button>
        </div>
      </div>

      {/* AI 智能体 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] tracking-widest text-zinc-500">AI 智能体</span>
          <button onClick={addAgent} className="text-[12px] text-island-accent hover:underline">
            + 新增
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => selectAgent(a.id)}
              className={`rounded-full px-3 py-1 text-[12px] transition-colors ${
                editingId === a.id
                  ? 'neon-accent'
                  : 'bg-white/5 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>

        {draft && (
          <div className="mt-3 space-y-2 rounded-2xl bg-island-card p-3">
            <input
              value={draft.name}
              onChange={(e) => updateDraft({ name: e.target.value })}
              placeholder="名称"
              className={INPUT_CLS}
            />
            <textarea
              value={draft.systemPrompt}
              onChange={(e) => updateDraft({ systemPrompt: e.target.value })}
              placeholder="系统提示词"
              rows={3}
              className={`${INPUT_CLS} resize-none`}
            />
            <div className="flex gap-2">
              <input
                value={draft.baseUrl}
                onChange={(e) => updateDraft({ baseUrl: e.target.value })}
                placeholder="API 端点 (https://…/v1)"
                className={INPUT_CLS}
              />
              <input
                value={draft.model}
                onChange={(e) => updateDraft({ model: e.target.value })}
                placeholder="模型"
                className={`${INPUT_CLS} w-32 shrink-0`}
              />
            </div>
            <input
              type="password"
              value={draft.apiKey}
              onChange={(e) => updateDraft({ apiKey: e.target.value })}
              placeholder="API Key"
              className={INPUT_CLS}
            />
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[12px] text-zinc-500">温度</span>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={draft.temperature ?? 0.7}
                onChange={(e) => updateDraft({ temperature: Number(e.target.value) })}
                className="flex-1 accent-island-accent"
              />
              <span className="w-8 text-right text-[12px] tabular-nums text-zinc-400">
                {(draft.temperature ?? 0.7).toFixed(1)}
              </span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={saveDraft}
                className="neon-accent flex-1 rounded-xl py-2 text-[13px] font-medium transition-opacity hover:opacity-90"
              >
                {aiSaved ? '已保存' : '保存智能体'}
              </button>
              <button
                onClick={removeAgent}
                className="rounded-xl bg-white/5 px-4 py-2 text-[13px] text-zinc-400 transition-colors hover:bg-red-500/15 hover:text-red-400"
              >
                删除
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 置顶 */}
      <div className="flex items-center justify-between rounded-2xl bg-island-card px-4 py-3">
        <div>
          <div className="text-[14px] text-white">窗口置顶</div>
          <div className="text-[12px] text-zinc-500">保持灵动岛悬浮在其他窗口之上</div>
        </div>
        <button
          onClick={togglePin}
          role="switch"
          aria-checked={pinned}
          className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${
            pinned ? 'bg-[#22d3ee]' : 'bg-white/10'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
              pinned ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* 开机自启动 */}
      <div className="flex items-center justify-between rounded-2xl bg-island-card px-4 py-3">
        <div>
          <div className="text-[14px] text-island">开机自启动</div>
          <div className="text-[12px] text-sub">登录 Windows 后自动运行</div>
        </div>
        <button
          onClick={toggleAutostart}
          role="switch"
          aria-checked={autostart}
          className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${
            autostart ? 'bg-[#22d3ee]' : 'bg-white/10'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
              autostart ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* 显示模式 */}
      <div className="flex items-center justify-between rounded-2xl bg-island-card px-4 py-3">
        <div>
          <div className="text-[14px] text-island">显示模式</div>
          <div className="text-[12px] text-sub">顶部胶囊 / 刘海贴顶</div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => switchMode('island')}
            className={`rounded-full px-4 py-1.5 text-[12px] transition-colors ${
              mode === 'island' ? 'neon-accent' : 'bg-island-overlay text-sub'
            }`}
          >
            灵动岛
          </button>
          <button
            onClick={() => switchMode('notch')}
            className={`rounded-full px-4 py-1.5 text-[12px] transition-colors ${
              mode === 'notch' ? 'neon-accent' : 'bg-island-overlay text-sub'
            }`}
          >
            刘海
          </button>
        </div>
      </div>

      {/* 外观 */}
      <div className="flex items-center justify-between rounded-2xl bg-island-card px-4 py-3">
        <div>
          <div className="text-[14px] text-island">外观</div>
          <div className="text-[12px] text-sub">灵动岛背景主题</div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => switchTheme('dark')}
            className={`rounded-full px-4 py-1.5 text-[12px] transition-colors ${
              theme === 'dark' ? 'neon-accent' : 'bg-island-overlay text-sub'
            }`}
          >
            深色
          </button>
          <button
            onClick={() => switchTheme('light')}
            className={`rounded-full px-4 py-1.5 text-[12px] transition-colors ${
              theme === 'light' ? 'neon-accent' : 'bg-island-overlay text-sub'
            }`}
          >
            浅色
          </button>
        </div>
      </div>

      {/* 软件更新 */}
      <div className="rounded-2xl bg-island-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] text-island">软件更新</div>
            <div className="text-[12px] text-sub">自动检测 GitHub 上的新版本</div>
          </div>
          <span className="text-[11px] text-zinc-500">当前 v1.1.0</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          {updateState === 'idle' && (
            <button
              onClick={checkUpdate}
              className="flex-1 rounded-xl bg-white/10 py-2 text-[13px] text-white transition-colors hover:bg-white/15"
            >
              检查更新
            </button>
          )}
          {updateState === 'checking' && (
            <div className="flex-1 py-2 text-center text-[13px] text-zinc-400">正在检查更新…</div>
          )}
          {updateState === 'not-available' && (
            <div className="flex flex-1 items-center gap-2">
              <span className="flex-1 text-[13px] text-zinc-400">已是最新版本</span>
              <button
                onClick={checkUpdate}
                className="rounded-lg bg-white/5 px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:text-white"
              >
                再查一次
              </button>
            </div>
          )}
          {updateState === 'available' && (
            <div className="flex flex-1 items-center gap-2">
              <span className="flex-1 truncate text-[13px] text-[#22d3ee]">发现新版本 v{updateVersion}</span>
              <button
                onClick={downloadUpdate}
                className="neon-accent shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium"
              >
                下载更新
              </button>
            </div>
          )}
          {updateState === 'downloading' && (
            <div className="flex-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#22d3ee] transition-[width] duration-300"
                  style={{ width: `${updateProgress}%` }}
                />
              </div>
              <div className="mt-1 text-center text-[11px] tabular-nums text-zinc-500">
                {updateProgress.toFixed(1)}%
              </div>
            </div>
          )}
          {updateState === 'downloaded' && (
            <div className="flex flex-1 items-center gap-2">
              <span className="flex-1 truncate text-[13px] text-[#34d399]">已下载 v{updateVersion}</span>
              <button
                onClick={installUpdate}
                className="neon-accent shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium"
              >
                立即重启安装
              </button>
            </div>
          )}
          {updateState === 'error' && (
            <div className="flex flex-1 items-center gap-2">
              <span className="flex-1 truncate text-[12px] text-red-400">{updateError}</span>
              <button
                onClick={checkUpdate}
                className="shrink-0 rounded-lg bg-white/5 px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:text-white"
              >
                重试
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 关于 */}
      <div className="rounded-2xl bg-island-card px-4 py-3">
        <div className="text-[14px] text-island">关于</div>
        <div className="mt-1 space-y-0.5 text-[12px] text-zinc-500">
          <div>PC Dynamic Island v1.1.0 · Electron + React</div>
          <button onClick={openWebsite} className="block text-island transition-colors hover:text-island-accent">
            作者：白依沚梦 · byzmovo.cn ↗
          </button>
          <div>天气数据来自 Open-Meteo（免费开放）</div>
          <div>AI 对话支持 OpenAI 兼容 API（DeepSeek / OpenAI / Ollama 等）</div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-island-line pt-4">
        <div className="text-[12px] text-zinc-600">折叠后胶囊外区域不拦截鼠标</div>
        <button
          onClick={() => window.eisland?.quit()}
          className="rounded-full bg-white/5 px-4 py-1.5 text-[13px] text-zinc-400 transition-colors hover:bg-red-500/15 hover:text-red-400"
        >
          退出
        </button>
      </div>

      {/* 底部作者署名 */}
      <button
        onClick={openWebsite}
        className="pb-1 pt-1 text-center text-[11px] text-zinc-600 transition-colors hover:text-island-accent"
      >
        白依沚梦 · byzmovo.cn ↗
      </button>
    </div>
  )
}
