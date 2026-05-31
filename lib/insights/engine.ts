/**
 * Main insight engine entry point.
 *
 * Takes a 30-day timeline (oldest-first) and today's date string.
 * Returns structured output for the three Today page widgets.
 *
 * Designed for easy AI augmentation: pass InsightEngineOutput to an LLM
 * to generate richer explanations without changing the rule layer.
 */

import { computeBaselines, linearSlope } from './baselines'
import { generateInsights } from './rules'
import type { DaySummary, InsightEngineOutput, TodayReadiness } from './types'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Count consecutive "easy" days ending at yesterday (< 20 min activity). */
function countConsecutiveEasyDays(historical: DaySummary[]): number {
  let count = 0
  for (let i = historical.length - 1; i >= 0; i--) {
    if (historical[i].activityMinutes < 20) count++
    else break
  }
  return count
}

/**
 * Days since last session with ≥ 45 min activity.
 * 0 = yesterday, 1 = day before, null = none in window.
 */
function daysSinceHardSession(historical: DaySummary[]): number | null {
  for (let i = historical.length - 1; i >= 0; i--) {
    if (historical[i].activityMinutes >= 45) {
      return historical.length - 1 - i
    }
  }
  return null
}

function ordinalDay(n: number): string {
  const words = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh']
  return words[n] ?? `${n}th`
}

// ── 4-state readiness decision ─────────────────────────────────────────────────

interface ReadinessInputs {
  hrvRatio:             number | null  // HRV / 14d baseline
  sleepH:               number | null
  load7d:               number          // activity minutes last 7 days
  consecutiveEasyDays:  number
  daysSinceHard:        number | null   // null = no hard session in window
  checkinEnergy:        number | null   // 1-10
  checkinSoreness:      number | null   // 1-10 (higher = more sore)
}

function determineReadiness(i: ReadinessInputs): TodayReadiness {
  // ── RECOVER — hard gates (acute need) ──────────────────────────────────────
  if (i.sleepH != null && i.sleepH < 5.5) return 'recover'
  if (i.checkinEnergy != null && i.checkinEnergy <= 2) return 'recover'
  // HRV severely suppressed AND recently trained AND not already in rest pattern
  if (
    i.hrvRatio != null && i.hrvRatio < 0.82 &&
    i.daysSinceHard != null && i.daysSinceHard <= 1 &&
    i.consecutiveEasyDays < 2
  ) return 'recover'

  // ── PUSH — peak readiness ──────────────────────────────────────────────────
  if (
    i.hrvRatio != null && i.hrvRatio >= 1.10 &&
    (i.sleepH == null || i.sleepH >= 7) &&
    i.load7d < 350 &&
    (i.checkinEnergy == null || i.checkinEnergy >= 7)
  ) return 'push'

  // ── TRAIN — solid readiness ────────────────────────────────────────────────
  if (
    (i.hrvRatio == null || i.hrvRatio >= 0.95) &&
    (i.sleepH == null || i.sleepH >= 6.5) &&
    i.load7d < 500 &&
    (i.checkinEnergy == null || i.checkinEnergy >= 5)
  ) return 'train'

  // ── EASY — HRV suppressed but already resting ──────────────────────────────
  // If the body has been in low-activity mode for 2+ days, more passive rest
  // is not the answer. Gentle movement is appropriate.
  if (i.hrvRatio != null && i.hrvRatio < 0.82 && i.consecutiveEasyDays >= 2) return 'easy'

  // ── EASY — everything else (moderate suppression, high load, soreness) ─────
  return 'easy'
}

// ── Contextual copy generation ─────────────────────────────────────────────────

interface CopyInputs {
  readiness:           TodayReadiness
  hrvRatio:            number | null
  sleepH:              number | null
  load7d:              number
  consecutiveEasyDays: number
  daysSinceHard:       number | null
  checkinEnergy:       number | null
  checkinSoreness:     number | null
  hrvMs:               number | null
}

