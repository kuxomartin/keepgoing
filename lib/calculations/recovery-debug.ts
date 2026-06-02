/**
 * Recovery Score Debug Breakdown
 * Traces every scoring step so developers can verify what drove the score.
 * Used only in process.env.NODE_ENV === 'development'.
 */

import type { HealthMetrics } from '@/types/database'

export interface ScoringStep {
  label:       string
  rawValue:    string
  target:      string
  rule:        string
  deduction:   number    // 0 = no deduction applied
  scoreAfter:  number    // running score after this step
}

export interface RecoveryDebugBreakdown {
  // Per-signal steps (ordered: sleep → HRV → RHR)
  steps: ScoringStep[]

  // Derived totals
  baseScore:       number   // always 100
  totalDeductions: number
  finalScore:      number

  // Status determination
  status:          'green' | 'yellow' | 'orange' | 'red'
  statusRule:      string
  heroLabel:       string
  isCurrentDay:    boolean

  // Training load (not part of score — shown as context only)
  weeklyLoadMins:  number
  daysSinceHard:   number | null
  loadContext:     string

  // HRV ratio vs baseline (used by engine for readiness, not for score)
  hrvBaseline14d:  number | null
  hrvRatio:        number | null
  hrvRatioDisplay: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDeduction(d: number): string {
  if (d === 0) return 'no deduction'
  return `−${d} pts`
}

function loadContextStr(mins: number, daysSince: number | null): string {
  if (mins === 0) return 'No activity this week'
  if (mins < 120) return `${mins} min this week — light load`
  if (mins < 300) return `${mins} min this week — moderate load`
  const since = daysSince != null ? `, last hard session ${daysSince}d ago` : ''
  return `${mins} min this week — high load${since}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function computeRecoveryDebug(
  metrics:          HealthMetrics | null,
  hrvBaseline14d:   number | null,
  weeklyLoadMins:   number,
  daysSinceHard:    number | null,
  isCurrentDay:     boolean,
): RecoveryDebugBreakdown {
  const steps: ScoringStep[] = []
  let running = 100

  if (!metrics) {
    return {
      steps: [{
        label: 'Data', rawValue: 'none', target: '—', rule: 'no metrics → default 50',
        deduction: 50, scoreAfter: 50,
      }],
      baseScore: 100, totalDeductions: 50, finalScore: 50,
      status: 'yellow', statusRule: 'score >= 45 → yellow', heroLabel: 'Moderate recovery.',
      isCurrentDay, weeklyLoadMins, daysSinceHard,
      loadContext: loadContextStr(weeklyLoadMins, daysSinceHard),
      hrvBaseline14d: null, hrvRatio: null, hrvRatioDisplay: '—',
    }
  }

  // ── Sleep ─────────────────────────────────────────────────────────────────
  const sleepH = metrics.sleep_minutes && metrics.sleep_minutes > 0
    ? metrics.sleep_minutes / 60
    : null

  let sleepDeduction = 0
  let sleepRule = 'sleep >= 7h → no deduction'

  if (sleepH === null) {
    sleepRule = 'no sleep data → not scored'
  } else if (sleepH < 6) {
    sleepDeduction = 30
    sleepRule = 'sleep < 6h → −30'
  } else if (sleepH < 7) {
    sleepDeduction = 15
    sleepRule = 'sleep < 7h → −15'
  }

  running -= sleepDeduction
  steps.push({
    label:     'Sleep',
    rawValue:  sleepH != null ? `${sleepH.toFixed(2)}h` : 'no data',
    target:    '≥ 7h (−15 if < 7h, −30 if < 6h)',
    rule:      sleepRule,
    deduction: sleepDeduction,
    scoreAfter: running,
  })

  // ── HRV ───────────────────────────────────────────────────────────────────
  const hrv = metrics.hrv_ms != null ? Number(metrics.hrv_ms) : null
  let hrvDeduction = 0
  let hrvRule = 'no HRV data → not scored'

  if (hrv != null) {
    if (hrv < 40) {
      hrvDeduction = 25
      hrvRule = 'HRV < 40ms → −25'
    } else if (hrv < 55) {
      hrvDeduction = 10
      hrvRule = 'HRV < 55ms → −10'
    } else {
      hrvRule = 'HRV ≥ 55ms → no deduction'
    }
  }

  running -= hrvDeduction
  const hrvRatio = hrv != null && hrvBaseline14d != null ? hrv / hrvBaseline14d : null

  steps.push({
    label:     'HRV',
    rawValue:  hrv != null ? `${Math.round(hrv)} ms` : 'no data',
    target:    '≥ 55ms (−10 if < 55ms, −25 if < 40ms)',
    rule:      hrvRule,
    deduction: hrvDeduction,
    scoreAfter: running,
  })

  // ── Resting HR ────────────────────────────────────────────────────────────
  const rhr = metrics.resting_hr ?? null
  let rhrDeduction = 0
  let rhrRule = 'no RHR data → not scored'

  if (rhr != null) {
    if (rhr > 65) {
      rhrDeduction = 20
      rhrRule = 'RHR > 65bpm → −20'
    } else if (rhr > 60) {
      rhrDeduction = 10
      rhrRule = 'RHR > 60bpm → −10'
    } else {
      rhrRule = 'RHR ≤ 60bpm → no deduction'
    }
  }

  running -= rhrDeduction
  steps.push({
    label:     'Resting HR',
    rawValue:  rhr != null ? `${rhr} bpm` : 'no data',
    target:    '≤ 60bpm (−10 if > 60, −20 if > 65)',
    rule:      rhrRule,
    deduction: rhrDeduction,
    scoreAfter: running,
  })

  const finalScore = Math.max(0, Math.min(100, running))
  const status: 'green' | 'yellow' | 'orange' | 'red' =
    finalScore >= 85 ? 'green'
    : finalScore >= 70 ? 'yellow'
    : finalScore >= 55 ? 'orange'
    : 'red'

  const statusRule =
    finalScore >= 85 ? `score ${finalScore} ≥ 85 → green`
    : finalScore >= 70 ? `score ${finalScore} ≥ 70 → yellow`
    : finalScore >= 55 ? `score ${finalScore} ≥ 55 → orange`
    : `score ${finalScore} < 55 → red`

  const day = isCurrentDay ? ' today.' : '.'
  const heroLabel =
    status === 'green'  ? `Well recovered${day}`
    : status === 'yellow' ? `Moderately recovered${day}`
    : status === 'orange' ? `Recovery limited${day}`
    : `Low recovery${day}`

  const totalDeductions = sleepDeduction + hrvDeduction + rhrDeduction

  const hrvRatioDisplay = hrvRatio != null
    ? `${(hrvRatio * 100).toFixed(1)}% of 14d baseline (${Math.round(hrvBaseline14d!)} ms)`
    : hrvBaseline14d != null
      ? `baseline: ${Math.round(hrvBaseline14d)} ms, no current HRV`
      : 'no baseline available'

  return {
    steps,
    baseScore: 100,
    totalDeductions,
    finalScore,
    status,
    statusRule,
    heroLabel,
    isCurrentDay,
    weeklyLoadMins,
    daysSinceHard,
    loadContext: loadContextStr(weeklyLoadMins, daysSinceHard),
    hrvBaseline14d,
    hrvRatio,
    hrvRatioDisplay,
  }
}
