import { useEffect, useState, type RefObject } from 'react'
import CpuRing from './CpuRing'
import { useIslandActivity, capsuleWidth } from '../lib/activity'
import { useStore } from '../lib/store'
import { weatherStore } from '../lib/weather'
import OverviewScreen from './screens/OverviewScreen'
import AiScreen from './screens/AiScreen'
import TranslateScreen from './screens/TranslateScreen'
import WeatherScreen from './screens/WeatherScreen'
import TimerScreen from './screens/TimerScreen'
import StatusScreen from './screens/StatusScreen'
import SocialScreen from './screens/SocialScreen'
import SearchScreen from './screens/SearchScreen'
import SettingsScreen from './screens/SettingsScreen'

export type IslandScreen =
  | 'overview'
  | 'ai'
  | 'translate'
  | 'weather'
  | 'timer'
  | 'status'
  | 'social'
  | 'search'
  | 'settings'

const NAV: { id: IslandScreen; label: string }[] = [
  { id: 'overview', label: '总览' },
  { id: 'ai', label: 'AI' },
  { id: 'translate', label: '翻译' },
  { id: 'social', label: '消息' },
  { id: 'search', label: '搜索' },
  { id: 'weather', label: '天气' },
  { id: 'timer', label: '计时' },
  { id: 'status', label: '状态' },
  { id: 'settings', label: '设置' }
]

interface IslandProps {
  expanded: boolean
  screen: IslandScreen
  glow: boolean
  mode: 'island' | 'notch'
  capsuleRef: RefObject<HTMLDivElement | null>
  panelRef: RefObject<HTMLDivElement | null>
  onExpand: () => void
  onCollapse: () => void
  onNavigate: (screen: IslandScreen) => void
}

export default function Island({
  expanded,
  screen,
  glow,
  mode,
  capsuleRef,
  panelRef,
  onExpand,
  onCollapse,
  onNavigate
}: IslandProps) {
  const activity = useIslandActivity()
  const weather = useStore(weatherStore)
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')

  // 折叠态 CPU 使用率：每 2s 轮询主进程采样
  const [cpu, setCpu] = useState(0)
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const s = await window.eisland?.getSystemStats()
        if (alive && s) setCpu(s.cpu)
      } catch {
        /* 忽略采样失败 */
      }
    }
    tick()
    const id = setInterval(tick, 2000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  return (
    <div className="absolute inset-0">
      {/* 折叠态胶囊：悬停即展开 */}
      <div
        ref={capsuleRef}
        className={`absolute left-1/2 z-20 -translate-x-1/2 ${
          mode === 'notch' ? 'top-0' : 'top-1/2 -translate-y-1/2'
        } ${expanded ? 'pointer-events-none' : ''}`}
      >
        <button
          style={{ width: capsuleWidth(mode, activity) }}
          onClick={() => {
            // 上岛内容可点击直达对应屏
            if (activity?.target) onNavigate(activity.target as IslandScreen)
            onExpand()
          }}
          className={`relative flex items-center justify-center gap-2.5 bg-island-bg transition-all duration-300 ease-island ${
            mode === 'notch' ? 'h-11 rounded-b-[22px] rounded-t-none' : 'h-12 rounded-full'
          } ${
            glow ? 'neon-ring neon-frame neon-glow' : ''
          } ${expanded ? 'pointer-events-none scale-90 opacity-0' : 'opacity-100'}`}
        >
          {/* 时间常驻显示 */}
          {/* CPU 圆环：绝对定位左侧，只移动圆环，不影响时间/活动居中 */}
          <span className="absolute left-[24px] top-1/2 -translate-y-1/2">
            <CpuRing percent={cpu} />
          </span>
          <span className="text-[15px] font-semibold tabular-nums tracking-wide text-island">
            {hh}:{mm}
          </span>
          {activity ? (
            <>
              <span className="h-4 w-px bg-island-line" />
              {activity.icon && <span className="text-[14px] leading-none">{activity.icon}</span>}
              <span className="text-[14px] font-semibold tabular-nums text-island">
                {activity.title}
              </span>
              {activity.subtitle && (
                <span className="max-w-[88px] truncate text-[11px] font-medium text-sub">
                  {activity.subtitle}
                </span>
              )}
            </>
          ) : weather ? (
            <>
              <span className="h-4 w-px bg-island-line" />
              <span className="text-[14px] leading-none">{weather.icon}</span>
              <span className="text-[14px] font-semibold tabular-nums text-island">{weather.temp}°</span>
              <span className="max-w-[56px] truncate text-[11px] font-medium text-sub">{weather.label}</span>
            </>
          ) : null}
        </button>
      </div>

      {/* 展开面板：宽度固定，从胶囊高度向下展开到全高（缩略→全览） */}
      <div
        ref={panelRef}
        className={`absolute left-1/2 z-20 -translate-x-1/2 transition-all duration-300 ease-island ${
          mode === 'notch' ? 'top-0' : 'top-1/2 -translate-y-1/2'
        } ${expanded ? '' : 'pointer-events-none'}`}
        style={{
          width: 520,
          height: expanded ? 448 : mode === 'notch' ? 44 : 48,
          opacity: expanded ? 1 : 0,
          borderRadius: mode === 'notch' ? '0 0 26px 26px' : '26px',
          overflow: 'hidden'
        }}
      >
        <div
          className={`relative flex h-full w-full flex-col overflow-hidden bg-island-panel ${
            mode === 'notch' ? 'rounded-b-island rounded-t-none' : 'rounded-island'
          } ${
            glow ? 'neon-ring neon-frame neon-glow' : ''
          }`}
        >
          {/* header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-island-line px-4">
            <div
              className="flex items-center gap-1 overflow-x-auto"
              onWheel={(e) => {
                // 功能栏超出宽度时：把鼠标滚轮（垂直）转为横向滚动
                const el = e.currentTarget
                if (el.scrollWidth > el.clientWidth) {
                  e.preventDefault()
                  el.scrollLeft += e.deltaY
                }
              }}
            >
              {NAV.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onNavigate(n.id)}
                  className={`flex h-8 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-[13px] transition-colors duration-200 ${
                    screen === n.id
                      ? 'neon-accent font-medium'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>
            <button
              onClick={onCollapse}
              aria-label="收起"
              className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition-colors duration-200 hover:bg-white/10 hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 9.5 7 4l5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* content */}
          <div className="relative min-h-0 flex-1">
            {screen === 'overview' && <OverviewScreen />}
            {screen === 'ai' && <AiScreen onGoSettings={() => onNavigate('settings')} />}
            {screen === 'translate' && <TranslateScreen onGoSettings={() => onNavigate('settings')} />}
            {screen === 'social' && <SocialScreen />}
            {screen === 'search' && <SearchScreen />}
            {screen === 'weather' && <WeatherScreen />}
            {screen === 'timer' && <TimerScreen />}
            {screen === 'status' && <StatusScreen />}
            {screen === 'settings' && <SettingsScreen />}
          </div>
        </div>
      </div>
    </div>
  )
}
