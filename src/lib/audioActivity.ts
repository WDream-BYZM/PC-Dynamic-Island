import { createStore } from './store'

/** 系统音频活动：analyser 供频谱绘制，isPlaying 表示当前是否有声音输出 */
export const audioActivity = createStore<{ analyser: AnalyserNode | null; isPlaying: boolean }>({
  analyser: null,
  isPlaying: false
})

let started = false

/** 启动系统环回音频捕获，持续检测是否有声音（应用级单例，失败自动重试） */
export function ensureAudioCapture() {
  if (started) return
  started = true
  let retries = 0
  const tryCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true })
      const ac = new AudioContext()
      // 自动播放策略：无用户手势时 AudioContext 可能 suspended，主动 resume 并在交互时补激活
      const ensureResume = () => {
        if (ac.state === 'suspended') ac.resume().catch(() => {})
      }
      ensureResume()
      window.addEventListener('pointerdown', ensureResume)
      window.addEventListener('keydown', ensureResume)

      const src = ac.createMediaStreamSource(stream)
      const analyser = ac.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7
      src.connect(analyser)
      const freq = new Uint8Array(analyser.frequencyBinCount)
      audioActivity.set({ analyser, isPlaying: false })
      let pausedTimer: ReturnType<typeof setTimeout> | null = null
      const check = () => {
        analyser.getByteFrequencyData(freq)
        let sum = 0
        for (let i = 0; i < freq.length; i++) sum += freq[i]
        const playing = sum / freq.length / 255 > 0.03
        if (playing) {
          if (pausedTimer) {
            clearTimeout(pausedTimer)
            pausedTimer = null
          }
          if (!audioActivity.get().isPlaying) {
            audioActivity.set({ analyser, isPlaying: true })
          }
        } else if (audioActivity.get().isPlaying && !pausedTimer) {
          // 暂停后延迟 5 秒确认，避免歌曲间隙静音误判闪烁
          pausedTimer = setTimeout(() => {
            pausedTimer = null
            audioActivity.set({ analyser, isPlaying: false })
          }, 5000)
        }
        // 播放中：全速采样供频谱绘制；未播放：降到低频检测（省 CPU，仅用于监听是否有声音恢复）
        if (audioActivity.get().isPlaying) requestAnimationFrame(check)
        else setTimeout(check, 500)
      }
      check()
    } catch {
      // 捕获失败：延迟重试，最多 10 次
      if (retries++ < 10) setTimeout(tryCapture, 3000)
    }
  }
  void tryCapture()
}
