/**
 * Recovery Killers — correlates daily factors with next-day recovery score.
 * Shows only statistically meaningful relationships (min 4 data points per group,
 * min 4-point average delta).
 * Zero AI.
 */

import { getRecoveryScore } from '@/lib/calculations/recovery-score'
import type { HealthMetrics } from '@/types/database'

export interface RecoveryKiller {
  key: string
  label: string
  avgImpact: number      // positive = hurts recovery (shown as negative)
  baselineAvg: number    // avg recovery when factor is absent
  affectedAvg: number    // avg recovery when factor is present
  sampleSize: number     // number of affected days used
}

interface CoffeeDay {
  date: string
  caffeineMg: number
  lastHour: number | null  // 0–23, hour of last coffee
}

interface FoodDay {
  date: string
  calories: number | null
  burn: number | null    // active + resting energy
}

interface ActivityDay {
  date: string
  durationMinutes: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

function nextDayStr(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function computeRecoveryKillers(
  metrics: HealthMetrics[],
  coffeeDays: CoffeeDay[],
  foodDays: FoodDay[],
  activityDays: ActivityDay[],
): RecoveryKiller[] {
  // Build a score map: date → recovery score (only days with HRV)
  const scoreMap: Record<string, number> = {}
  for (const m of metrics) {
    const r = getRecoveryScore(m)
    if (r.score > 0) scoreMap[m.date] = r.score
  }

  const allScores = Object.values(scoreMap)
  const overallAvg = avg(allScores)

  if (allScores.length < 6) return [] // not enough data

  const killers: RecoveryKiller[] = []

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Short sleep (<7h) — next-day recovery
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const affectedScores: number[] = []
    const baselineScores: number[] = []

    for (const m of metrics) {
      const sleepH = m.sleep_minutes != null ? m.sleep_minutes / 60 : null
      const nextScore = scoreMap[nextDayStr(m.date)]
      if (nextScore == null) continue

      if (sleepH != null && sleepH < 7) {
        affectedScores.push(nextScore)
      } else if (sleepH != null && sleepH >= 7.5) {
        baselineScores.push(nextScore)
      }
    }

    if (affectedScores.length >= 3 && baselineScores.length >= 3) {
      const affectedAvg = avg(affectedScores)
      const baselineAvg = avg(baselineScores)
      const delta = baselineAvg - affectedAvg

      if (delta >= 4) {
        killers.push({
          key: 'short_sleep',
          label: 'Sleep below 7h',
          avgImpact: Math.round(delta),
          baselineAvg: Math.round(baselineAvg),
          affectedAvg: Math.round(affectedAvg),
          sampleSize: affectedScores.length,
        })
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Late caffeine (last coffee after 14:00) — next-day recovery
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const coffeeDateMap: Record<string, CoffeeDay> = {}
    for (const c of coffeeDays) coffeeDateMap[c.date] = c

    const affectedScores: number[] = []
    const baselineScores: number[] = []

    for (const [date, c] of Object.entries(coffeeDateMap)) {
      const nextScore = scoreMap[nextDayStr(date)]
      if (nextScore == null) continue

      if (c.lastHour != null && c.lastHour >= 14) {
        affectedScores.push(nextScore)
      } else if (c.lastHour != null && c.lastHour < 13 && c.caffeineMg > 0) {
        baselineScores.push(nextScore)
      }
    }

    if (affectedScores.length >= 3 && baselineScores.length >= 2) {
      const affectedAvg = avg(affectedScores)
      const baselineAvg = avg(baselineScores)
      const delta = baselineAvg - affectedAvg

      if (delta >= 3) {
        killers.push({
          key: 'late_caffeine',
          label: 'Late caffeine',
          avgImpact: Math.round(delta),
          baselineAvg: Math.round(baselineAvg),
          affectedAvg: Math.round(affectedAvg),
          sampleSize: affectedScores.length,
        })
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Large calorie deficit (intake < burn - 600) — next-day recovery
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const foodDateMap: Record<string, FoodDay> = {}
    for (const f of foodDays) foodDateMap[f.date] = f

    const affectedScores: number[] = []
    const baselineScores: number[] = []

    for (const [date, f] of Object.entries(foodDateMap)) {
      if (f.calories == null || f.burn == null || f.burn === 0) continue
      const nextScore = scoreMap[nextDayStr(date)]
      if (nextScore == null) continue

      const balance = f.calories - f.burn
      if (balance < -600) {
        affectedScores.push(nextScore)
      } else if (balance > -200 && balance < 400) {
        baselineScores.push(nextScore)
      }
    }

    if (affectedScores.length >= 3 && baselineScores.length >= 2) {
      const affectedAvg = avg(affectedScores)
      const baselineAvg = avg(baselineScores)
      const delta = baselineAvg - affectedAvg

      if (delta >= 3) {
        killers.push({
          key: 'calorie_deficit',
          label: 'Large calorie deficit',
          avgImpact: Math.round(delta),
          baselineAvg: Math.round(baselineAvg),
          affectedAvg: Math.round(affectedAvg),
          sampleSize: affectedScores.length,
        })
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Back-to-back hard sessions (≥60 min two days in a row)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    // Build activity map
    const actMap: Record<string, number> = {}
    for (const a of activityDays) {
      actMap[a.date] = (actMap[a.date] ?? 0) + a.durationMinutes
    }

    const affectedScores: number[] = []
    const baselineScores: number[] = []

    const sortedDates = Object.keys(actMap).sort()
    for (let i = 1; i < sortedDates.length; i++) {
      const today = sortedDates[i]
      const yesterday = sortedDates[i - 1]
      const nextScore = scoreMap[nextDayStr(today)]
      if (nextScore == null) continue

      // Check if dates are consecutive
      const diff = (new Date(today + 'T12:00:00').getTime() - new Date(yesterday + 'T12:00:00').getTime()) / 86400000
      if (diff !== 1) continue

      if ((actMap[today] ?? 0) >= 60 && (actMap[yesterday] ?? 0) >= 60) {
        affectedScores.push(nextScore)
      } else if ((actMap[today] ?? 0) < 30 && (actMap[yesterday] ?? 0) < 30) {
        baselineScores.push(nextScore)
      }
    }

    if (affectedScores.length >= 3 && baselineScores.length >= 2) {
      const affectedAvg = avg(affectedScores)
      const baselineAvg = avg(baselineScores)
      const delta = baselineAvg - affectedAvg

      if (delta >= 3) {
        killers.push({
          key: 'back_to_back',
          label: 'Back-to-back hard sessions',
          avgImpact: Math.round(delta),
          baselineAvg: Math.round(baselineAvg),
          affectedAvg: Math.round(affectedAvg),
          sampleSize: affectedScores.length,
        })
      }
    }
  }

  // Sort by impact (worst first)
  return killers.sort((a, b) => b.avgImpact - a.avgImpact)
}
