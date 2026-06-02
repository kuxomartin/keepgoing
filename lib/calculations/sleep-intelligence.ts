import { format, subDays, parseISO } from 'date-fns'
import type { SleepRecord } from '@/types/database'

// ── Helpers ────────────────────────────────────────────────────────────────────

function mean(vals: number[]): number {
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

function stdDev(vals: number[]): number {
  if (vals.length < 2) return 0
  const m = mean(vals)
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length)
}

// Normalize bedtime minutes to a window relative to 6pm (handles midnight crossover)
function bedtimeMinutes(isoStr: string): number {
  const d    = new Date(isoStr)
  const total = d.getHours() * 60 + d.getMinutes()
  // If before 6am treat as "next day" (i.e. very late)
  return total < 360 ? total + 1440 : total
}

// ── Section 1: Sleep Debt ──────────────────────────────────────────────────────

export interface SleepDebt {
  avgHours: number
  targetHours: number
  dailyDeficitHours: number
  accumulatedDebtHours: number
  nightsAnalyzed: number
  interpretation: string
}

export function computeSleepDebt(
  records: SleepRecord[],
  targetHours = 8,
): SleepDebt | null {
  const valid = records.filter(r => r.asleep_minutes != null)
  if (valid.length < 5) return null

  const avg = mean(valid.map(r => r.asleep_minutes! / 60))
  const daily = targetHours - avg
  const debt  = Math.max(0, daily * valid.length)

  let interpretation: string
  if (daily <= 0.1) {
    interpretation = 'Sleep duration is at or above target. No significant debt accumulating.'
  } else if (daily < 0.25) {
    interpretation = 'Sleep duration is close to target with minimal deficit.'
  } else if (daily < 0.5) {
    interpretation = `Mild daily deficit averaging ${Math.round(daily * 60)} minutes below target.`
  } else if (daily < 1) {
    interpretation = `Moderate daily deficit. Consider extending sleep by 30–45 minutes.`
  } else {
    interpretation = `Significant daily deficit of ${Math.round(daily * 60)} minutes. Consistent earlier bedtime strongly recommended.`
  }

  return {
    avgHours:              Math.round(avg * 10) / 10,
    targetHours,
    dailyDeficitHours:     Math.round(Math.max(0, daily) * 10) / 10,
    accumulatedDebtHours:  Math.round(debt * 10) / 10,
    nightsAnalyzed:        valid.length,
    interpretation,
  }
}

// ── Section 2: Consistency ─────────────────────────────────────────────────────

export interface SleepConsistency {
  bedtimeSpreadMin: number
  wakeSpreadMin: number
  bedtimeSpread: string
  wakeSpread: string
  rating: 'highly consistent' | 'moderately consistent' | 'inconsistent'
  interpretation: string
}

export function computeConsistency(records: SleepRecord[]): SleepConsistency | null {
  const valid = records.filter(r => r.start_time && r.end_time)
  if (valid.length < 5) return null

  const bedMins  = valid.map(r => bedtimeMinutes(r.start_time!))
  const wakeMins = valid.map(r => {
    const d = new Date(r.end_time!)
    return d.getHours() * 60 + d.getMinutes()
  })

  const bedSD  = Math.round(stdDev(bedMins))
  const wakeSD = Math.round(stdDev(wakeMins))

  const rating: SleepConsistency['rating'] =
    bedSD < 30 && wakeSD < 30 ? 'highly consistent'
    : bedSD < 60 && wakeSD < 60 ? 'moderately consistent'
    : 'inconsistent'

  let interpretation: string
  if (rating === 'highly consistent') {
    interpretation = 'Bedtime and wake time are well-regulated. Consistent timing supports circadian rhythm stability.'
  } else if (rating === 'moderately consistent') {
    interpretation = 'Some variability in sleep timing detected. Tightening the bedtime window by 10–15 minutes could improve sleep depth.'
  } else {
    interpretation = 'High bedtime variability detected. Irregular sleep timing disrupts circadian rhythm and reduces sleep quality.'
  }

  return {
    bedtimeSpreadMin: bedSD,
    wakeSpreadMin:    wakeSD,
    bedtimeSpread:    `±${bedSD} min`,
    wakeSpread:       `±${wakeSD} min`,
    rating,
    interpretation,
  }
}

