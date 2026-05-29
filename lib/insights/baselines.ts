import type { DaySummary, Baselines } from './types'

type NumericKey = 'hrv' | 'restingHr' | 'sleepMinutes' | 'calories' | 'protein' |
                  'weight' | 'activeEnergy' | 'activityMinutes'

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function windowMean(days: DaySummary[], n: number, key: NumericKey): number | null {
  const vals = days
    .slice(-n)
    .map(d => d[key])
    .filter((v): v is number => typeof v === 'number')
  return mean(vals)
}

export function computeBaselines(days: DaySummary[]): Baselines {
  return {
    hrv7d:              windowMean(days, 7,  'hrv'),
    hrv14d:             windowMean(days, 14, 'hrv'),
    restingHr7d:        windowMean(days, 7,  'restingHr'),
    restingHr14d:       windowMean(days, 14, 'restingHr'),
    sleepMinutes7d:     windowMean(days, 7,  'sleepMinutes'),
    sleepMinutes14d:    windowMean(days, 14, 'sleepMinutes'),
    calories7d:         windowMean(days, 7,  'calories'),
    calories14d:        windowMean(days, 14, 'calories'),
    protein7d:          windowMean(days, 7,  'protein'),
    weight7d:           windowMean(days, 7,  'weight'),
    weight14d:          windowMean(days, 14, 'weight'),
    weight30d:          windowMean(days, 30, 'weight'),
    activityMinutes7d:  windowMean(days, 7,  'activityMinutes'),
    activityMinutes14d: windowMean(days, 14, 'activityMinutes'),
  }
}

/**
 * Ordinary-least-squares slope across nullable values.
 * Returns units-per-step, or null if fewer than minPoints non-null values.
 */
export function linearSlope(values: (number | null)[], minPoints = 3): number | null {
  const pts = values
    .map((v, i) => ({ x: i, y: v }))
    .filter((p): p is { x: number; y: number } => p.y != null)

  if (pts.length < minPoints) return null

  const n    = pts.length
  const sumX  = pts.reduce((s, p) => s + p.x, 0)
  const sumY  = pts.reduce((s, p) => s + p.y, 0)
  const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sumX2 - sumX * sumX

  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
}
