/**
 * Rule-based daily recommendation engine.
 *
 * Deterministic, no LLM calls. Evaluates recovery, nutrition trends,
 * activity, and protein to produce a single prioritised recommendation.
 *
 * Priority order (first matching rule wins):
 *   1. Recovery caution (HRV suppressed)
 *   2. Short sleep + high load (no HRV)
 *   3. Large calorie deficit (yday or 3d avg < -700 kcal)
 *   4. Surplus trend (7d avg > +200 kcal)
 *   5. Good deficit trend (7d avg -150 to -650 kcal)
 *   6. Protein still low (afternoon, below 70% of target)
 *   7. Bike session overdue (5+ days since last ride, recovery OK)
 *   8. Neutral fallback
 */

import type { DaySummary } from './types'
import type { PersonalContextSummary } from '@/lib/profile/context-loader'

// ── Helpers ───────────────────────────────────────────────────────────────────

function dayBalance(d: DaySummary): number | null {
  const burned = (d.activeEnergy ?? 0) + (d.restingEnergy ?? 0)
  if ((d.calories ?? 0) < 200 || burned < 100 || d.restingEnergy == null) return null
  return d.calories! - burned
}

function validBalances(days: DaySummary[]): number[] {
  return days.map(d => dayBalance(d)).filter((b): b is number => b != null)
}

