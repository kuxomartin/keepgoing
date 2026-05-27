import type { HealthMetrics, RecoveryResult } from '@/types/database'

/**
 * Computes a simple recovery score (0–100) and a traffic-light status
 * based on today's health metrics.
 *
 * Scoring deductions:
 * - Sleep < 6h:   -30 | Sleep < 7h: -15
 * - HRV  < 40ms:  -25 | HRV < 55:  -10
 * - RHR  > 65bpm: -20 | RHR > 60:  -10
 *
 * Status thresholds:
 * - ≥ 70 → green
 * - ≥ 45 → yellow
 * - < 45 → red
 */
export function getRecoveryScore(metrics: HealthMetrics | null): RecoveryResult {
  if (!metrics) {
    return {
      score: 50,
      status: 'yellow',
      issues: ['No health data for today'],
    }
  }

  let score = 100
  const issues: string[] = []

  // Sleep
  const sleepH = (metrics.sleep_minutes ?? 0) / 60
  if (sleepH < 6) {
    score -= 30
    issues.push(`Short sleep — ${sleepH.toFixed(1)}h (target: ≥7h)`)
  } else if (sleepH < 7) {
    score -= 15
    issues.push(`Sleep slightly below target — ${sleepH.toFixed(1)}h`)
  }

  // HRV
  if (metrics.hrv_ms != null) {
    if (metrics.hrv_ms < 40) {
      score -= 25
      issues.push(`Low HRV — ${metrics.hrv_ms} ms`)
    } else if (metrics.hrv_ms < 55) {
      score -= 10
    }
  }

  // Resting HR
  if (metrics.resting_hr != null) {
    if (metrics.resting_hr > 65) {
      score -= 20
      issues.push(`Elevated resting HR — ${metrics.resting_hr} bpm`)
    } else if (metrics.resting_hr > 60) {
      score -= 10
    }
  }

  score = Math.max(0, Math.min(100, score))
  const status = score >= 70 ? 'green' : score >= 45 ? 'yellow' : 'red'

  return { score, status, issues }
}