// ── Section 3: Sleep Intelligence (correlations) ──────────────────────────────

export interface SleepInsight {
  id: string
  title: string
  comparison: string
  difference: string
  interpretation: string
}

// Card 1: Sleep Duration vs HRV
export function computeSleepVsHrv(
  records: SleepRecord[],
  hrvData: Array<{ date: string; hrv_ms: number | string | null }>,
): SleepInsight | null {
  const hrvByDate: Record<string, number> = {}
  for (const h of hrvData) {
    if (h.hrv_ms != null) hrvByDate[h.date] = Number(h.hrv_ms)
  }

  const pairs = records
    .filter(r => r.asleep_minutes != null && hrvByDate[r.date] != null)
    .map(r => ({ hours: r.asleep_minutes! / 60, hrv: hrvByDate[r.date] }))

  if (pairs.length < 6) return null

  const good = pairs.filter(p => p.hours >= 7)
  const poor = pairs.filter(p => p.hours < 7)
  if (good.length < 3 || poor.length < 3) return null

  const avgGood = mean(good.map(p => p.hrv))
  const avgPoor = mean(poor.map(p => p.hrv))
  const diff    = Math.round(avgGood - avgPoor)
  if (Math.abs(diff) < 3) return null

  return {
    id: 'sleep-hrv',
    title: 'Sleep Duration vs HRV',
    comparison: `≥7h nights (n=${good.length}) vs <7h nights (n=${poor.length})`,
    difference: diff > 0
      ? `HRV was ${diff} ms higher after ≥7h of sleep`
      : `HRV was ${Math.abs(diff)} ms lower after ≥7h of sleep`,
    interpretation: diff > 0
      ? 'Longer sleep is associated with better next-day HRV in your data.'
      : 'Sleep duration alone may not be driving HRV variation — sleep quality or other factors may be dominant.',
  }
}

// Card 2: Sleep vs Caffeine Timing
export function computeSleepVsCaffeine(
  records: SleepRecord[],
  coffeeAll: Array<{ date: string; consumed_at: string }>,
): SleepInsight | null {
  const lateDates = new Set(
    coffeeAll.filter(c => new Date(c.consumed_at).getHours() >= 14).map(c => c.date)
  )

  const afterLate  = records.filter(r => {
    const prev = format(subDays(parseISO(r.date), 1), 'yyyy-MM-dd')
    return lateDates.has(prev) && r.asleep_minutes != null
  })
  const afterEarly = records.filter(r => {
    const prev = format(subDays(parseISO(r.date), 1), 'yyyy-MM-dd')
    return !lateDates.has(prev) && r.asleep_minutes != null
  })

  if (afterLate.length < 3 || afterEarly.length < 3) return null

  const avgLate  = mean(afterLate.map(r => r.asleep_minutes!))
  const avgEarly = mean(afterEarly.map(r => r.asleep_minutes!))
  const diffMin  = Math.round(avgEarly - avgLate)
  if (Math.abs(diffMin) < 15) return null

  return {
    id: 'sleep-caffeine',
    title: 'Sleep vs Caffeine Timing',
    comparison: `After late caffeine (n=${afterLate.length}) vs No late caffeine (n=${afterEarly.length})`,
    difference: diffMin > 0
      ? `${diffMin} fewer minutes of sleep after late caffeine`
      : `${Math.abs(diffMin)} more minutes of sleep (no late caffeine effect in data)`,
    interpretation: diffMin > 0
      ? 'Late caffeine (after 14:00) is associated with reduced sleep duration in your records.'
      : 'No significant negative association between late caffeine and sleep duration detected.',
  }
}

