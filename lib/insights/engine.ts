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

// ── Today status generation ────────────────────────────────────────────────────

/**
 * Produces a split interpretation + recommendation for the TODAY widget.
 *
 * Fallback behaviour: when today has no recovery data, uses the most recent
 * historical day instead. This allows the app to always give useful guidance
 * rather than showing a "no data" message.
 */
function generateTodayStatus(
  today: DaySummary | null,
  historical: DaySummary[],
  baselines: ReturnType<typeof computeBaselines>,
): {
  readiness: TodayReadiness
  interpretation: string
  recommendation: string
  supporting: string[]
  usingFallback: boolean
} {
  // Does today have any recovery signals?
  const todayHasData =
    today != null &&
    (today.hrv != null || today.sleepMinutes != null || today.restingHr != null)

  // If not, try the most recent historical day with recovery data
  const refDay = todayHasData
    ? today
    : [...historical].reverse().find(
        d => d.hrv != null || d.sleepMinutes != null || d.restingHr != null,
      ) ?? null

  const usingFallback = !todayHasData && refDay != null

  // No data at all — give neutral guidance without a sync message
  if (!refDay) {
    return {
      readiness: 'moderate',
      interpretation: 'Recovery picture is still building.',
      recommendation: 'Moderate intensity is a safe default until more data arrives.',
      supporting: [],
      usingFallback: false,
    }
  }

  const supporting: string[] = []
  let readiness: TodayReadiness = 'moderate'

  // ── HRV vs 14-day baseline ──────────────────────────────────────────────
  const hrvRatio =
    refDay.hrv != null && baselines.hrv14d != null
      ? refDay.hrv / baselines.hrv14d
      : null

  if (hrvRatio != null) {
    if (hrvRatio >= 1.08) {
      readiness = 'go'
      supporting.push(`HRV ${Math.round((hrvRatio - 1) * 100)}% above 14-day baseline`)
    } else if (hrvRatio < 0.82) {
      readiness = 'rest'
      supporting.push(`HRV ${Math.round((1 - hrvRatio) * 100)}% below 14-day baseline`)
    } else {
      supporting.push(`HRV near baseline (${Math.round(refDay.hrv!)} ms)`)
    }
  }

  // ── Sleep ──────────────────────────────────────────────────────────────
  const sleepH = refDay.sleepMinutes != null ? refDay.sleepMinutes / 60 : null
  if (sleepH != null) {
    if (sleepH >= 7.5) {
      if (readiness === 'moderate') readiness = 'go'
      supporting.push(`Slept ${sleepH.toFixed(1)}h — well rested`)
    } else if (sleepH >= 6.5) {
      supporting.push(`Sleep ${sleepH.toFixed(1)}h — adequate`)
    } else if (sleepH >= 5.5) {
      if (readiness === 'go') readiness = 'moderate'
      supporting.push(`Sleep ${sleepH.toFixed(1)}h — below target`)
    } else {
      readiness = readiness === 'go' ? 'moderate' : 'rest'
      supporting.push(`Short sleep — ${sleepH.toFixed(1)}h`)
    }
  }

  // ── Resting HR vs baseline ──────────────────────────────────────────────
  if (
    refDay.restingHr != null &&
    baselines.restingHr14d != null &&
    refDay.restingHr > baselines.restingHr14d + 6
  ) {
    if (readiness === 'go') readiness = 'moderate'
    supporting.push(
      `RHR elevated — ${refDay.restingHr} vs ${Math.round(baselines.restingHr14d)} baseline`,
    )
  }

  // ── Training load ───────────────────────────────────────────────────────
  const load7d = historical.slice(-7).reduce((s, d) => s + d.activityMinutes, 0)
  if (load7d > 420) {
    if (readiness === 'go') readiness = 'moderate'
    supporting.push(`High training load this week — ${Math.round(load7d)} min`)
  } else if (load7d > 60) {
    supporting.push(`${Math.round(load7d)} min training this week`)
  }

  // ── Multi-day HRV decline damps 'go' to 'moderate' ─────────────────────
  const hrvSlope = linearSlope(historical.slice(-5).map(d => d.hrv), 3)
  if (
    hrvSlope != null &&
    baselines.hrv14d != null &&
    hrvSlope < -0.5 &&
    readiness === 'go'
  ) {
    readiness = 'moderate'
  }

  // ── Split interpretation + recommendation ─────────────────────────────
  const prefix = usingFallback ? "Yesterday's data: " : ''

  const interpretations: Record<TodayReadiness, string> = {
    go:
      hrvRatio != null && hrvRatio >= 1.08
        ? `${prefix}HRV is ${Math.round((hrvRatio - 1) * 100)}% above your 14-day baseline.`
        : sleepH != null && sleepH >= 7.5
          ? `${prefix}You slept ${sleepH.toFixed(1)}h and recovery looks strong.`
          : `${prefix}Recovery looks good.`,

    moderate:
      load7d > 350
        ? `${prefix}Training load has been high this week (${Math.round(load7d)} min).`
        : sleepH != null && sleepH < 6.5
          ? `${prefix}Sleep was short at ${sleepH.toFixed(1)}h.`
          : `${prefix}Recovery is at a moderate level.`,

    rest:
      refDay.restingHr != null &&
      baselines.restingHr14d != null &&
      refDay.restingHr > baselines.restingHr14d + 6
        ? `${prefix}Resting HR is ${Math.round(refDay.restingHr - baselines.restingHr14d)}bpm above baseline.`
        : hrvRatio != null && hrvRatio < 0.82
          ? `${prefix}HRV is ${Math.round((1 - hrvRatio) * 100)}% below your baseline.`
          : `${prefix}Multiple recovery markers are suppressed.`,
  }

  const recommendations: Record<TodayReadiness, string> = {
    go:
      load7d > 350
        ? 'A moderate to hard session is reasonable — watch cumulative load.'
        : 'A hard session is on the table today.',

    moderate:
      sleepH != null && sleepH < 6.5
        ? 'Zone 2 or technique work — short sleep limits adaptation.'
        : load7d > 350
          ? 'Keep intensity controlled after a heavy week.'
          : 'Moderate effort is appropriate today.',

    rest: 'Prioritise rest, good nutrition, and an early bedtime tonight.',
  }

  return {
    readiness,
    interpretation: interpretations[readiness],
    recommendation: recommendations[readiness],
    supporting: supporting.slice(0, 3),
    usingFallback,
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function runInsightEngine(
  /** Full timeline including today, oldest-first */
  allDays: DaySummary[],
  today: string, // YYYY-MM-DD
): InsightEngineOutput {
  const historical = allDays.filter(d => d.date < today)
  const todayData  = allDays.find(d => d.date === today) ?? null

  const baselines = computeBaselines(historical)
  const insights  = generateInsights(historical, todayData, baselines)
  const status    = generateTodayStatus(todayData, historical, baselines)

  return {
    insights,
    todayReadiness:      status.readiness,
    todayInterpretation: status.interpretation,
    todayRecommendation: status.recommendation,
    todaySupporting:     status.supporting,
    usingFallback:       status.usingFallback,
  }
}
