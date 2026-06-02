export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, startOfWeek, subDays } from 'date-fns'
import { mockActivities } from '@/lib/mock-data/demo-data'
import type { Activity } from '@/types/database'
import { ActivitiesView } from '@/components/activities/activities-view'

const WEEKLY_GOAL = 3

interface PageProps { searchParams: Promise<{ type?: string }> }

export default async function ActivitiesPage({ searchParams }: PageProps) {
  const { type: typeFilter } = await searchParams
  const supabase = await createClient()

  // 400-day window covers This year + Last year + next-day HRV lookups
  const date400ago = format(subDays(new Date(), 400), 'yyyy-MM-dd')
  const today      = format(new Date(), 'yyyy-MM-dd')

  const [{ data: rawActivities }, { data: healthRaw }] = await Promise.all([
    supabase.from('activities').select('*').order('start_time', { ascending: false }).limit(500),
    // No source filter — accept google_sheets, apple_health, and any future source.
    // When multiple rows exist for the same date (multiple sources), we take the
    // first non-null value per field via the loop below.
    supabase.from('health_metrics')
      .select('date, hrv_ms, active_energy_kcal')
      .gte('date', date400ago)
      .lte('date', today)
      .order('date', { ascending: true })
      .order('source', { ascending: true }),
  ])

  const allActivities: Activity[] =
    rawActivities && rawActivities.length > 0 ? (rawActivities as Activity[]) : mockActivities
  const isUsingMock = !rawActivities || rawActivities.length === 0

  // ── Source deduplication (UI-level, rows kept in DB) ─────────────────────
  // strava_google_sheets is canonical. Hide apple_health_workout rows that
  // represent the same physical workout:
  //   • same calendar date
  //   • duration within ±15 min
  //   • distance within ±10% (when both > 0)
  //
  // Strava GS rows use midnight UTC as start_time (date-only import), so we
  // compare on date string, not on timestamp proximity.
  const stravaRows = allActivities.filter(a => a.source === 'strava_google_sheets')

  const activities: Activity[] = allActivities.filter(a => {
    if (a.source !== 'apple_health_workout') return true
    const ahDate = a.start_time.slice(0, 10)
    const ahDur  = a.duration_minutes ?? 0
    const ahDist = a.distance_km     ?? 0
    return !stravaRows.some(s => {
      if (s.start_time.slice(0, 10) !== ahDate) return false
      if (Math.abs(ahDur - (s.duration_minutes ?? 0)) > 15) return false
      const sDist = s.distance_km ?? 0
      if (ahDist > 0.5 && sDist > 0.5) {
        if (Math.abs(ahDist - sDist) / Math.max(ahDist, sDist) > 0.10) return false
      }
      return true
    })
  })

  type HealthRow = { date: string; hrv_ms?: number | string | null; active_energy_kcal?: number | null }

  const hrvByDate: Record<string, number> = {}
  const activeEnergyByDate: Record<string, number> = {}
  for (const m of (healthRaw ?? []) as HealthRow[]) {
    if (m.hrv_ms != null && !hrvByDate[m.date])
      hrvByDate[m.date] = Number(m.hrv_ms)
    if (m.active_energy_kcal != null && m.active_energy_kcal > 0 && !activeEnergyByDate[m.date])
      activeEnergyByDate[m.date] = m.active_energy_kcal
  }

  // Stats — always 90-day window (use deduplicated list)
  const ninetyDaysAgo = format(new Date(Date.now() - 90 * 86400000), 'yyyy-MM-dd')
  const recent90      = activities.filter(a => a.start_time >= ninetyDaysAgo + 'T00:00:00')
  const totalActivities = recent90.length
  const totalHours    = Math.round(recent90.reduce((s, a) => s + (a.duration_minutes ?? 0), 0) / 60 * 10) / 10
  const totalDist     = Math.round(recent90.reduce((s, a) => s + (a.distance_km ?? 0), 0))
  const thisWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const thisWeekCount = activities.filter(a => a.start_time >= thisWeekStart + 'T00:00:00').length

  return (
    <div className="flex flex-col">
      <ActivitiesView
        allActivities={activities}
        typeFilter={typeFilter}
        weeklyGoal={WEEKLY_GOAL}
        hrvByDate={hrvByDate}
        activeEnergyByDate={activeEnergyByDate}
        stats={{ totalActivities, totalHours, totalDist, thisWeekCount }}
        isUsingMock={isUsingMock}
      />
    </div>
  )
}
