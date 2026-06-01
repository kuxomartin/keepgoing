// SERVER-ONLY — Sleep verdict, architecture, and cause explorer logic
import type { SleepRecord } from '@/types/database'

// ============================================================
// FORMAT HELPERS
// ============================================================

export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60)
  const min = Math.round(m % 60)
  if (h === 0) return `${min}m`
  if (min === 0) return `${h}h`
  return `${h}h ${min}m`
}

export function formatHours(m: number): string {
  return (m / 60).toFixed(1) + 'h'
}

// ============================================================
// SLEEP VERDICT
// ============================================================

export type SleepVerdictKey =
  | 'solid'
  | 'efficient'
  | 'long_fragmented'
  | 'short_efficient'
  | 'short'
  | 'disrupted'
  | 'ok'
  | 'no_data'

export interface SleepVerdict {
  key: SleepVerdictKey
  text: string
  facts: Array<{ label: string; value: string }>
}

export function getSleepVerdict(record: SleepRecord | null): SleepVerdict {
  if (!record || record.asleep_minutes == null) {
    return { key: 'no_data', text: 'No sleep data for this night.', facts: [] }
  }

  const h          = record.asleep_minutes / 60
  const eff        = record.efficiency_pct
  const wakes      = record.wake_count
  const awake      = record.awake_minutes
  const avgHrv     = record.avg_hrv

  // Determine verdict
  let key: SleepVerdictKey = 'ok'

  // Apple Watch wake_count counts micro-arousals; 7-12/night is normal.
  // Only mark disrupted on efficiency <75% OR awake time >60 min.
  if ((eff != null && eff < 75) || (awake != null && awake > 60)) {
    key = 'disrupted'
  } else if (h < 6 && eff != null && eff >= 85) {
    key = 'short_efficient'
  } else if (h < 6) {
    key = 'short'
  } else if (eff != null && eff >= 90) {
    // High efficiency — ignore wake_count (Apple Watch micro-arousals are noisy)
    if (h >= 7) key = 'solid'
    else key = 'efficient'
  } else if (h >= 7 && (eff == null || eff >= 80)) {
    key = 'solid'
  } else if (h >= 7.5 && eff != null && eff < 80) {
    key = 'long_fragmented'
  }

  const VERDICT_TEXT: Record<SleepVerdictKey, string> = {
    solid:          'Sleep was solid.',
    efficient:      'Sleep was efficient.',
    long_fragmented:'Sleep was long, but fragmented.',
    short_efficient:'Short sleep, but efficient.',
    short:          'Sleep was short.',
    disrupted:      'Sleep was disrupted.',
    ok:             'Sleep was recorded.',
    no_data:        'No sleep data for this night.',
  }

  // Build facts
  const facts: Array<{ label: string; value: string }> = []
  if (record.asleep_minutes != null)
    facts.push({ label: 'Asleep', value: formatMinutes(record.asleep_minutes) })
  if (eff != null)
    facts.push({ label: 'Efficiency', value: `${Math.round(eff)}%` })
  if (wakes != null)
    facts.push({ label: 'Wake count', value: String(wakes) })
  if (avgHrv != null)
    facts.push({ label: 'Avg sleep HRV', value: `${Math.round(avgHrv)} ms` })

  return { key, text: VERDICT_TEXT[key], facts }
}

// ============================================================
// SLEEP CAUSE EXPLORER
// ============================================================

export type ConfidenceLevel = 'low' | 'medium' | 'high'

export interface SleepContributor {
  factor: string
  evidence: string
  confidence: ConfidenceLevel
  explanation: string
  recommendation: string
}

export interface CauseExplorerContext {
  // Sleep itself
  record: SleepRecord
  // Previous day context
  lastCoffeeHour: number | null    // 0-23
  totalCaffeineMg: number | null
  totalCalories: number | null
  estimatedBurnKcal: number | null  // active + resting energy
  lateMealAfter20h: boolean
  lateMealCalories: number | null
  activityMinutes: number | null
  previousDayHrv: number | null
  baselineHrv: number | null       // 14d average
  checkinDigestion: number | null  // 1-10
  checkinEnergy: number | null     // 1-10
}

function isSleepPoor(record: SleepRecord): boolean {
  const h   = record.asleep_minutes != null ? record.asleep_minutes / 60 : null
  const eff = record.efficiency_pct
  const wakes = record.wake_count
  if (h != null && h < 6.5) return true
  if (eff != null && eff < 80) return true
  if (wakes != null && wakes > 5) return true
  return false
}

