/**
 * Pure sparkline utilities — no browser APIs, safe to import in Server Components.
 * The Sparkline React component lives in components/ui/sparkline.tsx ('use client').
 */

export type SparkColor = 'green' | 'amber' | 'red' | 'blue' | 'gray'

/**
 * Compute a status color from a numeric trend.
 * Compares the first-half average against the second-half average.
 *
 * higherIsBetter = true  → HRV, sleep, steps  (higher = improving)
 * higherIsBetter = false → RHR, weight goal   (lower  = improving)
 */
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