// Card 3: Sleep vs Calorie Deficit
export function computeSleepVsDeficit(
  records: SleepRecord[],
  intakeByDate: Record<string, number>,
  burnByDate:   Record<string, number>,
): SleepInsight | null {
  const pairs = records
    .filter(r => r.asleep_minutes != null)
    .flatMap(r => {
      const prev   = format(subDays(parseISO(r.date), 1), 'yyyy-MM-dd')
      const intake = intakeByDate[prev]
      const burn   = burnByDate[prev]
      if (intake == null || burn == null || burn === 0) return []
      return [{ balance: intake - burn, hours: r.asleep_minutes! / 60 }]
    })

  if (pairs.length < 6) return null

  const deficitGroup = pairs.filter(p => p.balance < -400)
  const normalGroup  = pairs.filter(p => p.balance >= -400)
  if (deficitGroup.length < 3 || normalGroup.length < 3) return null

  const avgDef = mean(deficitGroup.map(p => p.hours))
  const avgNorm = mean(normalGroup.map(p => p.hours))
  const diffMin = Math.round((avgNorm - avgDef) * 60)
  if (Math.abs(diffMin) < 15) return null

  return {
    id: 'sleep-deficit',
    title: 'Sleep vs Calorie Deficit',
    comparison: `Large deficit days (<-400 kcal, n=${deficitGroup.length}) vs Near-maintenance (n=${normalGroup.length})`,
    difference: diffMin > 0
      ? `${diffMin} fewer minutes of sleep after large deficit days`
      : `${Math.abs(diffMin)} more minutes of sleep after large deficit days`,
    interpretation: diffMin > 0
      ? 'Large calorie deficits are associated with shorter sleep. Consider eating more on hard training days.'
      : 'Calorie deficit level does not appear to negatively affect sleep duration in available data.',
  }
}

// Card 4: Sleep vs Training Load
const SPORT_HR: Record<string, number> = {
  walk: 95, ride: 130, run: 150, badminton: 130, hike: 110, golf: 80, gym: 120,
}

export function computeSleepVsTraining(
  records: SleepRecord[],
  activities: Array<{ start_time: string; duration_minutes: number | null; avg_hr: number | null; activity_type: string }>,
): SleepInsight | null {
  // Build daily load
  const loadByDate: Record<string, number> = {}
  for (const a of activities) {
    const date  = a.start_time.slice(0, 10)
    const hours = (a.duration_minutes ?? 0) / 60
    const hr    = a.avg_hr != null && a.avg_hr > 50 && a.avg_hr < 230 ? a.avg_hr : (SPORT_HR[a.activity_type] ?? 110)
    loadByDate[date] = (loadByDate[date] ?? 0) + hours * hr
  }

  const pairs = records
    .filter(r => r.efficiency_pct != null && r.asleep_minutes != null)
    .map(r => {
      const prev = format(subDays(parseISO(r.date), 1), 'yyyy-MM-dd')
      return { load: loadByDate[prev] ?? 0, eff: Number(r.efficiency_pct!) }
    })

  if (pairs.length < 6) return null

  const hard = pairs.filter(p => p.load >= 150)
  const rest = pairs.filter(p => p.load < 50)
  if (hard.length < 3 || rest.length < 3) return null

  const avgHardEff = mean(hard.map(p => p.eff))
  const avgRestEff = mean(rest.map(p => p.eff))
  const diff       = Math.round(avgHardEff - avgRestEff)
  if (Math.abs(diff) < 2) return null

  return {
    id: 'sleep-training',
    title: 'Sleep vs Training Load',
    comparison: `High training days (n=${hard.length}) vs Rest days (n=${rest.length})`,
    difference: diff > 0
      ? `Sleep efficiency ${diff}% higher after hard training`
      : `Sleep efficiency ${Math.abs(diff)}% lower after hard training`,
    interpretation: diff > 0
      ? 'Hard training days appear associated with more efficient sleep — a positive recovery signal.'
      : 'Heavy training may be reducing sleep efficiency. Prioritise nutrition and recovery on hard days.',
  }
}

// ── Section 4: Sleep Coach ─────────────────────────────────────────────────────

export interface CoachCard {
  priority: 'top' | 'secondary' | 'maintain'
  label: string
  observation: string
  recommendation: string
  benefit: string
}

