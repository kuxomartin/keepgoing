/**
 * Trend computation for the Recent Trend widget.
 *
 * Each metric uses the timeframe that best reveals its signal:
 *   Weight       → 14 days (daily fluctuation is high noise)
 *   HRV          → 5 days  (reacts quickly to load/stress)
 *   Sleep        → 5 days  (medium-term habit)
 *   Training load → 7 days (weekly cycle)
 *   Calorie bal   → 5 days (only where same-date data exists)
 */

import type { DaySummary, TrendItem, TrendSentiment, TrendSummary } from './types'
import { linearSlope } from './baselines'

function fmt(n: number): string { return Math.round(n).toLocaleString() }

// ── Individual trend functions ─────────────────────────────────────────────────

function weightTrend(historical: DaySummary[]): TrendItem | null {
  const days = historical.slice(-14).filter(d => d.weight != null)
  if (days.length < 4) return null

  const slope = linearSlope(days.map(d => d.weight), 4)
  if (slope == null) return null

  const totalChange = slope * (days.length - 1)
  if (Math.abs(totalChange) < 0.15) {
    return { label: 'Weight', value: 'stable', direction: 'stable', window: '14 days', sentiment: 'neutral' }
  }

  const sign = totalChange < 0 ? '−' : '+'
  return {
    label:     'Weight',
    value:     `${sign}${Math.abs(totalChange).toFixed(1)} kg`,
    direction: totalChange < 0 ? 'down' : 'up',
    window:    '14 days',
    sentiment: totalChange < 0 ? 'good' : 'bad',  // assumes fat-loss goal
  }
}

function hrvTrend(historical: DaySummary[]): TrendItem | null {
  const days = historical.slice(-6)
  const withData = days.filter(d => d.hrv != null)
  if (withData.length < 3) return null

  const avgHrv  = withData.reduce((s, d) => s + d.hrv!, 0) / withData.length
  const slope   = linearSlope(days.map(d => d.hrv), 3)
  if (slope == null) return null

  if (Math.abs(slope) < avgHrv * 0.015) {
    return { label: 'HRV', value: 'stable', direction: 'stable', window: '5 days', sentiment: 'neutral' }
  }
  const dir = slope > 0 ? 'up' : 'down'
  return {
    label:     'HRV',
    value:     dir === 'up' ? 'improving' : 'declining',
    direction: dir,
    window:    '5 days',
    sentiment: dir === 'up' ? 'good' : 'bad',
  }
}

function sleepTrend(historical: DaySummary[]): TrendItem | null {
  const days = historical.slice(-6)
  const withData = days.filter(d => d.sleepMinutes != null)
  if (withData.length < 3) return null

  const avgMin  = withData.reduce((s, d) => s + d.sleepMinutes!, 0) / withData.length
  const avgH    = (avgMin / 60).toFixed(1)
  const slope   = linearSlope(days.map(d => d.sleepMinutes), 3)

  const qualSentiment: TrendSentiment = avgMin >= 7 * 60 ? 'good' : avgMin >= 6 * 60 ? 'neutral' : 'bad'

  if (slope == null || Math.abs(slope) < 8) {
    return { label: 'Sleep', value: `${avgH}h avg`, direction: 'stable', window: '5 days', sentiment: qualSentiment }
  }
  const dir = slope > 0 ? 'up' : 'down'
  return {
    label:     'Sleep',
    value:     `${dir === 'up' ? 'improving' : 'declining'} (${avgH}h avg)`,
    direction: dir,
    window:    '5 days',
    sentiment: dir === 'up' ? 'good' : 'bad',
  }
}

function loadTrend(historical: DaySummary[]): TrendItem | null {
  const last7      = historical.slice(-7)
  const totalMins  = last7.reduce((s, d) => s + d.activityMinutes, 0)
  const activeDays = last7.filter(d => d.activityMinutes > 20).length

  if (totalMins === 0) return null

  let value: string
  let sentiment: TrendSentiment

  if (totalMins > 450 || activeDays >= 6) {
    value = `${fmt(totalMins)} min — heavy`
    sentiment = 'neutral' // high load isn't bad, just context
  } else if (totalMins > 180) {
    value = `${fmt(totalMins)} min (${activeDays} sessions)`
    sentiment = 'good'
  } else {
    value = `${fmt(totalMins)} min — light`
    sentiment = 'neutral'
  }

  return {
    label:     'Training load',
    value,
    direction: 'stable', // load is a volume measure, not directional
    window:    '7 days',
    sentiment,
  }
}

