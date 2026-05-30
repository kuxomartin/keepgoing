'use client'

export type SparkColor = 'green' | 'amber' | 'red' | 'blue' | 'gray'

interface SparklineProps {
  values: number[]
  color?: SparkColor
  width?: number
  height?: number
  className?: string
}

const STROKE: Record<SparkColor, string> = {
  green: '#10b981',
  amber: '#f59e0b',
  red:   '#f43f5e',
  blue:  '#3b82f6',
  gray:  '#9ca3af',
}

const FILL: Record<SparkColor, string> = {
  green: '#10b981',
  amber: '#f59e0b',
  red:   '#f43f5e',
  blue:  '#3b82f6',
  gray:  '#9ca3af',
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

  const line  = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area  = `${line} L${width},${height} L0,${height} Z`
  const stroke = STROKE[color]
  const fill   = FILL[color]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d={area}  fill={fill}   fillOpacity={0.12} />
      <path d={line}  stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Compute sparkline color from a values array.
 *  higherIsBetter: true for HRV/Sleep, false for RHR. */
export function trendColor(values: number[], higherIsBetter: boolean): SparkColor {
  const clean = values.filter((v): v is number => v != null && !isNaN(v))
  if (clean.length < 4) return 'gray'
  const half   = Math.floor(clean.length / 2)
  const oldAvg = clean.slice(0, half).reduce((a, b) => a + b, 0) / half
  const newAvg = clean.slice(-half).reduce((a, b) => a + b, 0) / half
  const delta  = (newAvg - oldAvg) / (Math.abs(oldAvg) || 1)
  if (Math.abs(delta) < 0.03) return 'blue'
  const improving = higherIsBetter ? delta > 0 : delta < 0
  if (improving) return 'green'
  if (Math.abs(delta) > 0.08) return 'red'
  return 'amber'
}