export function computeSleepCoach({
  debt,
  consistency,
  insights,
  avgEfficiency,
}: {
  debt:           SleepDebt | null
  consistency:    SleepConsistency | null
  insights:       SleepInsight[]
  avgEfficiency:  number | null
}): CoachCard[] {
  const pool: Array<{ score: number; card: Omit<CoachCard, 'priority'> }> = []

  // Duration / debt
  if (debt && debt.dailyDeficitHours >= 0.25) {
    pool.push({
      score: debt.dailyDeficitHours * 100,
      card: {
        label: 'Increase Sleep Duration',
        observation: `Average ${debt.avgHours}h — ${Math.round(debt.dailyDeficitHours * 60)} minutes below the ${debt.targetHours}h target.`,
        recommendation: 'Move bedtime 20–30 minutes earlier for 10 consecutive days.',
        benefit: `Reduces estimated accumulated sleep debt of ${debt.accumulatedDebtHours}h.`,
      },
    })
  }

  // Caffeine
  const cafIns = insights.find(i => i.id === 'sleep-caffeine')
  if (cafIns) {
    const m = cafIns.difference.match(/(\d+) fewer/)
    const min = m ? parseInt(m[1]) : 0
    if (min >= 20) {
      pool.push({
        score: min * 3,
        card: {
          label: 'Reduce Late Caffeine',
          observation: cafIns.difference + '.',
          recommendation: 'Stop caffeine at 13:00 for 10 days.',
          benefit: `Potentially ${min}+ additional minutes of sleep per night.`,
        },
      })
    }
  }

  // Consistency
  if (consistency?.rating === 'inconsistent') {
    pool.push({
      score: 65,
      card: {
        label: 'Fix Bedtime Consistency',
        observation: `Bedtime spread is ${consistency.bedtimeSpread} — high variability disrupts circadian rhythm.`,
        recommendation: 'Set a fixed bedtime target and hold it within ±20 minutes for 2 weeks.',
        benefit: 'Stable circadian rhythm improves sleep depth and HRV.',
      },
    })
  } else if (consistency?.rating === 'moderately consistent') {
    pool.push({
      score: 30,
      card: {
        label: 'Tighten Bedtime Window',
        observation: `Bedtime varies by ${consistency.bedtimeSpread} — room for improvement.`,
        recommendation: 'Aim to be in bed within ±15 minutes of your usual time.',
        benefit: 'Tighter circadian alignment improves sleep depth and morning HRV.',
      },
    })
  }

  // Deficit
  const defIns = insights.find(i => i.id === 'sleep-deficit')
  if (defIns) {
    const m = defIns.difference.match(/(\d+) fewer/)
    const min = m ? parseInt(m[1]) : 0
    if (min >= 20) {
      pool.push({
        score: min * 2,
        card: {
          label: 'Reduce Deficit on Training Days',
          observation: defIns.difference + '.',
          recommendation: 'Keep calorie deficit under 400 kcal on training days.',
          benefit: 'Better fuelling supports sleep duration and overnight recovery.',
        },
      })
    }
  }

  // Training-linked poor sleep efficiency
  const trainIns = insights.find(i => i.id === 'sleep-training')
  if (trainIns && trainIns.difference.includes('lower')) {
    pool.push({
      score: 25,
      card: {
        label: 'Support Recovery After Hard Days',
        observation: trainIns.difference + '.',
        recommendation: 'On heavy training days: eat earlier, limit caffeine, and target an earlier bedtime.',
        benefit: 'Improved sleep efficiency after hard training accelerates muscle repair and HRV recovery.',
      },
    })
  }

  pool.sort((a, b) => b.score - a.score)

  if (pool.length === 0) {
    return [{
      priority: 'maintain',
      label: 'Maintain Current Habits',
      observation: 'No significant sleep issues detected in available data.',
      recommendation: 'Continue current sleep patterns and log consistently for a stronger signal.',
      benefit: 'Sustained consistency is the primary driver of long-term sleep quality.',
    }]
  }

  const cards: CoachCard[] = []
  if (pool[0]) cards.push({ priority: 'top',       ...pool[0].card })
  if (pool[1]) cards.push({ priority: 'secondary',  ...pool[1].card })

  // Maintain card: if there's something good
  const goodEff = avgEfficiency != null && avgEfficiency >= 85
  const goodCon = consistency?.rating === 'highly consistent'
  if (goodEff || goodCon) {
    cards.push({
      priority: 'maintain',
      label: goodCon ? 'Maintain Bedtime Consistency' : 'Maintain Sleep Efficiency',
      observation: goodCon
        ? `Bedtime consistency is ${consistency!.bedtimeSpread} — well within target.`
        : `Average sleep efficiency of ${Math.round(avgEfficiency!)}% — strong.`,
      recommendation: goodCon ? 'Keep your fixed bedtime routine.' : 'Maintain current pre-sleep habits.',
      benefit: 'Consistent high efficiency is a reliable recovery signal.',
    })
  }

  return cards.slice(0, 3)
}
