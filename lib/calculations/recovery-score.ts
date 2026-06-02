import type { HealthMetrics, RecoveryResult } from '@/types/database'

/**
 * Computes a recovery score (0–100) and a 4-tier status.
 *
 * Scoring deductions:
 * - Sleep < 6h:   −30 | Sleep < 7h: −15
 * - HRV  < 40ms:  −25 | HRV < 55:  −10
 * - RHR  > 65bpm: −20 | RHR > 60:  −10
 *
 * Status thresholds:
 * - ≥ 85 → green  ("Well recovered")
 * - ≥ 70 → yellow ("Moderately recovered")
 * - ≥ 55 → orange ("Recovery limited")
 * - < 55 → red    ("Low recovery")
 */
export function getRecoveryScore(metrics: HealthMetrics | null): RecoveryResult {
  if (!metrics) {
    return {
      score: 50,
      status: 'orange',
      issues: ['No health data for today'],
    }
  }

  let score = 100
  const issues: string[] = []

  // Sleep — only score if we have actual data (null or 0 = no data, not "0h sleep")
  const sleepH = metrics.sleep_minutes && metrics.sleep_minutes > 0
    ? metrics.sleep_minutes / 60
    : null
  if (sleepH !== null) {
    if (sleepH < 6) {
      score -= 30
      issues.push(`Sleep ${sleepH.toFixed(1)}h — below target`)
    } else if (sleepH < 7) {
      score -= 15
      issues.push(`Sleep ${sleepH.toFixed(1)}h — below target`)
    }
  }

  // HRV
  if (metrics.hrv_ms != null) {
    if (metrics.hrv_ms < 40) {
      score -= 25
      issues.push(`HRV ${metrics.hrv_ms} ms — below threshold`)
    } else if (metrics.hrv_ms < 55) {
      score -= 10
      issues.push(`HRV ${metrics.hrv_ms} ms — below threshold`)
    }
  }

  // Resting HR
  if (metrics.resting_hr != null) {
    if (metrics.resting_hr > 65) {
      score -= 20
      issues.push(`Resting HR ${metrics.resting_hr} bpm — elevated`)
    } else if (metrics.resting_hr > 60) {
      score -= 10
      issues.push(`Resting HR ${metrics.resting_hr} bpm — slightly elevated`)
    }
  }

  score = Math.max(0, Math.min(100, score))

  const status: RecoveryResult['status'] =
    score >= 85 ? 'green'
    : score >= 70 ? 'yellow'
    : score >= 55 ? 'orange'
    : 'red'

  return { score, status, issues }
}
