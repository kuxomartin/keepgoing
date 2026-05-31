/**
 * Rule-based "Today readiness" status.
 * Deterministic — no AI, no randomness.
 * Input data must come from today only (no cross-date fallbacks).
 */

import type { RecoveryResult } from '@/types/database'

/** @deprecated Use TodayReadiness from lib/insights/types instead */
export type TodayReadiness = 'push' | 'train' | 'easy' | 'recover'

export interface TodayStatusResult {
  readiness: TodayReadiness
  headline: string
  /** Up to 4 short supporting evidence bullets */
  supporting: string[]
}

export function computeTodayStatus({
  recovery,
  sleepHours,
  consumed,
  burned,
  checkin,
}: {
  recovery: RecoveryResult | null
  sleepHours: number | null
  /** kcal consumed today */
  consumed: number | null
  /** kcal burned today — MUST be same-date data, null otherwise */
  burned: number | null
  checkin: { energy: number | null; stress: number | null } | null
}): TodayStatusResult {
  // No real health data yet
  if (recovery == null) {
    return {
      readiness: 'easy',
      headline: 'No health data yet today — check back after Apple Health syncs.',
      supporting: [],
    }
  }

  const supporting: string[] = []

  // Base readiness from recovery score — deprecated, use runInsightEngine() instead
  let readiness: TodayReadiness =
    recovery.score >= 70 ? 'train' :
    recovery.score >= 45 ? 'easy' : 'recover'

  // Sleep signal
  if (sleepHours != null) {
    if (sleepHours >= 7) {
      supporting.push(`Sleep ${sleepHours.toFixed(1)}h — good rest`)
    } else if (sleepHours >= 6) {
      supporting.push(`Sleep ${sleepHours.toFixed(1)}h — slightly below target`)
    } else {
      supporting.push(`Sleep ${sleepHours.toFixed(1)}h — short night, take it easy`)
      readiness = 'recover'
    }
  }

  // Recovery issues (HRV, RHR warnings)
  for (const issue of recovery.issues.slice(0, 2)) {
    supporting.push(issue)
  }

  // Subjective check-in modifiers
  if (checkin?.energy != null && checkin.energy <= 3) {
    supporting.push(`Energy check-in: ${checkin.energy}/10 — feeling drained`)
  }
  if (checkin?.stress != null && checkin.stress >= 8) {
    supporting.push(`Stress: ${checkin.stress}/10 — high mental load`)
  }

  // Calorie note — only when burned comes from the same date
  if (burned != null && consumed != null) {
    const balance = consumed - burned
    if (balance < -800) {
      supporting.push('Large calorie deficit — consider eating more today')
    }
  }

  const HEADLINES: Record<TodayReadiness, string> = {
    push:    'Peak readiness. A quality session is on the table.',
    train:   'Recovery looks good. A training day.',
    easy:    'Readiness is moderate. Keep intensity controlled.',
    recover: 'Recovery is low. Prioritise rest or easy movement.',
  }

  return {
    readiness,
    headline: HEADLINES[readiness],
    supporting: supporting.slice(0, 4),
  }
}
