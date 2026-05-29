/**
 * Main insight engine entry point.
 *
 * Takes a 30-day timeline (oldest-first) and today's snapshot.
 * Returns structured output consumed by the Today page UI.
 *
 * Designed for easy AI augmentation: pass `InsightEngineOutput` to an LLM
 * to generate richer explanations without changing the rule layer.
 */

import { computeBaselines, linearSlope } from './baselines'
import { generateInsights } from './rules'
import type { DaySummary, InsightEngineOutput, TodayReadiness } from './types'

// ── Today status text generation ─────────────────────────────────────────────

function generateTodayStatus(
  today: DaySummary | null,
  historical: DaySummary[],
  baselines: ReturnType<typeof computeBaselines>,
): { readiness: TodayReadiness; headline: string; supporting: string[] } {
  if (
    !today ||
    (today.hrv == null && today.sleepMinutes == null && today.restingHr == null)
  ) {
    return {
      readiness: 'moderate',
      headline: 'No health data yet today — check back after Apple Health syncs.',
      supporting: [],
    }
  }

  const supporting: string[] = []
  let readiness: TodayReadiness = 'moderate'

  // ── HRV vs 14-day baseline ──────────────────────────────────────────────
  const hrvRatio =
    today.hrv != null && baselines.hrv14d != null
      ? today.hrv / baselines.hrv14d
      : null

  if (hrvRatio != null) {
    if (hrvRatio >= 1.08) {
      readiness = 'go'
      supporting.push(`HRV ${Math.round((hrvRatio - 1) * 100)}% above your 14-day baseline`)
    } else if (hrvRatio < 0.82) {
      readiness = 'rest'
      supporting.push(`HRV ${Math.round((1 - hrvRatio) * 100)}% below your 14-day baseline`)
    } else {
      supporting.push(`HRV near your baseline (${Math.round(today.hrv!)} ms)`)
    }
  }

  // ── Sleep ──────────────────────────────────────────────────────────────
  const sleepH = today.sleepMinutes != null ? today.sleepMinutes / 60 : null
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
      supporting.push(`Short sleep — only ${sleepH.toFixed(1)}h`)
    }
  }

  // ── Resting HR vs baseline ──────────────────────────────────────────────
  if (
    today.restingHr != null &&
    baselines.restingHr14d != null &&
    today.restingHr > baselines.restingHr14d + 6
  ) {
    if (readiness === 'go') readiness = 'moderate'
    supporting.push(`Resting HR elevated (${today.restingHr} vs ${Math.round(baselines.restingHr14d)} baseline)`)
  }

  // ── Recent training load ─────────────────────────────────────────────────
  const load7d = historical.slice(-7).reduce((s, d) => s + d.activityMinutes, 0)
  if (load7d > 420) {
    if (readiness === 'go') readiness = 'moderate'
    supporting.push(`High training load this week (${Math.round(load7d)} min)`)
  } else if (load7d > 0) {
    supporting.push(`Training load this week: ${Math.round(load7d)} min`)
  }

  // ── Multi-day HRV decline (extra weight) ─────────────────────────────────
  const hrvSlope = linearSlope(historical.slice(-5).map(d => d.hrv), 3)
  if (
    hrvSlope != null &&
    baselines.hrv14d != null &&
    hrvSlope < -0.5 &&
    readiness === 'go'
  ) {
    readiness = 'moderate'
  }

  // ── Specific, data-driven headlines ──────────────────────────────────────
  const headlines: Record<TodayReadiness, string> = {
    go: hrvRatio != null && hrvRatio >= 1.08
      ? `HRV is ${Math.round((hrvRatio - 1) * 100)}% above baseline — a hard session is well justified.`
      : sleepH != null && sleepH >= 7.5
        ? `You slept ${sleepH.toFixed(1)}h and recovery looks strong. Good day to push.`
        : 'Recovery looks good. A hard session is on the table today.',

    moderate: load7d > 350
      ? `You've trained hard this week (${Math.round(load7d)} min). Keep today controlled.`
      : sleepH != null && sleepH < 6.5
        ? `Sleep was short (${sleepH?.toFixed(1)}h). Zone 2 or technique work is the right call.`
        : 'Readiness is moderate. Keep intensity controlled today.',

    rest: today.restingHr != null && baselines.restingHr14d != null && today.restingHr > baselines.restingHr14d + 6
      ? `Resting HR is ${Math.round(today.restingHr - baselines.restingHr14d)}bpm above baseline — your body needs recovery.`
      : hrvRatio != null && hrvRatio < 0.82
        ? `HRV is well below your baseline — prioritise rest and nutrition today.`
        : 'Recovery markers are down. Prioritise rest or easy movement.',
  }

  return {
    readiness,
    headline: headlines[readiness],
    supporting: supporting.slice(0, 3),
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
    todayReadiness:  status.readiness,
    todayHeadline:   status.headline,
    todaySupporting: status.supporting,
  }
}