function generateCopy(i: CopyInputs): {
  headline: string
  interpretation: string
  recommendation: string
} {
  const hrvPctBelow = i.hrvRatio != null ? Math.round((1 - i.hrvRatio) * 100) : null
  const hrvPctAbove = i.hrvRatio != null ? Math.round((i.hrvRatio - 1) * 100) : null

  if (i.readiness === 'recover') {
    if (i.sleepH != null && i.sleepH < 5.5) {
      return {
        headline:       'Short sleep — a full recovery day.',
        interpretation: `Sleep was short at ${i.sleepH.toFixed(1)}h — recovery takes priority.`,
        recommendation: 'Rest, hydration, and an early bedtime tonight. Skip training today.',
      }
    }
    if (i.checkinEnergy != null && i.checkinEnergy <= 2) {
      return {
        headline:       'Energy is very low — the body needs rest today.',
        interpretation: 'Subjective energy is critically low. Recovery markers confirm this.',
        recommendation: 'No training. Prioritise sleep, nutrition, and stress reduction.',
      }
    }
    // HRV low + recently trained
    return {
      headline:       'Focus on recovery today.',
      interpretation: hrvPctBelow != null
        ? `HRV is ${hrvPctBelow}% below baseline after recent training.`
        : 'Multiple recovery markers are suppressed.',
      recommendation: 'Prioritise rest, good nutrition, and an early bedtime tonight.',
    }
  }

  if (i.readiness === 'push') {
    return {
      headline:       hrvPctAbove != null
        ? `HRV is ${hrvPctAbove}% above baseline — this is a quality day.`
        : 'Peak readiness today.',
      interpretation: i.sleepH != null && i.sleepH >= 7.5
        ? `You slept ${i.sleepH.toFixed(1)}h and recovery looks strong.`
        : `Recovery is elevated${i.hrvMs != null ? ` (HRV ${Math.round(i.hrvMs)} ms)` : ''}.`,
      recommendation: i.load7d < 200
        ? 'Minimal cumulative fatigue and strong recovery — push the intensity.'
        : 'Today is your day for a quality session.',
    }
  }

  if (i.readiness === 'train') {
    const headline = i.hrvRatio != null && i.hrvRatio >= 1.05
      ? 'Good recovery today.'
      : i.sleepH != null && i.sleepH >= 7.5
        ? 'Good recovery today.'
        : 'Recovery looks solid for training.'

    const interpretation = i.hrvRatio != null && i.hrvRatio >= 0.98
      ? `HRV is near baseline${i.hrvMs != null ? ` (${Math.round(i.hrvMs)} ms)` : ''} and sleep was adequate.`
      : i.sleepH != null && i.sleepH >= 7
        ? `You slept ${i.sleepH.toFixed(1)}h and recovery looks solid.`
        : 'Recovery is at a reasonable level.'

    const recommendation = i.load7d > 350
      ? 'A moderate to hard session is reasonable — watch cumulative load.'
      : 'A moderate to hard session is appropriate today.'

    return { headline, interpretation, recommendation }
  }

  // ── EASY ────────────────────────────────────────────────────────────────────
  // Key case: HRV suppressed but already in rest pattern
  if (
    i.hrvRatio != null && i.hrvRatio < 0.82 &&
    i.consecutiveEasyDays >= 2
  ) {
    const n = i.consecutiveEasyDays
    return {
      headline:       `Recovery is suppressed, but this is already your ${ordinalDay(n)} consecutive easy day.`,
      interpretation: hrvPctBelow != null
        ? `HRV remains ${hrvPctBelow}% below baseline despite ${n} days of lighter activity.`
        : `Recovery markers remain low after ${n} easy days.`,
      recommendation: 'Consider a walk, gym session, or easy Zone 2 ride.',
    }
  }

  // High weekly load
  if (i.load7d > 350) {
    return {
      headline:       'Take it easy today.',
      interpretation: `Training load has been high this week (${Math.round(i.load7d)} min).`,
      recommendation: 'Zone 2 or mobility work — keep intensity low and let the body adapt.',
    }
  }

  // Moderate HRV dip
  if (i.hrvRatio != null && i.hrvRatio < 0.95) {
    return {
      headline:       'Take it easy today.',
      interpretation: hrvPctBelow != null
        ? `HRV is ${hrvPctBelow}% below baseline — lighter effort is the right call.`
        : 'Recovery is at a moderate level.',
      recommendation: i.sleepH != null && i.sleepH < 6.5
        ? 'Zone 2 or technique work — short sleep limits adaptation.'
        : 'Zone 2 or easy effort today.',
    }
  }

  // Soreness or low energy
  if (i.checkinSoreness != null && i.checkinSoreness >= 7) {
    return {
      headline:       'Body is sore — movement is fine, intensity is not.',
      interpretation: 'Soreness is elevated from recent training load.',
      recommendation: 'Light movement, mobility, or an easy walk.',
    }
  }

  // Generic easy
  return {
    headline:       'Take it easy today.',
    interpretation: 'Recovery is at a moderate level.',
    recommendation: 'Moderate effort or a lighter session.',
  }
}

// ── Today status generation ────────────────────────────────────────────────────

interface Checkin {
  energy:   number | null
  soreness: number | null
}

