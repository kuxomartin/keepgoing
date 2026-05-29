/**
 * Rule-based insight generation.
 *
 * Core principle: reason like a coach.
 * Never judge a single metric in isolation — always evaluate context:
 *   food intake + burn + activity + recent trend + recovery state.
 *
 * Each rule is self-contained, returns Insight | null.
 * Max 5 insights returned, sorted: warnings > recommendations > trends > positives.
 */

import type { Insight, DaySummary, Baselines } from './types'
import { linearSlope } from './baselines'

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Compute same-date calorie balance (consumed - burned).
 * Returns null when either side is missing — never mixes dates.
 */
function dayBalance(d: DaySummary): number | null {
  if (d.calories == null || d.calories < 200) return null
  if (d.activeEnergy == null && d.restingEnergy == null) return null
  const burned = (d.activeEnergy ?? 0) + (d.restingEnergy ?? 0)
  if (burned === 0) return null // both components absent, not genuinely zero
  return d.calories - burned
}

/**
 * Filter to days that have a valid same-date balance.
 */
function validBalanceDays(
  days: DaySummary[],
): { day: DaySummary; balance: number }[] {
  return days
    .map(d => ({ day: d, balance: dayBalance(d) }))
    .filter((x): x is { day: DaySummary; balance: number } => x.balance != null)
}

/** Days with meaningful food logging (not a partial/skipped day). */
function foodLoggedDays(days: DaySummary[]): DaySummary[] {
  return days.filter(d => d.calories != null && d.calories >= 400)
}

function pct(ratio: number): string {
  return `${Math.round(Math.abs(ratio - 1) * 100)}%`
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString()
}

// ── Sleep rules ───────────────────────────────────────────────────────────────

function ruleSleepDeclining(historical: DaySummary[]): Insight | null {
  const last5 = historical.slice(-5)
  const slope  = linearSlope(last5.map(d => d.sleepMinutes), 3)
  if (slope == null || slope >= -12) return null
  const count = last5.filter(d => d.sleepMinutes != null).length
  if (count < 3) return null
  return {
    id: 'sleep-declining',
    type: 'warning',
    category: 'sleep',
    headline: 'Sleep has been getting shorter',
    explanation: `Your sleep duration has declined over the past ${count} nights. Try going to bed 30–45 minutes earlier — even a small shift compounds over days.`,
    confidence: 'high',
    severity: 'medium',
  }
}

function ruleSleepLowAverage(baselines: Baselines, historical: DaySummary[]): Insight | null {
  const avg   = baselines.sleepMinutes7d
  const count = historical.slice(-7).filter(d => d.sleepMinutes != null).length
  if (avg == null || count < 4 || avg >= 6.5 * 60) return null
  const h = (avg / 60).toFixed(1)
  return {
    id: 'sleep-low-avg',
    type: 'warning',
    category: 'sleep',
    headline: `Averaging only ${h}h of sleep this week`,
    explanation: 'Consistent under-sleep suppresses HRV and slows recovery. A 7-hour target meaningfully improves adaptation.',
    confidence: 'high',
    severity: avg < 6 * 60 ? 'high' : 'medium',
  }
}

function ruleSleepGood(baselines: Baselines, historical: DaySummary[]): Insight | null {
  const avg   = baselines.sleepMinutes7d
  const count = historical.slice(-7).filter(d => d.sleepMinutes != null).length
  if (avg == null || count < 4 || avg < 7.5 * 60) return null
  const h = (avg / 60).toFixed(1)
  return {
    id: 'sleep-good',
    type: 'positive',
    category: 'sleep',
    headline: `Solid sleep this week — averaging ${h}h`,
    explanation: 'Good sleep is your biggest recovery lever. Keep the same routine.',
    confidence: 'high',
    severity: 'low',
  }
}

// ── Recovery rules (HRV + RHR) ────────────────────────────────────────────────

function ruleHrvLow(today: DaySummary, baselines: Baselines): Insight | null {
  const b = baselines.hrv14d
  const v = today.hrv
  if (b == null || v == null || v / b >= 0.85) return null
  return {
    id: 'hrv-low',
    type: 'warning',
    category: 'recovery',
    headline: `HRV is ${pct(v / b)} below your baseline`,
    explanation: `Today's HRV (${Math.round(v)} ms) is suppressed vs your 14-day average (${Math.round(b)} ms). Favour easy or no training.`,
    confidence: 'high',
    severity: v / b < 0.75 ? 'high' : 'medium',
  }
}