function calorieTrend(historical: DaySummary[]): TrendItem | null {
  // Only days with same-date consumed + burn data
  const validDays = historical.slice(-7).filter(d => {
    if (d.calories == null || d.calories < 400) return false
    const hasBurn = d.activeEnergy != null || d.restingEnergy != null
    if (!hasBurn) return false
    const burned = (d.activeEnergy ?? 0) + (d.restingEnergy ?? 0)
    return burned > 0
  })
  if (validDays.length < 3) return null

  const balances = validDays.map(d => {
    const burned = (d.activeEnergy ?? 0) + (d.restingEnergy ?? 0)
    return d.calories! - burned
  })
  const avg = balances.reduce((a, b) => a + b, 0) / balances.length

  let value: string
  let direction: TrendItem['direction']
  let sentiment: TrendSentiment

  if (avg > 300) {
    value = `+${fmt(avg)} kcal surplus`; direction = 'up'; sentiment = 'bad'
  } else if (avg > 50) {
    value = 'near maintenance'; direction = 'stable'; sentiment = 'neutral'
  } else if (avg > -150) {
    value = 'near maintenance'; direction = 'stable'; sentiment = 'neutral'
  } else if (avg > -550) {
    value = `−${fmt(Math.abs(avg))} kcal deficit`; direction = 'down'; sentiment = 'good'
  } else {
    value = `−${fmt(Math.abs(avg))} kcal deficit`; direction = 'down'; sentiment = 'neutral'
  }

  return {
    label: 'Calorie balance',
    value,
    direction,
    window: `${validDays.length} days`,
    sentiment,
  }
}

// ── Main exports ──────────────────────────────────────────────────────────────

export function computeTrendItems(historical: DaySummary[]): TrendItem[] {
  return [
    weightTrend(historical),
    hrvTrend(historical),
    sleepTrend(historical),
    loadTrend(historical),
    calorieTrend(historical),
  ]
    .filter((i): i is TrendItem => i != null)
    .slice(0, 5)
}

export function computeTrendSummary(items: TrendItem[]): { interpretation: string; recommendation: string } {
  if (items.length === 0) {
    return {
      interpretation: 'Not enough data yet to assess trends.',
      recommendation: 'Keep logging to unlock trend analysis.',
    }
  }

  const bad  = items.filter(i => i.sentiment === 'bad')
  const good = items.filter(i => i.sentiment === 'good')

  const weightItem  = items.find(i => i.label === 'Weight')
  const hrvItem     = items.find(i => i.label === 'HRV')
  const sleepItem   = items.find(i => i.label === 'Sleep')
  const loadItem    = items.find(i => i.label === 'Training load')
  const calItem     = items.find(i => i.label === 'Calorie balance')

  if (bad.length === 0 && good.length >= 2) {
    const labels = good.map(i => i.label.toLowerCase())
    return {
      interpretation: `${labels[0].charAt(0).toUpperCase() + labels[0].slice(1)} and ${labels[1] ?? 'other metrics'} are moving in the right direction.`,
      recommendation: 'Maintain current approach — the trend is healthy.',
    }
  }

  if (sleepItem?.sentiment === 'bad') {
    return {
      interpretation: 'Sleep quality is the main concern right now.',
      recommendation: 'Prioritise an earlier bedtime this week — sleep underpins every other metric.',
    }
  }

  if (hrvItem?.sentiment === 'bad') {
    return {
      interpretation: 'HRV has been declining — recovery is under pressure.',
      recommendation: 'Reduce training intensity and focus on sleep and nutrition.',
    }
  }

  if (weightItem?.sentiment === 'bad') {
    return {
      interpretation: 'Weight is trending in an unintended direction.',
      recommendation: calItem?.sentiment === 'bad'
        ? 'Calorie surplus appears consistent — review meal composition.'
        : 'Monitor intake and ensure balance aligns with your goal.',
    }
  }

  if (calItem?.sentiment === 'bad') {
    return {
      interpretation: 'Calorie balance has been in surplus over recent tracked days.',
      recommendation: 'Focus on nutrient-dense meals and reduce unnecessary snacking.',
    }
  }

  if (good.length >= 1) {
    return {
      interpretation: `${good[0].label} is heading in the right direction.`,
      recommendation: bad.length > 0
        ? `Keep the momentum — watch ${bad.map(i => i.label.toLowerCase()).join(' and ')}.`
        : 'Keep doing what you\'re doing.',
    }
  }

  return {
    interpretation: 'Mixed signals across metrics this week.',
    recommendation: 'Focus on sleep and consistent fueling as the foundation.',
  }
}
