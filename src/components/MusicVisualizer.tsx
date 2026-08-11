import { useEffect, useRef } from 'react'
import { useStore } from '../lib/store'
import { audioActivity } from '../lib/audioActivity'

/**
 * 音乐舞台：底部霓虹频谱条（青→粉渐变），用共享的系统环回音频 analyser 绘制真实频谱。
 */
export default function MusicVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audio = useStore(audioActivity)
  const analyserRef = useRef<AnalyserNode | null>(audio.analyser)
  analyserRef.current = audio.analyser
  const freqRef = useRef<Uint8Array | null>(null)
  if (audio.analyser && !freqRef.current) {
    freqRef.current = new Uint8Array(audio.analyser.frequencyBinCount)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const BARS = 60
    const bars = Array.from({ length: BARS }, () => 0.05)

    let raf = 0
    const loop = () => {
      ctx.clearRect(0, 0, w, h)
      const analyser = analyserRef.current
      const freq = freqRef.current
      const bw = w / BARS
      const maxH = h * 0.5
      for (let i = 0; i < BARS; i++) {
        let target: number
        if (analyser && freq) {
          analyser.getByteFrequencyData(freq)
          const idx = Math.floor((i / BARS) * freq.length * 0.45)
          const raw = (freq[idx] ?? 0) / 255
          target = Math.min(1, Math.pow(raw, 0.85) * 0.95)
          bars[i] += (target - bars[i]) * 0.7
        } else {
          bars[i] += (0.02 - bars[i]) * 0.2
        }
        const bh = Math.max(3, bars[i] * maxH)
        const x = i * bw + bw * 0.34
        const bw2 = bw * 0.3
        ctx.fillStyle = `hsl(${190 + (i / BARS) * 126}, 70%, 72%)`
        ctx.globalAlpha = 0.55
        ctx.beginPath()
        ctx.roundRect(x, h - bh, bw2, bh, bw2 / 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
}
