'use client'

export type { SparkColor } from '@/lib/spark-utils'
export { trendColor } from '@/lib/spark-utils'

const STROKE: Record<string, string> = {
  green: '#10b981',
  amber: '#f59e0b',
  red:   '#f43f5e',
  blue:  '#3b82f6',
  gray:  '#9ca3af',
}

interface SparklineProps {
  values: number[]
  color?: string
  width?: number
  height?: number
  className?: string
}

export function Sparkline({
  values,
  color = 'gray',
  width = 64,
  height = 18,
  className,
}: SparklineProps) {
  const clean = values.filter((v): v is number => v != null && !isNaN(v))
  if (clean.length < 2) return null

  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const range = max - min || 1
  const pad = 2

  const pts = clean.map((v, i) => ({
    x: (i / (clean.length - 1)) * width,
    y: height - pad - ((v - min) / range) * (height - pad * 2),
  }))

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const stroke = STROKE[color] ?? STROKE.gray

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d={area}  fill={stroke} fillOpacity={0.12} />
      <path d={line}  stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