function ruleHrvHigh(today: DaySummary, baselines: Baselines): Insight | null {
  const b = baselines.hrv14d
  const v = today.hrv
  if (b == null || v == null || v / b <= 1.10) return null
  return {
    id: 'hrv-high',
    type: 'positive',
    category: 'recovery',
    headline: `HRV is ${pct(v / b)} above your baseline`,
    explanation: `Today's HRV (${Math.round(v)} ms) vs 14-day average (${Math.round(b)} ms) — your nervous system is well recovered.`,
    confidence: 'high',
    severity: 'low',
  }
}

function ruleHrvDeclining(historical: DaySummary[], baselines: Baselines): Insight | null {
  const b = baselines.hrv14d
  if (b == null) return null
  const slope = linearSlope(historical.slice(-5).map(d => d.hrv), 3)
  if (slope == null || slope >= -0.5) return null
  if (Math.abs(slope) / b < 0.015) return null
  return {
    id: 'hrv-declining',
    type: 'warning',
    category: 'recovery',
    headline: 'HRV has been trending downward',
    explanation: 'A multi-day HRV decline often signals accumulated fatigue or illness onset. Watch training load and sleep.',
    confidence: 'medium',
    severity: 'medium',
  }
}

function ruleRhrElevated(today: DaySummary, baselines: Baselines): Insight | null {
  const b = baselines.restingHr14d
  const v = today.restingHr
  if (b == null || v == null) return null
  const diff = v - b
  if (diff < 5) return null
  return {
    id: 'rhr-elevated',
    type: 'warning',
    category: 'recovery',
    headline: `Resting HR is ${Math.round(diff)}bpm above your baseline`,
    explanation: `Your RHR today (${v}bpm) vs baseline (${Math.round(b)}bpm) suggests elevated physiological stress — could be fatigue, illness, or dehydration.`,
    confidence: 'high',
    severity: diff >= 8 ? 'high' : 'medium',
  }
}

// ── Weight rule ───────────────────────────────────────────────────────────────

function ruleWeightTrending(historical: DaySummary[]): Insight | null {
  const weightDays = historical.slice(-14).filter(d => d.weight != null)
  if (weightDays.length < 5) return null
  const slope = linearSlope(weightDays.map(d => d.weight), 5)
  if (slope == null) return null

  if (slope < -0.05) {
    return {
      id: 'weight-trending-down',
      type: 'trend',
      category: 'weight',
      headline: 'Weight is trending down steadily',
      explanation: 'A consistent decrease over the past two weeks. Your current approach appears to be working — keep calorie targets consistent.',
      confidence: 'high',
      severity: 'low',
    }
  }
  if (slope > 0.07) {
    return {
      id: 'weight-trending-up',
      type: 'warning',
      category: 'weight',
      headline: 'Weight has been rising this week',
      explanation: 'Your weight has increased over the past two weeks. If this is unintentional, review calorie intake.',
      confidence: 'high',
      severity: 'medium',
    }
  }
  return null
}

// ── Nutrition rules (context-aware) ──────────────────────────────────────────
//
// The engine never judges food intake alone.
// It always considers: intake + burn + activity + multi-day trend.
// Single-day spikes are not surfaced unless balance context confirms a problem.

/**
 * Was yesterday's higher-than-usual intake justified by activity load?
 * Shows a positive insight instead of a warning when the balance was maintained.
 */
function ruleIntakeJustifiedByActivity(
  historical: DaySummary[],
  baselines: Baselines,
): Insight | null {
  const calBase = baselines.calories7d
  const yday    = historical.slice(-1)[0]
  if (!yday || calBase == null || yday.calories == null) return null

  const intakeRatio = yday.calories / calBase
  if (intakeRatio < 1.20) return null // intake wasn't notably high — nothing to explain

  const ydayBal  = dayBalance(yday)
  const vbd7     = validBalanceDays(historical.slice(-7))
  const avgBal7  = vbd7.length >= 3
    ? vbd7.reduce((s, x) => s + x.balance, 0) / vbd7.length
    : null

  // Intake was high but balance stayed in line → justified
  if (ydayBal != null && avgBal7 != null && Math.abs(ydayBal - avgBal7) <= 300) {
    const actNote = yday.activityMinutes > 30
      ? ` With ${Math.round(yday.activityMinutes)} min of activity, the extra fuel was appropriate.`
      : ''
    return {
      id: 'intake-justified',
      type: 'positive',
      category: 'nutrition',
      headline: "Yesterday's higher intake matched your activity level",
      explanation: `You consumed ${fmt(yday.calories)} kcal — ${pct(intakeRatio)} above your recent average — but your calorie balance stayed in line with your usual pattern.${actNote}`,
      confidence: 'high',
      severity: 'low',
    }
  }

  // Intake was high without burn data to explain it — soft note, not a warning
  if (ydayBal == null && yday.activityMinutes > 60) {
    return {
      id: 'intake-high-activity',
      type: 'positive',
      category: 'nutrition',
      headline: "Higher intake on a day with significant activity",
      explanation: `You logged ${fmt(yday.calories)} kcal yesterday alongside ${Math.round(yday.activityMinutes)} min of activity. Energy demand was likely higher — no adjustment needed.`,
      confidence: 'medium',
      severity: 'low',
    }
  }

  return null
}

