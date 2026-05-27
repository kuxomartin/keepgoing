import { startOfWeek, format } from 'date-fns'
import type { Activity } from '@/types/database'

export interface WeeklyActivityTotal {
  weekStart: string // 'YYYY-MM-DD'
  totalDurationMinutes: number
  totalDistanceKm: number
  activityCount: number
  avgHr: number | null
}

/**
 * Groups activities by ISO week (starting Monday) and computes per-week totals.
 * Returns results sorted by weekStart ascending.
 */
export function weeklyActivityTotals(activities: Activity[]): WeeklyActivityTotal[] {
  const byWeek = new Map<string, WeeklyActivityTotal>()

  for (const a of activities) {
    const weekStart = format(
      startOfWeek(new Date(a.start_time), { weekStartsOn: 1 }),
      'yyyy-MM-dd'
    )

    if (!byWeek.has(weekStart)) {
      byWeek.set(weekStart, {
        weekStart,
        totalDurationMinutes: 0,
        totalDistanceKm: 0,
        activityCount: 0,
        avgHr: null,
      })
    }

    const week = byWeek.get(weekStart)!
    week.totalDurationMinutes += a.duration_minutes ?? 0
    week.totalDistanceKm += a.distance_km ?? 0
    week.activityCount += 1

    // Running mean for avg HR
    if (a.avg_hr != null) {
      week.avgHr =
        week.avgHr === null
          ? a.avg_hr
          : Math.round((week.avgHr + a.avg_hr) / 2)
    }
  }

  return Array.from(byWeek.values()).sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart)
  )
}

/**
 * Returns the 7-day average for a numeric field across health metrics.
 * Filters out null values before averaging.
 */
export function sevenDayAverage(
  values: (number | null)[],
  last: number = 7
): number | null {
  const valid = values.slice(-last).filter((v): v is number => v !== null)
  if (valid.length === 0) return null
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
}
