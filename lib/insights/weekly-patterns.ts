import type { Activity, HealthMetrics, WeightLog, FoodLog } from '@/types/database'

export interface WeeklyPatterns {
  bestSleepDay: string | null // 'YYYY-MM-DD'
  bestSleepHours: number | null
  hardestActivity: Activity | null
  weightChange: number | null // kg
  foodLogDays: number
  totalTrainingMinutes: number
  totalActivities: number
  avgSleepHours: number | null
  avgHrv: number | null
  avgRestingHr: number | null
}

/**
 * Analyzes a set of data (typically one week) and returns pattern insights.
 */
export function analyzeWeeklyPatterns(
  activities: Activity[],
  metrics: HealthMetrics[],
  weights: WeightLog[],
  foods: FoodLog[]
): WeeklyPatterns {
  // Best sleep day
  const metricsWithSleep = metrics.filter((m) => m.sleep_minutes != null)
  const bestSleepMetric =
    metricsWithSleep.length > 0
      ? metricsWithSleep.reduce((best, m) =>
          (m.sleep_minutes ?? 0) > (best.sleep_minutes ?? 0) ? m : best
        )
      : null

  // Hardest activity (by perceived effort, then duration)
  const activitiesWithEffort = activities.filter((a) => a.perceived_effort != null)
  const hardest =
    activitiesWithEffort.length > 0
      ? activitiesWithEffort.reduce((h, a) =>
          (a.perceived_effort ?? 0) > (h.perceived_effort ?? 0)
            ? a
            : (a.perceived_effort ?? 0) === (h.perceived_effort ?? 0) &&
                (a.duration_minutes ?? 0) > (h.duration_minutes ?? 0)
              ? a
              : h
        )
      : activities.length > 0
        ? activities.reduce((h, a) =>
            (a.duration_minutes ?? 0) > (h.duration_minutes ?? 0) ? a : h
          )
        : null

  // Weight change (first vs last within the period)
  const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  const weightChange =
    sortedWeights.length >= 2
      ? Math.round(
          (sortedWeights[sortedWeights.length - 1].weight_kg - sortedWeights[0].weight_kg) * 10
        ) / 10
      : null

  // Food days
  const foodDays = new Set(foods.map((f) => f.date)).size

  // Training totals
  const totalTrainingMinutes = activities.reduce(
    (sum, a) => sum + (a.duration_minutes ?? 0),
    0
  )

  // Averages
  const sleepValues = metricsWithSleep.map((m) => (m.sleep_minutes ?? 0) / 60)
  const avgSleepHours =
    sleepValues.length > 0
      ? Math.round((sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length) * 10) / 10
      : null

  const hrvValues = metrics.filter((m) => m.hrv_ms != null).map((m) => m.hrv_ms as number)
  const avgHrv =
    hrvValues.length > 0
      ? Math.round(hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length)
      : null

  const hrValues = metrics.filter((m) => m.resting_hr != null).map((m) => m.resting_hr as number)
  const avgRestingHr =
    hrValues.length > 0
      ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length)
      : null

  return {
    bestSleepDay: bestSleepMetric?.date ?? null,
    bestSleepHours: bestSleepMetric ? Math.round(((bestSleepMetric.sleep_minutes ?? 0) / 60) * 10) / 10 : null,
    hardestActivity: hardest ?? null,
    weightChange,
    foodLogDays: foodDays,
    totalTrainingMinutes: Math.round(totalTrainingMinutes),
    totalActivities: activities.length,
    avgSleepHours,
    avgHrv,
    avgRestingHr,
  }
}
