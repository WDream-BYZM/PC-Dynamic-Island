interface CpuRingProps {
  /** CPU 使用率 0-100 */
  percent: number
  size?: number
  stroke?: number
}

/**
 * 折叠态胶囊里的 CPU 使用率圆环：
 * 占比多少，圆环就填充多少；颜色随负载变化（<50% 青、50-80% 紫、>=80% 粉红）。
 */
export default function CpuRing({ percent, size = 20, stroke = 2.5 }: CpuRingProps) {
  const p = Math.min(100, Math.max(0, percent))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - p / 100)
  const color = p >= 80 ? '#f472b6' : p >= 50 ? '#e879f9' : '#22d3ee'

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 transition-colors duration-300"
      role="img"
      aria-label={`CPU ${Math.round(p)}%`}
    >
      {/* 底环 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth={stroke}
      />
      {/* 进度环 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}
