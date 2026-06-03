/**
 * Energy Balance computation helpers.
 * Pure functions — no Supabase, no side effects.
 */

export interface EnergyBalanceDay {
  date:                string
  intake:              number | null   // kcal logged
  burn:                number | null   // resting + MAX(active_energy, workout_calories)
  balance:             number | null   // intake − burn (null if either missing or partial)
  isPartial:           boolean         // resting energy < 500 kcal → incomplete day snapshot
  usedWorkoutFallback: boolean         // workout calories > health_metrics active energy → fallback used
}

export interface EnergyBalanceSummary {
  avgIntake:  number
  avgBurn:    number
  avgBalance: number
  status:     'Surplus' | 'Deficit' | 'Maintenance'
  sampleDays: number       // days where both intake and burn were present
}

export interface PatternInsight {
  key:  string
  text: string
}

// ── Build daily rows ──────────────────────────────────────────────────────────

export function computeEnergyBalanceDays(
  intakeByDate:               Record<string, number>,
  burnByDate:                 Record<string, number>,
  /** Sorted ascending, must NOT include today */
  dateRange:                  string[],
  isPartialByDate?:           Record<string, boolean>,
  usedWorkoutFallbackByDate?: Record<string, boolean>,
): EnergyBalanceDay[] {
  return dateRange.map(date => {
    const intake              = intakeByDate[date] ?? null
    const burn                = burnByDate[date]   ?? null
    const isPartial           = isPartialByDate?.[date]           ?? false
    const usedWorkoutFallback = usedWorkoutFallbackByDate?.[date] ?? false

    // Don't compute balance when burn data is a partial-day snapshot — the number
    // is misleading and would corrupt averages.
    const balance = !isPartial && intake != null && intake > 0 && burn != null && burn > 0
      ? Math.round(intake - burn)
      : null

    return {
      date,
      intake:              intake && intake > 0 ? Math.round(intake) : null,
      burn,
      balance,
      isPartial,
      usedWorkoutFallback,
    }
  }).reverse() // newest first for display
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function computeEnergyBalanceSummary(
  days:   EnergyBalanceDay[],
  window: 7 | 14 | 30,
): EnergyBalanceSummary | null {
  const slice = days.slice(0, window)

  // A "complete" day requires: intake logged + burn present + burn is not a
  // partial-day snapshot (resting energy < 500 kcal).
  // All three conditions must hold before a day contributes to any average.
  const complete = slice.filter(d =>
    !d.isPartial &&
    d.intake  != null && d.intake  > 0 &&
    d.burn    != null && d.burn    > 0
  )
  if (complete.length < 2) return null

  const avgIntake  = Math.round(complete.reduce((s, d) => s + d.intake!,  0) / complete.length)
  const avgBurn    = Math.round(complete.reduce((s, d) => s + d.burn!,    0) / complete.length)
  const avgBalance = Math.round(complete.reduce((s, d) => s + d.intake! - d.burn!, 0) / complete.length)

  const status: EnergyBalanceSummary['status'] =
    avgBalance >  150 ? 'Surplus'
    : avgBalance < -150 ? 'Deficit'
    : 'Maintenance'

  return { avgIntake, avgBurn, avgBalance, status, sampleDays: complete.length }
}

// ── Pattern insights ──────────────────────────────────────────────────────────

export function computePatternInsights(days: EnergyBalanceDay[]): PatternInsight[] {
  const insights: PatternInsight[] = []
  // Same "complete day" definition as computeEnergyBalanceSummary
  const complete = days.filter(d =>
    !d.isPartial &&
    d.intake != null && d.intake > 0 &&
    d.burn   != null && d.burn   > 0
  )
  if (complete.length < 3) return []

  // Streak: consecutive surplus days (balance > +100) at the top of the list (newest)
  let surplusStreak = 0
  for (const d of complete) {
    if (d.intake! - d.burn! > 100) surplusStreak++
    else break
  }
  if (surplusStreak >= 3) {
    insights.push({ key: 'surplus_streak', text: `${surplusStreak} surplus days in a row` })
  }

  // Streak: consecutive deficit days (balance < -100) at the top
  let deficitStreak = 0
  for (const d of complete) {
    if (d.intake! - d.burn! < -100) deficitStreak++
    else break
  }
  if (deficitStreak >= 3) {
    insights.push({ key: 'deficit_streak', text: `${deficitStreak} deficit days in a row` })
  }

  // Average surplus/deficit over all available days
  if (complete.length >= 5 && surplusStreak < 3 && deficitStreak < 3) {
    const avg = Math.round(complete.reduce((s, d) => s + d.intake! - d.burn!, 0) / complete.length)
    if (avg > 200) {
      insights.push({ key: 'avg_surplus', text: `Average surplus: +${avg} kcal / day` })
    } else if (avg < -200) {
      insights.push({ key: 'avg_deficit', text: `Average deficit: ${avg} kcal / day` })
    }
  }

  return insights
}
