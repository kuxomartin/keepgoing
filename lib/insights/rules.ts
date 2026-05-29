/**
 * Rule-based insight generation.
 *
 * Each rule is self-contained: it checks one condition and returns an Insight or null.
 * Only high/medium-confidence insights are returned.
 * Max 5 insights total, sorted: warnings first, then recommendations, then positives.
 */

import type { Insight, DaySummary, Baselines } from './types'
import { linearSlope } from './baselines'

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(ratio: number): string {
  return `${Math.round(Math.abs(ratio - 1) * 100)}%`
}

// ── Individual rule functions ─────────────────────────────────────────────────

function ruleSleepDeclining(historical: DaySummary[]): Insight | null {
  const last5 = historical.slice(-5).map(d => d.sleepMinutes)
  const slope  = linearSlope(last5, 3)
  if (slope == null || slope >= -12) return null // must be declining >12 min/day
  const days = historical.slice(-5).filter(d => d.sleepMinutes != null).length
  if (days < 3) return null
  return {
    id: 'sleep-declining',
    type: 'warning',
    category: 'sleep',
    headline: 'Sleep has been getting shorter',
    explanation: `Your sleep duration has declined noticeably over the past ${days} nights. Try going to bed 30–45 minutes earlier tonight.`,
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

function ruleHrvLow(today: DaySummary, baselines: Baselines): Insight | null {
  const b = baselines.hrv14d
  const v = today.hrv
  if (b == null || v == null || v / b >= 0.85) return null
  return {
    id: 'hrv-low',
    type: 'warning',
    category: 'recovery',
    headline: `HRV is ${pct(v / b)} below your baseline`,
    explanation: `Today's HRV (${Math.round(v)} ms) is suppressed relative to your 14-day average (${Math.round(b)} ms). Favour easy or no training.`,
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
    explanation: `Today's HRV (${Math.round(v)} ms) is elevated vs your 14-day average (${Math.round(b)} ms). Your nervous system is well recovered.`,
    confidence: 'high',
    severity: 'low',
  }
}

function ruleHrvDeclining(historical: DaySummary[], baselines: Baselines): Insight | null {
  const b     = baselines.hrv14d
  if (b == null) return null
  const last5  = historical.slice(-5).map(d => d.hrv)
  const slope  = linearSlope(last5, 3)
  if (slope == null || slope >= -0.5) return null
  if (Math.abs(slope) / b < 0.015) return null // <1.5% of baseline per day — noise
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
  const b    = baselines.restingHr14d
  const v    = today.restingHr
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

function ruleWeightTrending(historical: DaySummary[]): Insight | null {
  const weightDays = historical.slice(-14).filter(d => d.weight != null)
  if (weightDays.length < 5) return null
  const slope = linearSlope(weightDays.map(d => d.weight), 5)
  if (slope == null) return null

  if (slope < -0.05) { // losing >350g/week
    return {
      id: 'weight-trending-down',
      type: 'trend',
      category: 'weight',
      headline: 'Weight is trending down',
      explanation: `A steady decrease over the past two weeks. Your current approach appears to be working — keep calorie targets consistent.`,
      confidence: 'high',
      severity: 'low',
    }
  }
  if (slope > 0.07) { // gaining >490g/week
    return {
      id: 'weight-trending-up',
      type: 'warning',
      category: 'weight',
      headline: 'Weight has been rising this week',
      explanation: `Your weight has increased over the past two weeks. If this is unintentional, review calorie intake.`,
      confidence: 'high',
      severity: 'medium',
    }
  }
  return null
}

function ruleProteinLow(baselines: Baselines, historical: DaySummary[]): Insight | null {
  const avg   = baselines.protein7d
  const count = historical.slice(-7).filter(d => d.protein != null).length
  if (avg == null || count < 4 || avg >= 100) return null
  return {
    id: 'protein-low',
    type: 'recommendation',
    category: 'nutrition',
    headline: `Protein averaging only ${Math.round(avg)}g/day`,
    explanation: `Your 7-day protein average is below the 100–130g range that supports muscle maintenance and recovery during training.`,
    confidence: 'high',
    severity: 'medium',
  }
}

function ruleCalorieSpike(historical: DaySummary[], baselines: Baselines): Insight | null {
  const base  = baselines.calories7d
  const yday  = historical.slice(-1)[0]
  if (base == null || yday?.calories == null) return null
  const ratio = yday.calories / base
  if (ratio < 1.25 || yday.calories < base + 300) return null
  return {
    id: 'calorie-spike',
    type: 'warning',
    category: 'nutrition',
    headline: `Yesterday's intake was ${pct(ratio)} above your average`,
    explanation: `You consumed ${Math.round(yday.calories).toLocaleString()} kcal yesterday vs your ~${Math.round(base).toLocaleString()} kcal average. Consider eating lighter today.`,
    confidence: 'high',
    severity: 'low',
  }
}

function ruleActivityGap(historical: DaySummary[]): Insight | null {
  const last7         = historical.slice(-7)
  const inactiveLast3 = historical.slice(-3).filter(d => d.activityMinutes < 10).length
  const hadActivity   = last7.some(d => d.activityMinutes > 20)
  if (inactiveLast3 < 3 || !hadActivity) return null
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
  const last7       = historical.slice(-7)
  const activeDays  = last7.filter(d => d.activityMinutes > 20).length
  const totalMins   = last7.reduce((s, d) => s + d.activityMinutes, 0)
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
  if (sleepDecline) raw.push(sleepDecline)
  else {
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

  // ── Nutrition ─────────────────────────────────────────────────────────────
  const protein = ruleProteinLow(baselines, historical)
  if (protein) raw.push(protein)
  const calSpike = ruleCalorieSpike(historical, baselines)
  if (calSpike) raw.push(calSpike)

  // ── Activity ───────────────────────────────────────────────────────────────
  const gap  = ruleActivityGap(historical)
  if (gap)  raw.push(gap)
  const load = ruleHighLoad(historical)
  if (load) raw.push(load)

  // Deduplicate by id (in case rules overlap)
  const seen = new Set<string>()
  const deduped = raw.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true })

  // Sort: warnings > recommendations > trends > positives; within type by severity
  deduped.sort((a, b) => {
    const t = TYPE_ORDER[a.type] - TYPE_ORDER[b.type]
    if (t !== 0) return t
    return SEV_ORDER[a.severity] - SEV_ORDER[b.severity]
  })

  return deduped.slice(0, 5)
}
