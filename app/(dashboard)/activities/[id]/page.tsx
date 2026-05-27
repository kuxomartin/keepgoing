export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DifficultyCard } from '@/components/dashboard/difficulty-card'
import { explainActivityDifficulty } from '@/lib/insights/activity-difficulty'
import { mockActivities, mockHealthMetrics } from '@/lib/mock-data/demo-data'
import type { Activity, HealthMetrics } from '@/types/database'
import { ChevronLeft } from 'lucide-react'

function StatRow({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === undefined) return null
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  )
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ActivityDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Try DB first
  const { data: activityRaw } = await supabase
    .from('activities')
    .select('*')
    .eq('id', id)
    .single()

  // Fall back to mock
  const activity: Activity | null =
    activityRaw
      ? (activityRaw as Activity)
      : (mockActivities.find((a) => a.id === id) ?? null)

  if (!activity) notFound()

  // Fetch recent health metrics for difficulty analysis
  const activityDate = activity.start_time.slice(0, 10)
  const sevenDaysBack = format(
    new Date(new Date(activityDate).getTime() - 7 * 86400000),
    'yyyy-MM-dd'
  )

  const { data: metricsRaw } = await supabase
    .from('health_metrics')
    .select('*')
    .gte('date', sevenDaysBack)
    .lte('date', activityDate)

  const recentMetrics: HealthMetrics[] =
    metricsRaw && metricsRaw.length > 0
      ? (metricsRaw as HealthMetrics[])
      : mockHealthMetrics.filter((m) => m.date >= sevenDaysBack && m.date <= activityDate)

  const explanation = explainActivityDifficulty(activity, recentMetrics)

  function formatDuration(min: number | null) {
    if (!min) return '—'
    const h = Math.floor(min / 60)
    const m = Math.round(min % 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const TYPE_LABELS: Record<string, string> = {
    ride: 'Bike Ride', run: 'Run', badminton: 'Badminton',
    golf: 'Golf', hike: 'Hike', gym: 'Strength', walk: 'Walk',
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/activities"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Activities
        </Link>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-gray-900">{activity.title}</h1>
          <Badge variant="blue">{TYPE_LABELS[activity.activity_type] ?? activity.activity_type}</Badge>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {format(new Date(activity.start_time), 'EEEE, d MMMM yyyy · HH:mm')}
        </p>
      </div>

      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Session stats</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <StatRow label="Duration" value={formatDuration(activity.duration_minutes)} />
          <StatRow label="Distance" value={activity.distance_km ? `${activity.distance_km.toFixed(2)} km` : null} />
          <StatRow label="Elevation" value={activity.elevation_gain_m ? `${activity.elevation_gain_m} m` : null} />
          <StatRow label="Avg heart rate" value={activity.avg_hr ? `${activity.avg_hr} bpm` : null} />
          <StatRow label="Max heart rate" value={activity.max_hr ? `${activity.max_hr} bpm` : null} />
          <StatRow label="Avg power" value={activity.avg_power ? `${activity.avg_power} W` : null} />
          <StatRow label="Calories" value={activity.calories ? `${activity.calories} kcal` : null} />
          <StatRow label="Perceived effort" value={activity.perceived_effort ? `${activity.perceived_effort}/10` : null} />
        </CardContent>
      </Card>

      {/* Conditions */}
      {(activity.weather_temp_c !== null || activity.weather_wind_kph !== null) && (
        <Card>
          <CardHeader>
            <CardTitle>Conditions</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <StatRow label="Temperature" value={activity.weather_temp_c !== null ? `${activity.weather_temp_c}°C` : null} />
            <StatRow label="Wind" value={activity.weather_wind_kph !== null ? `${activity.weather_wind_kph} km/h` : null} />
          </CardContent>
        </Card>
      )}

      {/* Difficulty analysis */}
      <DifficultyCard explanation={explanation} />

      {/* Notes */}
      {activity.difficulty_note && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">{activity.difficulty_note}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