export function analyzeSleepCauses(ctx: CauseExplorerContext): {
  contributors: SleepContributor[]
  sleepWasPoor: boolean
  headline: string
} {
  const contributors: SleepContributor[] = []
  const poor = isSleepPoor(ctx.record)
  const headline = poor
    ? 'Possible contributors to last night\'s sleep:'
    : 'What may have helped last night:'

  const { record } = ctx

  // ── Illness / health signals ─────────────────────────────────────────────────
  const avgRespAbnormal = record.avg_respiration_rate != null && record.avg_respiration_rate > 19
  const spo2Low         = record.low_spo2 != null && record.low_spo2 < 90
  const tempHigh        = record.wrist_temperature != null && record.wrist_temperature > 0.8

  if (spo2Low || (avgRespAbnormal && tempHigh)) {
    contributors.push({
      factor: 'Possible health signal',
      evidence: [
        spo2Low         ? `SpO₂ dropped to ${record.low_spo2}%` : null,
        avgRespAbnormal ? `Avg respiration ${record.avg_respiration_rate} br/min` : null,
        tempHigh        ? `Wrist temp elevated +${record.wrist_temperature?.toFixed(1)}°` : null,
      ].filter(Boolean).join(', '),
      confidence: 'medium',
      explanation: 'Elevated respiration, low SpO₂, or wrist temperature can indicate illness, airway restriction, or poor sleep quality at a physiological level.',
      recommendation: 'Monitor over the next 2–3 nights. If it persists, consider a check-up.',
    })
  }

  // ── Late caffeine ────────────────────────────────────────────────────────────
  if (ctx.lastCoffeeHour != null && ctx.lastCoffeeHour >= 14) {
    contributors.push({
      factor: 'Late caffeine',
      evidence: `Last coffee at ${ctx.lastCoffeeHour}:00${ctx.totalCaffeineMg ? ` · ${ctx.totalCaffeineMg}mg total` : ''}`,
      confidence: ctx.lastCoffeeHour >= 16 ? 'high' : 'medium',
      explanation: 'Caffeine has a half-life of ~5–7 hours. Coffee at 14:00 or later can still be active at bedtime, reducing sleep pressure and delaying sleep onset.',
      recommendation: 'Try keeping caffeine before 13:00 for 7 days and compare sleep quality.',
    })
  }

  // ── High caffeine load ───────────────────────────────────────────────────────
  if (ctx.totalCaffeineMg != null && ctx.totalCaffeineMg > 350 && (ctx.lastCoffeeHour == null || ctx.lastCoffeeHour < 14)) {
    contributors.push({
      factor: 'High total caffeine',
      evidence: `${ctx.totalCaffeineMg}mg total caffeine`,
      confidence: 'low',
      explanation: 'High cumulative caffeine intake can reduce overall sleep pressure even if the last coffee was early.',
      recommendation: 'Try reducing to 1–2 coffees on days before important sleep.',
    })
  }

  // ── Calorie deficit ──────────────────────────────────────────────────────────
  if (ctx.totalCalories != null && ctx.estimatedBurnKcal != null) {
    const deficit = ctx.estimatedBurnKcal - ctx.totalCalories
    if (deficit > 600) {
      contributors.push({
        factor: 'Large calorie deficit',
        evidence: `Ate ${ctx.totalCalories} kcal · estimated burn ~${Math.round(ctx.estimatedBurnKcal)} kcal · deficit ~${Math.round(deficit)} kcal`,
        confidence: 'medium',
        explanation: 'A large calorie deficit can increase nighttime cortisol and reduce deep sleep duration. The body may also wake earlier due to low blood sugar.',
        recommendation: 'Avoid deficits larger than 400–500 kcal. Add a small evening meal if cutting calories.',
      })
    }
  }

  // ── Late or large meal ───────────────────────────────────────────────────────
  if (ctx.lateMealAfter20h && ctx.lateMealCalories != null && ctx.lateMealCalories > 500) {
    contributors.push({
      factor: 'Late heavy meal',
      evidence: `Meal after 20:00 · ~${ctx.lateMealCalories} kcal`,
      confidence: 'medium',
      explanation: 'Eating a large meal close to bedtime increases core body temperature and digestive activity, which can fragment sleep and reduce deep sleep.',
      recommendation: 'Try finishing dinner before 19:30 for a week and observe the effect.',
    })
  }

  // ── High training load ───────────────────────────────────────────────────────
  if (ctx.activityMinutes != null && ctx.activityMinutes > 90) {
    contributors.push({
      factor: 'High training load',
      evidence: `${ctx.activityMinutes} min of activity the previous day`,
      confidence: 'low',
      explanation: 'Very long training sessions can elevate cortisol into the evening, temporarily suppressing sleep quality. This often recovers within 1–2 days.',
      recommendation: 'Not enough data to say this is causal — monitor for a pattern over multiple nights.',
    })
  }

  // ── Poor digestion ───────────────────────────────────────────────────────────
  if (ctx.checkinDigestion != null && ctx.checkinDigestion <= 4) {
    contributors.push({
      factor: 'Digestive discomfort',
      evidence: `Digestion rating: ${ctx.checkinDigestion}/10`,
      confidence: 'medium',
      explanation: 'Poor digestion or gastrointestinal discomfort can increase nighttime arousal and fragment sleep.',
      recommendation: 'Note which foods preceded poor digestion and track if there\'s a pattern.',
    })
  }

  // ── Low previous-day HRV ─────────────────────────────────────────────────────
  if (ctx.previousDayHrv != null && ctx.baselineHrv != null) {
    const ratio = ctx.previousDayHrv / ctx.baselineHrv
    if (ratio < 0.85) {
      contributors.push({
        factor: 'Low recovery entering sleep',
        evidence: `Previous day HRV ${Math.round(ctx.previousDayHrv)} ms vs ${Math.round(ctx.baselineHrv)} ms avg`,
        confidence: 'low',
        explanation: 'Entering sleep with suppressed HRV suggests the body was already in a recovery deficit. Sleep may have been partially restorative but started from a lower baseline.',
        recommendation: 'Track whether sleep quality improves after days with near-baseline HRV.',
      })
    }
  }

  // ── Good sleep helpers (when sleep was not poor) ─────────────────────────────
  if (!poor) {
    if (ctx.lastCoffeeHour != null && ctx.lastCoffeeHour < 12) {
      contributors.push({
        factor: 'Early caffeine cutoff',
        evidence: `Last coffee at ${ctx.lastCoffeeHour}:00`,
        confidence: 'low',
        explanation: 'Caffeine fully cleared by bedtime may have reduced sleep pressure interference.',
        recommendation: 'Keep this habit when sleep quality matters.',
      })
    }
    if (record.efficiency_pct != null && record.efficiency_pct >= 90) {
      contributors.push({
        factor: 'High sleep efficiency',
        evidence: `${Math.round(record.efficiency_pct)}% efficiency`,
        confidence: 'high',
        explanation: 'Time in bed was used well. Little time was spent awake after sleep onset.',
        recommendation: 'Consistent sleep/wake times often correlate with high efficiency.',
      })
    }
  }

  // Cap at 4 contributors, sort by confidence
  const CONF_ORDER: Record<ConfidenceLevel, number> = { high: 0, medium: 1, low: 2 }
  const sorted = contributors.sort((a, b) => CONF_ORDER[a.confidence] - CONF_ORDER[b.confidence]).slice(0, 4)

  return { contributors: sorted, sleepWasPoor: poor, headline }
}

// ============================================================
// SLEEP CONTEXT SENTENCE (for Today page)
// ============================================================

export function getSleepContextSentence(record: SleepRecord | null): string | null {
  if (!record || record.asleep_minutes == null) return null

  const h    = record.asleep_minutes / 60
  const eff  = record.efficiency_pct
  const wakes = record.wake_count

  // Apple Watch wake_count = micro-arousals; use efficiency + awake time only
  const awake = record.awake_minutes
  if ((eff != null && eff < 75) || (awake != null && awake > 60)) {
    return 'Sleep was disrupted — treat recovery signal with some caution.'
  }
  if (h < 5.5) {
    return `Short sleep (${formatHours(record.asleep_minutes)}) — recovery signal may be less reliable today.`
  }
  if (h < 6.5) {
    return `Sleep was short at ${formatHours(record.asleep_minutes)} — keep intensity moderate.`
  }
  if (eff != null && eff >= 90 && h >= 7) {
    return 'Sleep was efficient — recovery signal is reliable.'
  }
  if (h >= 7.5) {
    return `Well rested (${formatHours(record.asleep_minutes)}) — recovery is on solid ground.`
  }
  return null
}
