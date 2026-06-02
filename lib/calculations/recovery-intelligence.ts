import { format, subDays, parseISO } from 'date-fns'
import { getRecoveryScore } from './recovery-score'
import type { HealthMetrics } from '@/types/database'

function mean(vals: number[]): number {
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

// ── Daily recovery scores ─────────────────────────────────────────────────────

export interface DailyRecovery {
  date: string
  score: number
  status: 'green' | 'yellow' | 'red'
}

export function buildDailyRecoveryScores(metrics: HealthMetrics[]): DailyRecovery[] {
  return metrics.map(m => {
    const r = getRecoveryScore(m)
    return { date: m.date, score: r.score, status: r.status }
  })
}

// ── Training recommendation ───────────────────────────────────────────────────

export interface TrainingWindow {
  recommendation: string
  recommended: string[]
  avoid: string[]
}

export function getTrainingWindow(score: number, hrvTrend: string): TrainingWindow {
  if (score >= 82 && (hrvTrend === 'green' || hrvTrend === 'blue')) {
    return {
      recommendation: 'High readiness for intense training.',
      recommended: ['Hard interval session', 'Long endurance run', 'High-intensity strength work'],
      avoid: [],
    }
  }
  if (score >= 72) {
    return {
      recommendation: 'Hard session is appropriate.',
      recommended: ['Tempo workout', 'Strength session', 'Moderate intervals'],
      avoid: ['Maximal all-out efforts'],
    }
  }
  if (score >= 60) {
    return {
      recommendation: 'Moderate training is appropriate.',
      recommended: ['Zone 2 ride', 'Moderate run', 'Technique and skill work'],
      avoid: ['Maximal efforts', 'VO2 max intervals'],
    }
  }
  if (score >= 45) {
    return {
      recommendation: 'Easy aerobic work recommended.',
      recommended: ['Easy walk or Zone 1 cardio', 'Mobility and stretching', 'Light skills work'],
      avoid: ['High-intensity training', 'Strength to failure'],
    }
  }
  return {
    recommendation: 'Recovery day recommended.',
    recommended: ['Rest', 'Gentle walk', 'Stretching or yoga'],
    avoid: ['Structured training', 'Any high-intensity work'],
  }
}

// ── Driver cards ──────────────────────────────────────────────────────────────

export interface DriverCard {
  label: string
  value: string
  subvalue: string
  signal: string
  signalType: 'positive' | 'negative' | 'neutral'
}

export function buildDriverCards({
  hrvValue,
  avgHrv14d,
  sleepH,
  recoveryScore,
  avgScore30d,
}: {
  hrvValue: number | null
  avgHrv14d: number | null
  sleepH: number | null
  recoveryScore: number
  avgScore30d: number | null
}): DriverCard[] {
  const cards: DriverCard[] = []

  // HRV card
  if (hrvValue != null) {
    const pctChange = avgHrv14d && avgHrv14d > 0
      ? Math.round(((hrvValue - avgHrv14d) / avgHrv14d) * 100)
      : null
    const signalType: DriverCard['signalType'] =
      pctChange == null ? 'neutral'
      : pctChange >= 5 ? 'positive'
      : pctChange <= -5 ? 'negative'
      : 'neutral'
    const signal =
      pctChange == null ? 'No baseline available.'
      : pctChange >= 10 ? 'Strong positive signal.'
      : pctChange >= 5 ? 'Positive signal.'
      : pctChange >= -4 ? 'Neutral signal.'
      : pctChange >= -10 ? 'Slight negative signal.'
      : 'Strong negative signal.'
    cards.push({
      label: 'HRV',
      value: `${hrvValue} ms`,
      subvalue: pctChange != null
        ? `${pctChange >= 0 ? '+' : ''}${pctChange}% vs 14-day baseline`
        : avgHrv14d ? `14d avg: ${Math.round(avgHrv14d)} ms` : 'No baseline',
      signal,
      signalType,
    })
  }

  // Sleep card
  {
    const TARGET = 7.5
    const signalType: DriverCard['signalType'] =
      sleepH == null ? 'neutral'
      : sleepH >= TARGET ? 'positive'
      : sleepH >= 6.5 ? 'neutral'
      : 'negative'
    const signal =
      sleepH == null ? 'No recent data.'
      : sleepH >= TARGET ? 'Positive signal.'
      : sleepH >= 7 ? 'Neutral signal.'
      : sleepH >= 6.5 ? 'Small negative signal.'
      : 'Negative signal.'
    const diff = sleepH != null ? Math.round(Math.abs(sleepH - TARGET) * 10) / 10 : null
    cards.push({
      label: 'Sleep',
      value: sleepH != null ? `${sleepH} h` : '—',
      subvalue: sleepH != null
        ? (sleepH >= TARGET
          ? `${diff}h above target`
          : `target ${TARGET} h`)
        : 'No recent sleep data',
      signal,
      signalType,
    })
  }

  // Recovery Score card
  {
    const diff = avgScore30d != null ? recoveryScore - Math.round(avgScore30d) : null
    const signalType: DriverCard['signalType'] =
      avgScore30d == null ? 'neutral'
      : diff != null && diff >= 5 ? 'positive'
      : diff != null && diff <= -5 ? 'negative'
      : 'neutral'
    const signal =
      avgScore30d == null ? 'No personal baseline yet.'
      : diff != null && diff >= 8 ? 'Well above personal baseline.'
      : diff != null && diff >= 3 ? 'Above personal baseline.'
      : diff != null && diff >= -3 ? 'At personal baseline.'
      : diff != null && diff >= -8 ? 'Below personal baseline.'
      : 'Well below personal baseline.'
    cards.push({
      label: 'Recovery Score',
      value: `${recoveryScore} / 100`,
      subvalue: avgScore30d != null ? `30d avg: ${Math.round(avgScore30d)}` : 'Baseline building',
      signal,
      signalType,
    })
  }

  return cards
}

// ── Correlations ──────────────────────────────────────────────────────────────

export interface RecoveryCorrelation {
  id: string
  title: string
  finding: string
  interpretation: string
}

/** Sleep Duration vs Recovery Score */
export function correlSleepVsRecovery(
  dailyRecovery: DailyRecovery[],
  metrics: HealthMetrics[],
): RecoveryCorrelation | null {
  const recovByDate: Record<string, number> = {}
  for (const d of dailyRecovery) recovByDate[d.date] = d.score

  const pairs = metrics
    .filter(m => m.sleep_minutes && m.sleep_minutes > 0 && recovByDate[m.date] != null)
    .map(m => ({ hours: m.sleep_minutes! / 60, score: recovByDate[m.date] }))

  if (pairs.length < 6) return null

  const good = pairs.filter(p => p.hours >= 7)
  const poor = pairs.filter(p => p.hours < 7)
  if (good.length < 3 || poor.length < 3) return null

  const avgGood = Math.round(mean(good.map(p => p.score)))
  const avgPoor = Math.round(mean(poor.map(p => p.score)))
  const diff = avgGood - avgPoor
  if (Math.abs(diff) < 4) return null

  return {
    id: 'sleep-recovery',
    title: 'Sleep Duration vs Recovery',
    finding: diff > 0
      ? `Nights above 7h produced an average recovery score of ${avgGood}.`
      : `Sleep duration does not strongly differentiate recovery in available data.`,
    interpretation: diff > 0
      ? `Shorter sleep nights averaged ${avgPoor} — a ${diff}-point gap. Sleep duration is a meaningful driver of your recovery.`
      : 'Sleep duration and recovery may be influenced by shared underlying factors.',
  }
}

/** Late Caffeine vs Next-Day Recovery Score */
export function correlCaffeineVsRecovery(
  dailyRecovery: DailyRecovery[],
  coffeeLogs: Array<{ date: string; consumed_at: string }>,
): RecoveryCorrelation | null {
  const lateDates = new Set(
    coffeeLogs.filter(c => new Date(c.consumed_at).getHours() >= 14).map(c => c.date)
  )

  const afterLate: number[] = []
  const afterEarly: number[] = []
  for (const d of dailyRecovery) {
    const prev = format(subDays(parseISO(d.date), 1), 'yyyy-MM-dd')
    if (lateDates.has(prev)) afterLate.push(d.score)
    else afterEarly.push(d.score)
  }

  if (afterLate.length < 3 || afterEarly.length < 3) return null

  const avgLate = Math.round(mean(afterLate))
  const avgEarly = Math.round(mean(afterEarly))
  const diff = avgEarly - avgLate
  if (Math.abs(diff) < 4) return null

  return {
    id: 'caffeine-recovery',
    title: 'Late Caffeine vs Recovery',
    finding: diff > 0
      ? `Days with caffeine after 14:00 averaged recovery score ${avgLate}.`
      : `Late caffeine days averaged recovery score ${avgLate} — no significant reduction detected.`,
    interpretation: diff > 0
      ? `No late caffeine days averaged ${avgEarly} — a ${diff}-point difference. Late caffeine appears to reduce next-day recovery.`
      : 'No significant effect of late caffeine on next-day recovery detected in available data.',
  }
}

const SPORT_HR: Record<string, number> = {
  walk: 95, ride: 130, run: 150, badminton: 130, hike: 110, golf: 80, gym: 120,
}

/** Training Load vs Next-Day Recovery Score */
export function correlTrainingVsRecovery(
  dailyRecovery: DailyRecovery[],
  activities: Array<{ start_time: string; duration_minutes: number | null; avg_hr: number | null; activity_type: string }>,
): RecoveryCorrelation | null {
  const loadByDate: Record<string, number> = {}
  for (const a of activities) {
    const date = a.start_time.slice(0, 10)
    const hours = (a.duration_minutes ?? 0) / 60
    const hr = a.avg_hr != null && a.avg_hr > 50 && a.avg_hr < 230
      ? a.avg_hr
      : (SPORT_HR[a.activity_type] ?? 110)
    loadByDate[date] = (loadByDate[date] ?? 0) + hours * hr
  }

  const highPairs: number[] = []
  const restPairs: number[] = []
  for (const d of dailyRecovery) {
    const prev = format(subDays(parseISO(d.date), 1), 'yyyy-MM-dd')
    const load = loadByDate[prev] ?? 0
    if (load >= 150) highPairs.push(d.score)
    else if (load < 50) restPairs.push(d.score)
  }

  if (highPairs.length < 3 || restPairs.length < 3) return null

  const avgHigh = Math.round(mean(highPairs))
  const avgRest = Math.round(mean(restPairs))
  const diff = avgRest - avgHigh

  return {
    id: 'training-recovery',
    title: 'Training Load vs Recovery',
    finding: Math.abs(diff) >= 4
      ? diff > 0
        ? `High-load days reduced next-day recovery by ${diff} points on average.`
        : `Training days are associated with ${Math.abs(diff)}-point higher next-day recovery.`
      : 'Training load has minimal impact on next-day recovery in available data.',
    interpretation: diff > 4
      ? `Rest days averaged ${avgRest} vs ${avgHigh} after hard sessions. Prioritise sleep and nutrition after high-load days.`
      : diff < -4
      ? `Your body appears to adapt well — rest days averaged ${avgRest} vs ${avgHigh} after hard sessions.`
      : 'Training load and next-day recovery are well balanced in available data.',
  }
}

/** Calorie Deficit vs Next-Day Recovery Score */
export function correlDeficitVsRecovery(
  dailyRecovery: DailyRecovery[],
  intakeByDate: Record<string, number>,
  burnByDate: Record<string, number>,
): RecoveryCorrelation | null {
  const deficitGroup: number[] = []
  const normalGroup: number[] = []
  for (const d of dailyRecovery) {
    const prev = format(subDays(parseISO(d.date), 1), 'yyyy-MM-dd')
    const intake = intakeByDate[prev]
    const burn = burnByDate[prev]
    if (intake == null || burn == null || burn === 0) continue
    const balance = intake - burn
    if (balance < -400) deficitGroup.push(d.score)
    else normalGroup.push(d.score)
  }

  if (deficitGroup.length < 3 || normalGroup.length < 3) return null

  const avgDef = Math.round(mean(deficitGroup))
  const avgNorm = Math.round(mean(normalGroup))
  const diff = avgNorm - avgDef
  if (Math.abs(diff) < 4) return null

  return {
    id: 'deficit-recovery',
    title: 'Calorie Deficit vs Recovery',
    finding: diff > 0
      ? `Large deficit days (<-400 kcal) averaged recovery score ${avgDef}.`
      : `Calorie deficit level shows minimal impact on recovery in available data.`,
    interpretation: diff > 0
      ? `Near-maintenance days averaged ${avgNorm} — a ${diff}-point improvement. Fuelling adequately supports recovery.`
      : 'Calorie deficit level does not appear to significantly affect recovery in available data.',
  }
}

// ── Opportunities ─────────────────────────────────────────────────────────────

export interface RecoveryOpportunity {
  action: string
  impact: string
  reason: string
}

export function buildRecoveryOpportunities({
  avgSleepH,
  avgRhr,
  correlations,
}: {
  avgSleepH: number | null
  avgRhr: number | null
  correlations: RecoveryCorrelation[]
}): RecoveryOpportunity[] {
  const pool: Array<{ score: number; opp: RecoveryOpportunity }> = []
  const TARGET_SLEEP = 7.5

  // Sleep opportunity
  if (avgSleepH != null && avgSleepH < TARGET_SLEEP) {
    const deficMin = Math.round((TARGET_SLEEP - avgSleepH) * 60)
    const pointsEst = Math.min(12, Math.round(deficMin / 4))
    pool.push({
      score: deficMin * 3,
      opp: {
        action: `Sleep ${deficMin} minutes longer`,
        impact: `+${pointsEst} recovery score`,
        reason: `Average sleep is ${deficMin} minutes below the ${TARGET_SLEEP}h target.`,
      },
    })
  }

  // Caffeine opportunity
  const cafCorr = correlations.find(c => c.id === 'caffeine-recovery')
  if (cafCorr && cafCorr.interpretation.includes('-point difference')) {
    const m = cafCorr.interpretation.match(/a (\d+)-point/)
    const pts = m ? parseInt(m[1]) : null
    if (pts && pts >= 4) {
      pool.push({
        score: pts * 10,
        opp: {
          action: 'Avoid caffeine after 14:00',
          impact: `+${pts} recovery score`,
          reason: cafCorr.finding,
        },
      })
    }
  }

  // Deficit opportunity
  const defCorr = correlations.find(c => c.id === 'deficit-recovery')
  if (defCorr && defCorr.interpretation.includes('-point improvement')) {
    const m = defCorr.interpretation.match(/a (\d+)-point/)
    const pts = m ? parseInt(m[1]) : null
    if (pts && pts >= 4) {
      pool.push({
        score: pts * 8,
        opp: {
          action: 'Reduce calorie deficit',
          impact: `+${pts} recovery score`,
          reason: defCorr.finding,
        },
      })
    }
  }

  // Elevated RHR
  if (avgRhr != null && avgRhr > 63) {
    pool.push({
      score: (avgRhr - 60) * 5,
      opp: {
        action: 'Schedule a deload or recovery day',
        impact: 'Lower resting HR, higher HRV',
        reason: `Average resting HR of ${Math.round(avgRhr)} bpm suggests accumulated fatigue.`,
      },
    })
  }

  pool.sort((a, b) => b.score - a.score)
  return pool.slice(0, 4).map(o => o.opp)
}

// ── Experiments ───────────────────────────────────────────────────────────────

export interface RecoveryExperiment {
  title: string
  duration: string
  reason: string
}

export function buildRecoveryExperiments({
  correlations,
  avgSleepH,
  avgRhr,
}: {
  correlations: RecoveryCorrelation[]
  avgSleepH: number | null
  avgRhr: number | null
}): RecoveryExperiment[] {
  const exps: RecoveryExperiment[] = []

  const hasCaffeineSignal = correlations.some(c => c.id === 'caffeine-recovery' && c.interpretation.includes('-point difference'))
  const hasDeficitSignal = correlations.some(c => c.id === 'deficit-recovery' && c.interpretation.includes('-point improvement'))
  const hasSleepGap = avgSleepH != null && avgSleepH < 7.5
  const highRhr = avgRhr != null && avgRhr > 63

  if (hasSleepGap) {
    exps.push({
      title: 'Sleep before 22:30',
      duration: '7 days',
      reason: 'Earlier bedtime is the most reliable way to increase sleep duration.',
    })
  }

  if (hasCaffeineSignal) {
    exps.push({
      title: 'No caffeine after 13:00',
      duration: '7 days',
      reason: 'Late caffeine is associated with reduced recovery in your data.',
    })
  }

  exps.push({
    title: 'Zone 2 instead of intervals',
    duration: '3 workouts',
    reason: 'Zone 2 maintains aerobic fitness without taxing the recovery system.',
  })

  if (hasDeficitSignal || highRhr) {
    exps.push({
      title: 'Maintain consistent wake time',
      duration: '10 days',
      reason: 'Stable wake time anchors circadian rhythm and supports HRV regularity.',
    })
  }

  return exps.slice(0, 4)
}