function generateTodayStatus(
  today: DaySummary | null,
  historical: DaySummary[],
  baselines: ReturnType<typeof computeBaselines>,
  checkin: Checkin | null,
): {
  readiness: TodayReadiness
  headline: string
  interpretation: string
  recommendation: string
  supporting: string[]
  usingFallback: boolean
} {
  // Does today have any recovery signals?
  const todayHasData =
    today != null &&
    (today.hrv != null || today.sleepMinutes != null || today.restingHr != null)

  const refDay = todayHasData
    ? today
    : [...historical].reverse().find(
        d => d.hrv != null || d.sleepMinutes != null || d.restingHr != null,
      ) ?? null

  const usingFallback = !todayHasData && refDay != null

  // No data at all — neutral guidance
  if (!refDay) {
    return {
      readiness: 'easy',
      headline:       'Recovery picture is still building.',
      interpretation: 'Not enough data yet for a reliable readiness score.',
      recommendation: 'Moderate intensity is a safe default until more data arrives.',
      supporting: [],
      usingFallback: false,
    }
  }

  // ── Derived inputs ──────────────────────────────────────────────────────────
  const hrvRatio = refDay.hrv != null && baselines.hrv14d != null
    ? refDay.hrv / baselines.hrv14d
    : null

  const sleepH = refDay.sleepMinutes != null ? refDay.sleepMinutes / 60 : null

  const load7d = historical.slice(-7).reduce((s, d) => s + d.activityMinutes, 0)

  const consecutiveEasyDays = countConsecutiveEasyDays(historical)
  const daysSinceHard        = daysSinceHardSession(historical)

  // ── Determine state ─────────────────────────────────────────────────────────
  const readiness = determineReadiness({
    hrvRatio,
    sleepH,
    load7d,
    consecutiveEasyDays,
    daysSinceHard,
    checkinEnergy:   checkin?.energy   ?? null,
    checkinSoreness: checkin?.soreness ?? null,
  })

  // ── Multi-day HRV decline damps 'push' → 'train' ──────────────────────────
  // Even if today's snapshot is high, a declining trend caps the upside.
  const actualReadiness: TodayReadiness = (() => {
    if (readiness === 'push') {
      const hrvSlope = linearSlope(historical.slice(-5).map(d => d.hrv), 3)
      if (hrvSlope != null && baselines.hrv14d != null && hrvSlope < -0.5) {
        return 'train'
      }
    }
    return readiness
  })()

  // ── Generate copy ───────────────────────────────────────────────────────────
  const { headline, interpretation, recommendation } = generateCopy({
    readiness:           actualReadiness,
    hrvRatio,
    sleepH,
    load7d,
    consecutiveEasyDays,
    daysSinceHard,
    checkinEnergy:   checkin?.energy   ?? null,
    checkinSoreness: checkin?.soreness ?? null,
    hrvMs:           refDay.hrv,
  })

  // ── Supporting bullets ──────────────────────────────────────────────────────
  const supporting: string[] = []

  if (hrvRatio != null) {
    const pct = Math.round(Math.abs(1 - hrvRatio) * 100)
    supporting.push(
      hrvRatio >= 1.05 ? `HRV ${pct}% above 14-day baseline`
      : hrvRatio < 0.95 ? `HRV ${pct}% below 14-day baseline`
      : `HRV near baseline (${Math.round(refDay.hrv!)} ms)`,
    )
  }

  if (sleepH != null) {
    supporting.push(
      sleepH >= 7.5 ? `Slept ${sleepH.toFixed(1)}h — well rested`
      : sleepH >= 6.5 ? `Sleep ${sleepH.toFixed(1)}h — adequate`
      : `Sleep ${sleepH.toFixed(1)}h — below target`,
    )
  }

  if (load7d > 60) {
    supporting.push(`${Math.round(load7d)} min training this week`)
  }

  return {
    readiness:      actualReadiness,
    headline,
    interpretation,
    recommendation,
    supporting:     supporting.slice(0, 3),
    usingFallback,
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function runInsightEngine(
  /** Full timeline including today, oldest-first */
  allDays: DaySummary[],
  today: string, // YYYY-MM-DD
  checkin?: Checkin | null,
): InsightEngineOutput {
  const historical = allDays.filter(d => d.date < today)
  const todayData  = allDays.find(d => d.date === today) ?? null

  const baselines = computeBaselines(historical)
  const insights  = generateInsights(historical, todayData, baselines)
  const status    = generateTodayStatus(todayData, historical, baselines, checkin ?? null)

  return {
    insights,
    todayReadiness:      status.readiness,
    todayHeadline:       status.headline,
    todayInterpretation: status.interpretation,
    todayRecommendation: status.recommendation,
    todaySupporting:     status.supporting,
    usingFallback:       status.usingFallback,
  }
}
