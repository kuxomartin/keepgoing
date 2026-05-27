import type { Activity, HealthMetrics } from '@/types/database'

export interface DifficultyExplanation {
  reasons: string[]
  summary: string
}

/**
 * Rule-based explanation of why an activity may have felt hard.
 *
 * Rules checked:
 * 1. Sleep < 6h the night before the activity
 * 2. Resting HR on activity day > 7-day average + 5 bpm
 * 3. Temperature > 25°C
 * 4. Wind > 30 km/h
 * 5. High perceived effort (≥8) with moderate avg HR (<140) → possible mental/muscular fatigue
 *
 * @param activity - The activity to explain
 * @param recentMetrics - Up to 7 days of health metrics (should include activity date + days before)
 */
export function explainActivityDifficulty(
  activity: Activity,
  recentMetrics: HealthMetrics[]
): DifficultyExplanation {
  const reasons: string[] = []
  const activityDate = activity.start_time.slice(0, 10)

  // 1. Sleep the night before
  const metricsBeforeActivity = recentMetrics
    .filter((m) => m.date < activityDate)
    .sort((a, b) => b.date.localeCompare(a.date))

  const nightBefore = metricsBeforeActivity[0]
  if (nightBefore?.sleep_minutes != null) {
    const hours = nightBefore.sleep_minutes / 60
    if (hours < 6) {
      reasons.push(
        `Slept only ${hours.toFixed(1)}h the night before (${nightBefore.date})`
      )
    }
  }

  // 2. Elevated resting HR vs 7-day average
  const hrValues = recentMetrics
    .filter((m) => m.resting_hr != null && m.date <= activityDate)
    .map((m) => m.resting_hr as number)

  if (hrValues.length >= 3) {
    const avg7d = hrValues.reduce((a, b) => a + b, 0) / hrValues.length
    const todayMetrics = recentMetrics.find((m) => m.date === activityDate)
    if (todayMetrics?.resting_hr != null && todayMetrics.resting_hr > avg7d + 5) {
      reasons.push(
        `Resting HR ${todayMetrics.resting_hr} bpm — ${Math.round(todayMetrics.resting_hr - avg7d)} bpm above 7-day avg (${Math.round(avg7d)} bpm)`
      )
    }
  }

  // 3. Heat
  if (activity.weather_temp_c != null && activity.weather_temp_c > 25) {
    reasons.push(`Hot conditions — ${activity.weather_temp_c}°C`)
  }

  // 4. Wind
  if (activity.weather_wind_kph != null && activity.weather_wind_kph > 30) {
    reasons.push(`Strong wind — ${activity.weather_wind_kph} km/h`)
  }

  // 5. High perceived effort + moderate HR (subjective/muscular fatigue)
  if (
    activity.perceived_effort != null &&
    activity.perceived_effort >= 8 &&
    activity.avg_hr != null &&
    activity.avg_hr < 140
  ) {
    reasons.push(
      `High perceived effort (${activity.perceived_effort}/10) despite moderate avg HR (${activity.avg_hr} bpm) — possible mental or muscular fatigue, or fueling issue`
    )
  }

  const summary =
    reasons.length === 0
      ? 'No obvious external stress factors identified for this session.'
      : `${reasons.length} factor${reasons.length > 1 ? 's' : ''} may have contributed to how this session felt.`

  return { reasons, summary }
}
