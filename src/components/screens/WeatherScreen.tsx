import { useCallback, useEffect, useState } from 'react'

interface DayForecast {
  date: string
  code: number
  tmax: number
  tmin: number
}

interface WeatherData {
  city: string
  temp: number
  apparent: number
  humidity: number
  wind: number
  code: number
  daily: DayForecast[]
  updated: Date
}

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

function meta(code: number) {
  return WMO[code] ?? { label: '未知', icon: '🌡️' }
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export default function WeatherScreen() {
  const [data, setData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const cityName = (localStorage.getItem('eisland.city') ?? '北京').trim() || '北京'

      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=zh`
      )
      const geo = await geoRes.json()
      if (!geo.results?.length) throw new Error(`未找到城市「${cityName}」`)

      const { latitude, longitude, name } = geo.results[0]
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`
      const w = await (await fetch(url)).json()

      setData({
        city: name,
        temp: Math.round(w.current.temperature_2m),
        apparent: Math.round(w.current.apparent_temperature),
        humidity: Math.round(w.current.relative_humidity_2m),
        wind: Math.round(w.current.wind_speed_10m),
        code: w.current.weather_code,
        daily: w.daily.time.map((t: string, i: number) => ({
          date: t,
          code: w.daily.weather_code[i],
          tmax: Math.round(w.daily.temperature_2m_max[i]),
          tmin: Math.round(w.daily.temperature_2m_min[i])
        })),
        updated: new Date()
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-5">
      {loading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-island-accent" />
          <div className="text-[13px]">正在获取天气</div>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="text-3xl">🌡️</div>
          <div className="text-[13px] text-zinc-400">{error}</div>
          <button
            onClick={load}
            className="rounded-full bg-white/10 px-4 py-1.5 text-[13px] text-white transition-colors hover:bg-white/15"
          >
            重试
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[15px] font-medium text-white">{data.city}</div>
              <div className="mt-0.5 text-[12px] text-zinc-500">{data.updated.toLocaleTimeString('zh-CN')} 更新</div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2">
                <span className="text-4xl font-extralight text-white tabular-nums">{data.temp}°</span>
                <span className="text-2xl">{meta(data.code).icon}</span>
              </div>
              <div className="text-[12px] text-zinc-400">{meta(data.code).label}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-island-card px-3 py-2.5">
              <div className="text-[11px] text-zinc-500">体感</div>
              <div className="mt-0.5 text-[15px] text-white tabular-nums">{data.apparent}°</div>
            </div>
            <div className="rounded-2xl bg-island-card px-3 py-2.5">
              <div className="text-[11px] text-zinc-500">湿度</div>
              <div className="mt-0.5 text-[15px] text-white tabular-nums">{data.humidity}%</div>
            </div>
            <div className="rounded-2xl bg-island-card px-3 py-2.5">
              <div className="text-[11px] text-zinc-500">风速</div>
              <div className="mt-0.5 text-[15px] text-white tabular-nums">{data.wind} km/h</div>
            </div>
          </div>

          <div className="mt-4 flex-1">
            <div className="mb-2 text-[11px] tracking-widest text-zinc-500">未来三天</div>
            <div className="space-y-1.5">
              {data.daily.map((d, i) => (
                <div
                  key={d.date}
                  className="flex items-center justify-between rounded-xl bg-island-card px-3 py-2"
                >
                  <span className="w-12 text-[13px] text-zinc-300">
                    {i === 0 ? '今天' : WEEK[new Date(d.date + 'T00:00:00').getDay()]}
                  </span>
                  <span className="text-base">{meta(d.code).icon}</span>
                  <span className="w-24 text-right text-[13px] tabular-nums text-zinc-400">
                    <span className="text-white">{d.tmax}°</span>
                    <span className="mx-1 text-zinc-600">/</span>
                    {d.tmin}°
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