function avg(vals: number[]): number | null {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecommendationStatus = 'rest' | 'easy' | 'train' | 'fuel' | 'deficit' | 'neutral'

export interface DailyRecommendation {
  status:     RecommendationStatus
  title:      string
  reasons:    string[]       // 2–4 short bullet facts
  action:     string         // single clear suggested action
  confidence: 'low' | 'medium' | 'high'
}

export interface RecommendationInput {
  // Recovery
  todayHrv:        number | null
  hrv14dBaseline:  number | null
  todaySleepH:     number | null

  // Today nutrition
  consumedKcal:    number | null
  proteinG:        number | null
  fatG:            number | null   // null if not tracked today

  // Historical context (30-day, oldest-first, today excluded)
  historical:      DaySummary[]
  yday:            DaySummary | null

  // Activity
  weeklyActivityMins:  number
  daysSinceLastBike:   number | null  // null = no ride found in window

  // Targets
  proteinTargetG:  number            // hardcoded until settings exist

  // Optional personal context (from personal_context_facts)
  personalContext?: PersonalContextSummary
}

// Status → display label (used by RecommendationCard)
export const STATUS_LABELS: Record<RecommendationStatus, string> = {
  rest:    'Rest day',
  easy:    'Easy day',
  train:   'Training day',
  fuel:    'Fuel up',
  deficit: 'Deficit on track',
  neutral: 'No strong signal',
}

// ── Engine ────────────────────────────────────────────────────────────────────

export function generateDailyRecommendation(input: RecommendationInput): DailyRecommendation {
  const {
    todayHrv, hrv14dBaseline, todaySleepH,
    proteinG, fatG,
    historical, yday,
    weeklyActivityMins, daysSinceLastBike,
    proteinTargetG,
    personalContext,
  } = input

  // ── Pre-compute balances ────────────────────────────────────────────────
  const bal7d = validBalances(historical.slice(-7))
  const bal3d = validBalances(historical.slice(-3))
  const avg7d = avg(bal7d)
  const avg3d = avg(bal3d)
  const ydayBal = yday ? dayBalance(yday) : null

  const hasEnoughData =
    historical.filter(d => d.calories != null || d.hrv != null).length >= 3

  // ── HRV ratio ───────────────────────────────────────────────────────────
  const hrvRatio =
    todayHrv != null && hrv14dBaseline != null && hrv14dBaseline > 0
      ? todayHrv / hrv14dBaseline
      : null

  const recoveryOk = hrvRatio == null || hrvRatio >= 0.92

  // ────────────────────────────────────────────────────────────────────────
  // Rule 1: Recovery caution — HRV suppressed
  // ────────────────────────────────────────────────────────────────────────
  if (hrvRatio != null && hrvRatio < 0.85) {
    const pct = Math.abs(Math.round((1 - hrvRatio) * 100))
    const reasons: string[] = [`HRV is ${pct}% below your 14-day baseline.`]
    if (weeklyActivityMins > 300) {
      reasons.push(`Training load has been high this week (${Math.round(weeklyActivityMins)} min).`)
    }
    if (todaySleepH != null && todaySleepH < 6.5) {
      reasons.push(`Last night's sleep was ${todaySleepH.toFixed(1)}h.`)
    }
    return {
      status:     'rest',
      title:      'Recovery is below baseline today.',
      reasons,
      action:     'Keep today easy. Prioritise food, hydration, and an early bedtime.',
      confidence: 'high',
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Rule 2: Short sleep + high load (no HRV data available)
  // ────────────────────────────────────────────────────────────────────────
  if (
    hrvRatio == null &&
    todaySleepH != null && todaySleepH < 6.0 &&
    weeklyActivityMins > 300
  ) {
    return {
      status:  'easy',
      title:   'Short sleep after a heavy training week.',
      reasons: [
        `Sleep was ${todaySleepH.toFixed(1)}h — below recovery threshold.`,
        `Activity this week: ${Math.round(weeklyActivityMins)} min.`,
      ],
      action:     'Keep effort low today. Prioritise sleep tonight.',
      confidence: 'medium',
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Rule 3: Large calorie deficit (yesterday or 3-day average < -700 kcal)
  // ────────────────────────────────────────────────────────────────────────
  const ydayLarge = ydayBal != null && ydayBal < -700
  const avg3dLarge = avg3d != null && avg3d < -700

  if (ydayLarge || avg3dLarge) {
    const reasons: string[] = []
    if (ydayLarge && ydayBal != null) {
      reasons.push(`Yesterday's calorie deficit was ${Math.abs(Math.round(ydayBal))} kcal.`)
    }
    if (avg3dLarge && avg3d != null) {
      reasons.push(`3-day average deficit: ${Math.abs(Math.round(avg3d))} kcal/day.`)
    }
    reasons.push('Repeated large deficits can impair recovery and muscle retention.')
    return {
      status:     'fuel',
      title:      'Calorie deficit has been large.',
      reasons,
      action:     'Eat normally today. Keep protein high and avoid forcing another large deficit.',
      confidence: ydayBal != null ? 'high' : 'medium',
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Rule 4: Surplus trend (7-day average > +200 kcal)
  // ────────────────────────────────────────────────────────────────────────
  if (avg7d != null && avg7d > 200 && bal7d.length >= 4) {
    const reasons: string[] = [
      `7-day average calorie balance is +${Math.round(avg7d)} kcal/day.`,
    ]
    if (weeklyActivityMins < 120) {
      reasons.push(`Activity this week has been low (${Math.round(weeklyActivityMins)} min).`)
    }
    if (daysSinceLastBike != null && daysSinceLastBike >= 4 && recoveryOk) {
      reasons.push(`Last bike ride was ${daysSinceLastBike} days ago.`)
    }
    return {
      status:  'easy',
      title:   'Energy balance is trending positive.',
      reasons,
      action:
        daysSinceLastBike != null && daysSinceLastBike >= 4 && recoveryOk
          ? 'Plan a 60–90 min easy ride or a long walk today or tomorrow.'
          : 'Add some movement today to bring balance back toward neutral.',
      confidence: bal7d.length >= 5 ? 'high' : 'medium',
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Rule 5: Good moderate deficit (7-day average -150 to -650 kcal)
  // ────────────────────────────────────────────────────────────────────────
  if (avg7d != null && avg7d >= -650 && avg7d <= -150 && bal7d.length >= 4) {
    const reasons: string[] = [
      `7-day average calorie balance: ${Math.round(avg7d)} kcal/day.`,
      'This is a moderate deficit — consistent with steady progress.',
    ]
    if (hrvRatio != null && hrvRatio >= 1.0) {
      reasons.push('Recovery markers are holding well.')
    }
    const bikeDue = daysSinceLastBike != null && daysSinceLastBike >= 4

    return applyContext({
      status:  'deficit',
      title:   'Deficit trend is on track.',
      reasons,
      action:
        recoveryOk && bikeDue
          ? `Stay consistent. Last bike was ${daysSinceLastBike} days ago — a ride fits well.`
          : 'Stay consistent. No need to overcorrect today.',
      confidence: bal7d.length >= 5 ? 'high' : 'medium',
    }, personalContext, avg7d)
  }

  // ────────────────────────────────────────────────────────────────────────
  // Rule 6: Protein still low (afternoon, below 70% of target)
  // ────────────────────────────────────────────────────────────────────────
  const hourNow = new Date().getHours()
  const proteinLow =
    proteinG != null &&
    proteinTargetG > 0 &&
    proteinG < proteinTargetG * 0.7 &&
    hourNow >= 14

  if (proteinLow && proteinG != null) {
    const remaining = Math.round(proteinTargetG - proteinG)
    const fatHigh   = fatG != null && fatG > 80
    const reasons: string[] = [
      `Protein so far: ${Math.round(proteinG)} g — target is ${proteinTargetG} g.`,
      `${remaining} g still to reach target.`,
    ]
    if (fatHigh) {
      reasons.push('Fat intake is already high — prefer low-fat protein sources.')
    }
    return {
      status:  'fuel',
      title:   'Protein is still low for the day.',
      reasons,
      action:  fatHigh
        ? 'Choose skyr, cottage cheese, egg whites, or lean meat — avoid nuts and cheese.'
        : 'Choose skyr, cottage cheese, lean meat, or a protein shake.',
      confidence: 'high',
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Rule 7: Bike session overdue (5+ days, recovery OK)
  // ────────────────────────────────────────────────────────────────────────
  if (daysSinceLastBike != null && daysSinceLastBike >= 5 && recoveryOk) {
    const reasons: string[] = [
      `Last bike ride was ${daysSinceLastBike} days ago.`,
    ]
    if (hrvRatio != null && hrvRatio >= 1.0) {
      reasons.push('Recovery markers look normal.')
    }
    if (avg7d != null && avg7d > 0) {
      reasons.push('A longer ride would also help bring energy balance toward neutral.')
    }
    return applyContext({
      status:     'train',
      title:      'A bike session is overdue.',
      reasons,
      action:     'Plan 90–120 min at an easy to moderate effort.',
      confidence: 'medium',
    }, personalContext, avg7d)
  }

  // ────────────────────────────────────────────────────────────────────────
  // Fallback: not enough trend data yet
  // ────────────────────────────────────────────────────────────────────────
  if (!hasEnoughData) {
    return applyContext({
      status:     'neutral',
      title:      'Not enough trend data yet.',
      reasons:    ['Log a few more days of food and activity to unlock recommendations.'],
      action:     "Use today's calories and protein as the main guide.",
      confidence: 'low',
    }, personalContext, avg7d)
  }

  // ────────────────────────────────────────────────────────────────────────
  // Neutral: data exists but no strong signal
  // ────────────────────────────────────────────────────────────────────────
  const neutralReasons: string[] = []
  if (avg7d != null) {
    neutralReasons.push(
      `7-day average calorie balance: ${avg7d > 0 ? '+' : ''}${Math.round(avg7d)} kcal/day.`,
    )
  }
  if (hrvRatio != null) {
    const pct = Math.round(Math.abs(1 - hrvRatio) * 100)
    neutralReasons.push(
      hrvRatio >= 1.0
        ? `HRV is ${pct}% above baseline.`
        : `HRV is ${pct}% below baseline.`,
    )
  }

  return applyContext({
    status:     'neutral',
    title:      'No strong signal today.',
    reasons:    neutralReasons.length
      ? neutralReasons
      : ['All key metrics are within normal range.'],
    action:     'Continue with your planned training and eating.',
    confidence: 'low',
  }, personalContext, avg7d)
}

// ── Personal context enrichment ───────────────────────────────────────────────
// Applied after rule resolution. Max one context addition to keep the card tight.

function applyContext(
  rec:     DailyRecommendation,
  ctx:     PersonalContextSummary | undefined,
  avg7d:   number | null,
): DailyRecommendation {
  if (!ctx) return rec

  // Rule C1: warm-up reminder when recommending training, if ACL/Achilles flag set
  if (
    (rec.status === 'train' || rec.status === 'deficit') &&
    (ctx.hasAclPredisposition || ctx.hasAchillesPredisposition)
  ) {
    return {
      ...rec,
      action: rec.action + ' Warm up thoroughly before the session — your profile includes a tendon predisposition note.',
    }
  }

  // Rule C2: reference goal weight when discussing deficit trend or surplus
  if (
    (rec.status === 'deficit' || rec.status === 'easy') &&
    ctx.weightGoalKg != null
  ) {
    const goalNote = `Goal weight: ${ctx.weightGoalKg} kg.`
    if (!rec.reasons.some(r => r.includes('goal'))) {
      return {
        ...rec,
        reasons: [...rec.reasons, goalNote],
      }
    }
  }

  return rec
}
