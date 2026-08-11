/** 轻量天气查询（供定时上岛推送使用），Open-Meteo 免费 API */
import { createStore } from './store'

const WMO: Record<number, { label: string; icon: string }> = {
  0: { label: '晴', icon: '☀️' },
  1: { label: '大部晴朗', icon: '🌤️' },
  2: { label: '多云', icon: '⛅' },
  3: { label: '阴', icon: '☁️' },
  45: { label: '雾', icon: '🌫️' },
  48: { label: '冻雾', icon: '🌫️' },
  51: { label: '毛毛雨', icon: '🌦️' },
  53: { label: '毛毛雨', icon: '🌦️' },
  55: { label: '毛毛雨', icon: '🌦️' },
  56: { label: '冻雨', icon: '🌧️' },
  57: { label: '冻雨', icon: '🌧️' },
  61: { label: '小雨', icon: '🌧️' },
  63: { label: '中雨', icon: '🌧️' },
  65: { label: '大雨', icon: '🌧️' },
  66: { label: '冻雨', icon: '🌧️' },
  67: { label: '冻雨', icon: '🌧️' },
  71: { label: '小雪', icon: '🌨️' },
  73: { label: '中雪', icon: '🌨️' },
  75: { label: '大雪', icon: '❄️' },
  77: { label: '雪粒', icon: '🌨️' },
  80: { label: '阵雨', icon: '🌦️' },
  81: { label: '阵雨', icon: '🌧️' },
  82: { label: '强阵雨', icon: '⛈️' },
  85: { label: '阵雪', icon: '🌨️' },
  86: { label: '强阵雪', icon: '❄️' },
  95: { label: '雷暴', icon: '⛈️' },
  96: { label: '雷暴伴冰雹', icon: '⛈️' },
  99: { label: '强雷暴', icon: '⛈️' }
}

export function meta(code: number) {
  return WMO[code] ?? { label: '未知', icon: '🌡️' }
}

export interface CurrentWeather {
  city: string
  temp: number
  code: number
  label: string
  icon: string
}

/** 常驻当前天气缓存（折叠胶囊默认显示） */
export const weatherStore = createStore<CurrentWeather | null>(null)

/** 拉取并缓存当前城市天气（失败保留旧值，供胶囊常驻显示） */
export async function refreshWeather(): Promise<void> {
  const city = (localStorage.getItem('eisland.city') ?? '北京').trim() || '北京'
  try {
    const w = await fetchCurrentWeather(city)
    weatherStore.set(w)
  } catch {
    /* 失败保留旧值，下次再试 */
  }
}

/** 查询当前天气（温度 + 天气状况），供定时推送 */
export async function fetchCurrentWeather(cityName: string): Promise<CurrentWeather> {
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=zh`
  )
  const geo = await geoRes.json()
  if (!geo.results?.length) throw new Error(`未找到城市「${cityName}」`)

  const { latitude, longitude, name } = geo.results[0]
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`
  const w = await (await fetch(url)).json()
  const m = meta(w.current.weather_code)
  return {
    city: name,
    temp: Math.round(w.current.temperature_2m),
    code: w.current.weather_code,
    label: m.label,
    icon: m.icon
  }
}

/** 定时推送点（早上 8 点 / 中午 12 点 / 晚上 6 点） */
export const WEATHER_PUSH_SLOTS = ['08:00', '12:00', '18:00'] as const

interface PushRecord {
  date: string
  slots: string[]
}

function loadRecord(): PushRecord {
  try {
    return JSON.parse(localStorage.getItem('eisland.weatherPushed') ?? '') ?? { date: '', slots: [] }
  } catch {
    return { date: '', slots: [] }
  }
}

/** 记录某天的某个时段已推送，返回是否是新记录的时段 */
function markPushed(date: string, slot: string): boolean {
  const rec = loadRecord()
  if (rec.date !== date) {
    localStorage.setItem('eisland.weatherPushed', JSON.stringify({ date, slots: [slot] }))
    return true
  }
  if (rec.slots.includes(slot)) return false
  rec.slots.push(slot)
  localStorage.setItem('eisland.weatherPushed', JSON.stringify(rec))
  return true
}

/**
 * 检查当前时间是否到推送点（每天 08:00 / 12:00 / 18:00，每时段仅推一次）。
 * 到点返回 slot，否则返回 null。
 */
export function duePushSlot(now = new Date()): string | null {
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const slot = `${hh}:${mm}`
  if (!(WEATHER_PUSH_SLOTS as readonly string[]).includes(slot)) return null
  const date = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  return markPushed(date, slot) ? slot : null
}
