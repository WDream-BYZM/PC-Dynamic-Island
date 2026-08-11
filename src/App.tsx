import { useCallback, useEffect, useRef, useState } from 'react'
import Island, { type IslandScreen } from './components/Island'
import { addClipboardCapture } from './lib/clipboardStore'
import { setActivity, useIslandActivity, capsuleWidth } from './lib/activity'
import { fetchCurrentWeather, duePushSlot, refreshWeather } from './lib/weather'
import { refreshMusic } from './lib/music'

const ENTER_DELAY = 100 // 悬停展开延迟（防路过误触）
const LEAVE_DELAY = 150 // 移出收起延迟（防面板边缘抖动）

export default function App() {
  const [expanded, setExpanded] = useState(false)
  const [screen, setScreen] = useState<IslandScreen>('overview')
  const [glow, setGlow] = useState(false)
  const [mode, setModeState] = useState<'island' | 'notch'>(
    () => (localStorage.getItem('eisland.mode') as 'island' | 'notch') || 'island'
  )

  const capsuleRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const expandedRef = useRef(false)
  const ignoreRef = useRef(true)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 上岛活动：按活动类型分档计算胶囊宽度，同步主进程窗口尺寸
  const activity = useIslandActivity()
  useEffect(() => {
    window.eisland?.setActivity(capsuleWidth(mode, activity))
  }, [activity, mode])

  // 显示模式（灵动岛 / 刘海）：初始同步主进程，变化时重新定位窗口
  useEffect(() => {
    const initial = (localStorage.getItem('eisland.mode') as 'island' | 'notch') || 'island'
    setModeState(initial)
    window.eisland?.setMode(initial)
    window.eisland?.setState(expandedRef.current)
    const onMode = (e: Event) => {
      const m = (e as CustomEvent<string>).detail as 'island' | 'notch'
      setModeState(m)
      window.eisland?.setMode(m)
      window.eisland?.setState(expandedRef.current)
    }
    window.addEventListener('eisland:mode-change', onMode)
    return () => window.removeEventListener('eisland:mode-change', onMode)
  }, [])

  // 霓虹光晕：计时结束 / 收到消息时触发，持续一段时间后熄灭
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const onGlow = () => {
      setGlow(true)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setGlow(false), 8000)
    }
    window.addEventListener('eisland:glow', onGlow)
    return () => {
      window.removeEventListener('eisland:glow', onGlow)
      if (timer) clearTimeout(timer)
    }
  }, [])

  // 全局剪贴板捕获：无论在哪一屏，复制新内容就上岛提示（消息通知）
  useEffect(() => {
    if (!window.eisland) return
    let last = ''
    let first = true
    const id = setInterval(async () => {
      try {
        const t = await window.eisland.getClipboard()
        if (first) {
          last = t
          first = false
          return
        }
        if (t && t.trim() && t !== last) {
          last = t
          const text = t.trim()
          addClipboardCapture({
            id: Date.now(),
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            text: text.slice(0, 180)
          })
          window.dispatchEvent(new CustomEvent('eisland:glow'))
          setActivity(
            { type: 'message', title: '新消息', subtitle: text.slice(0, 16), icon: '💬', target: 'social' },
            6000
          )
        }
      } catch {
        /* ignore */
      }
    }, 1500)
    return () => clearInterval(id)
  }, [])

  // 定时天气推送：每天 08:00 / 12:00 / 18:00 到点时触发一次
  useEffect(() => {
    const id = setInterval(() => {
      if (duePushSlot()) window.dispatchEvent(new CustomEvent('eisland:weather-push'))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // 常驻天气：启动获取 + 每 30 分钟刷新 + 城市变化时刷新（供折叠胶囊显示）
  useEffect(() => {
    refreshWeather()
    const id = setInterval(refreshWeather, 30 * 60 * 1000)
    const onCity = () => refreshWeather()
    window.addEventListener('eisland:city-change', onCity)
    return () => {
      clearInterval(id)
      window.removeEventListener('eisland:city-change', onCity)
    }
  }, [])

  // 本地网易云音乐：常驻轮询，播放时上岛显示当前歌曲
  useEffect(() => {
    refreshMusic()
    const id = setInterval(refreshMusic, 2000)
    return () => clearInterval(id)
  }, [])

  // 自动更新提醒：检测到新版本 / 已下载时上岛消息提醒，点击跳转设置页
  useEffect(() => {
    const off = window.eisland?.onUpdateStatus((s) => {
      if (s.state === 'available' && s.version) {
        setActivity(
          {
            type: 'message',
            title: `发现新版本 v${s.version}`,
            subtitle: '点击前往设置更新',
            icon: '🔄',
            target: 'settings'
          },
          8000
        )
      } else if (s.state === 'downloaded') {
        setActivity(
          {
            type: 'message',
            title: '新版本已下载',
            subtitle: '点击重启安装',
            icon: '🔄',
            target: 'settings'
          },
          10000
        )
      }
    })
    return () => off?.()
  }, [])

  // 天气推送执行：拉取当前城市天气 → 上岛显示
  useEffect(() => {
    const push = async () => {
      try {
        const city = (localStorage.getItem('eisland.city') ?? '北京').trim() || '北京'
        const w = await fetchCurrentWeather(city)
        setActivity(
          { type: 'weather', title: `${w.city} ${w.temp}°C`, subtitle: w.label, icon: w.icon, target: 'weather' },
          90000
        )
        window.dispatchEvent(new CustomEvent('eisland:glow'))
      } catch {
        /* 推送失败静默，下次到点再试 */
      }
    }
    window.addEventListener('eisland:weather-push', push)
    return () => window.removeEventListener('eisland:weather-push', push)
  }, [])

  /** 设置鼠标穿透（带状态缓存，避免重复 IPC） */
  const setIgnore = useCallback((value: boolean) => {
    if (ignoreRef.current === value) return
    ignoreRef.current = value
    window.eisland?.setIgnoreMouse(value)
  }, [])

  /** 展开/收起（同步 ref、state 与主进程窗口形状） */
  const applyExpand = useCallback((value: boolean) => {
    expandedRef.current = value
    setExpanded(value)
    window.eisland?.setState(value)
  }, [])

  // 悬停展开 / 移出收起，同时驱动鼠标穿透
  useEffect(() => {
    setIgnore(true)
    const onMove = (e: MouseEvent) => {
      const target = expandedRef.current ? panelRef.current : capsuleRef.current
      if (!target) return
      const r = target.getBoundingClientRect()
      const inside =
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom

      setIgnore(!inside)

      if (inside && !expandedRef.current) {
        if (leaveTimer.current) {
          clearTimeout(leaveTimer.current)
          leaveTimer.current = null
        }
        if (!enterTimer.current) {
          enterTimer.current = setTimeout(() => {
            enterTimer.current = null
            applyExpand(true)
          }, ENTER_DELAY)
        }
      } else if (!inside && expandedRef.current) {
        if (enterTimer.current) {
          clearTimeout(enterTimer.current)
          enterTimer.current = null
        }
        if (!leaveTimer.current) {
          leaveTimer.current = setTimeout(() => {
            leaveTimer.current = null
            applyExpand(false)
          }, LEAVE_DELAY)
        }
      }
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (enterTimer.current) clearTimeout(enterTimer.current)
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
    }
  }, [setIgnore, applyExpand])

  // Esc 收起
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') applyExpand(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [applyExpand])

  // 窗口失焦（点击其他界面）时收起
  useEffect(() => {
    const off = window.eisland?.onBlur(() => applyExpand(false))
    return () => off?.()
  }, [applyExpand])

  // 鼠标移出窗口时收起（补充场景：移开鼠标但窗口未失焦）
  useEffect(() => {
    const el = document.documentElement
    const onLeave = () => applyExpand(false)
    el.addEventListener('mouseleave', onLeave)
    return () => el.removeEventListener('mouseleave', onLeave)
  }, [applyExpand])

  return (
    <div className="relative h-full w-full">
      <Island
        expanded={expanded}
        screen={screen}
        glow={glow}
        mode={mode}
        capsuleRef={capsuleRef}
        panelRef={panelRef}
        onExpand={() => applyExpand(true)}
        onCollapse={() => applyExpand(false)}
        onNavigate={setScreen}
      />
    </div>
  )
}