/**
 * Calorie surplus sustained over multiple days.
 * Only fires when there is enough valid balance data (≥4 days in last 7).
 */
function ruleCalorieSurplusStreak(historical: DaySummary[]): Insight | null {
  const vbd = validBalanceDays(historical.slice(-7))
  if (vbd.length < 4) return null

  const recent5   = vbd.slice(-5)
  const surplus   = recent5.filter(x => x.balance > 150)
  if (surplus.length < 3) return null

  const avgSurplus = Math.round(surplus.reduce((s, x) => s + x.balance, 0) / surplus.length)
  return {
    id: 'calorie-surplus-streak',
    type: 'warning',
    category: 'nutrition',
    headline: `Calorie surplus on ${surplus.length} of the last ${recent5.length} tracked days`,
    explanation: `Average surplus on those days: +${fmt(avgSurplus)} kcal. If fat loss is your goal, focus on nutrient-dense meals and avoid unnecessary snacking today.`,
    confidence: 'high',
    severity: surplus.length >= 4 ? 'medium' : 'low',
  }
}

/**
 * Sustained large calorie deficit — potentially harmful for recovery.
 */
function ruleCalorieDeficitLarge(historical: DaySummary[]): Insight | null {
  const vbd = validBalanceDays(historical.slice(-7))
  if (vbd.length < 3) return null

  const recent5   = vbd.slice(-5)
  const large     = recent5.filter(x => x.balance < -700)
  if (large.length < 3) return null

  const avgDef = Math.round(Math.abs(large.reduce((s, x) => s + x.balance, 0) / large.length))
  return {
    id: 'calorie-deficit-large',
    type: 'warning',
    category: 'nutrition',
    headline: `Large calorie deficit for ${large.length} consecutive days`,
    explanation: `Average deficit on those days: −${fmt(avgDef)} kcal. Sustained large deficits can impair recovery, reduce muscle mass, and suppress HRV. Consider slightly more food around training.`,
    confidence: 'high',
    severity: 'medium',
  }
}

/**
 * Healthy moderate deficit — positive reinforcement.
 * Only fires when balance data is sufficient and the trend is genuinely good.
 */
function ruleCalorieBalanceHealthy(historical: DaySummary[]): Insight | null {
  const vbd = validBalanceDays(historical.slice(-7))
  if (vbd.length < 4) return null

  const avgBal = vbd.reduce((s, x) => s + x.balance, 0) / vbd.length
  if (avgBal > -100 || avgBal < -650) return null // outside healthy deficit range

  return {
    id: 'calorie-balance-healthy',
    type: 'positive',
    category: 'nutrition',
    headline: 'Calorie balance has been consistently healthy',
    explanation: `Your 7-day average balance is ${fmt(avgBal)} kcal — a moderate deficit that supports fat loss without compromising recovery. Current approach appears to be working.`,
    confidence: 'high',
    severity: 'low',
  }
}

/**
 * Protein consistently low — only fires when food logging is reliable.
 * Requires ≥5 meaningfully-logged days in the past 7.
 */
function ruleProteinLow(baselines: Baselines, historical: DaySummary[]): Insight | null {
  const avg      = baselines.protein7d
  const logged   = foodLoggedDays(historical.slice(-7)).filter(d => d.protein != null)
  if (avg == null || logged.length < 5 || avg >= 100) return null
  return {
    id: 'protein-low',
    type: 'recommendation',
    category: 'nutrition',
    headline: `Protein averaging ${Math.round(avg)}g/day across ${logged.length} logged days`,
    explanation: `Your recent protein intake is below the 100–130g target that supports muscle maintenance during training. Prioritise eggs, meat, fish, or dairy at each main meal.`,
    confidence: 'high',
    severity: 'medium',
  }
}

// ── Activity rules ────────────────────────────────────────────────────────────

function ruleActivityGap(historical: DaySummary[]): Insight | null {
  const last7       = historical.slice(-7)
  const inLast3     = historical.slice(-3).filter(d => d.activityMinutes < 10).length
  const hadActivity = last7.some(d => d.activityMinutes > 20)
  if (inLast3 < 3 || !hadActivity) return null
  return {
    id: 'activity-gap',
    type: 'recommendation',
    category: 'activity',
    headline: '3 days without significant activity',
    explanation: 'Even 20–30 minutes of easy movement helps maintain aerobic base and metabolic health.',
    confidence: 'high',
    severity: 'low',
  }
}

function ruleHighLoad(historical: DaySummary[]): Insight | null {
  const last7      = historical.slice(-7)
  const activeDays = last7.filter(d => d.activityMinutes > 20).length
  const totalMins  = last7.reduce((s, d) => s + d.activityMinutes, 0)
  if (activeDays < 6 || totalMins < 400) return null
  return {
    id: 'load-high',
    type: 'recommendation',
    category: 'activity',
    headline: `Heavy week — ${activeDays} sessions, ${Math.round(totalMins)} min`,
    explanation: 'A planned rest or easy day now improves adaptation and reduces injury risk.',
    confidence: 'high',
    severity: 'medium',
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

const TYPE_ORDER: Record<string, number> = {
  warning: 0, recommendation: 1, trend: 2, positive: 3,
}
const SEV_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export function generateInsights(
  historical: DaySummary[], // days BEFORE today, oldest-first
  today: DaySummary | null,
  baselines: Baselines,
): Insight[] {
  const raw: Insight[] = []

  // ── Sleep ──────────────────────────────────────────────────────────────────
  const sleepDecline = ruleSleepDeclining(historical)
  if (sleepDecline) {
    raw.push(sleepDecline)
  } else {
    const sleepLow = ruleSleepLowAverage(baselines, historical)
    if (sleepLow) raw.push(sleepLow)
    else {
      const sleepGood = ruleSleepGood(baselines, historical)
      if (sleepGood) raw.push(sleepGood)
    }
  }

  // ── Recovery (HRV + RHR) ───────────────────────────────────────────────────
  if (today) {
    const hrvLow  = ruleHrvLow(today, baselines)
    const hrvHigh = ruleHrvHigh(today, baselines)
    const rhr     = ruleRhrElevated(today, baselines)

    if (hrvLow)  raw.push(hrvLow)
    else if (hrvHigh) raw.push(hrvHigh)
    else {
      const decline = ruleHrvDeclining(historical, baselines)
      if (decline) raw.push(decline)
    }
    if (rhr) raw.push(rhr)
  }

  // ── Weight ─────────────────────────────────────────────────────────────────
  const weight = ruleWeightTrending(historical)
  if (weight) raw.push(weight)

  // ── Nutrition (context-aware, balance-first) ───────────────────────────────
  // Step 1: Was yesterday's higher intake explained by activity? (positive)
  const intakeJustified = ruleIntakeJustifiedByActivity(historical, baselines)
  if (intakeJustified) raw.push(intakeJustified)

  // Step 2: Multi-day surplus (warning — fires regardless of yesterday's context)
  const surplusStreak = ruleCalorieSurplusStreak(historical)
  if (surplusStreak) raw.push(surplusStreak)

  // Step 3: Large multi-day deficit (warning — fires independently)
  const deficitLarge = ruleCalorieDeficitLarge(historical)
  if (deficitLarge) raw.push(deficitLarge)

  // Step 4: Healthy balance (positive — only when no warnings fired)
  if (!surplusStreak && !deficitLarge) {
    const healthyBal = ruleCalorieBalanceHealthy(historical)
    if (healthyBal) raw.push(healthyBal)
  }

  // Step 5: Protein (independent of balance — about nutrient composition)
  const protein = ruleProteinLow(baselines, historical)
  if (protein) raw.push(protein)

  // ── Activity ───────────────────────────────────────────────────────────────
  const gap  = ruleActivityGap(historical)
  if (gap)  raw.push(gap)
  const load = ruleHighLoad(historical)
  if (load) raw.push(load)

  // Deduplicate by id
  const seen    = new Set<string>()
  const deduped = raw.filter(i => {
    if (seen.has(i.id)) return false
    seen.add(i.id)
    return true
  })

  // Sort: warnings > recommendations > trends > positives; severity within type
  deduped.sort((a, b) => {
    const t = TYPE_ORDER[a.type] - TYPE_ORDER[b.type]
    if (t !== 0) return t
    return SEV_ORDER[a.severity] - SEV_ORDER[b.severity]
  })

  return deduped.slice(0, 5)
}
