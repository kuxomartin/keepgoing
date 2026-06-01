export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { DifficultyCard } from '@/components/dashboard/difficulty-card'
import { explainActivityDifficulty } from '@/lib/insights/activity-difficulty'
import { mockActivities, mockHealthMetrics } from '@/lib/mock-data/demo-data'
import type { Activity, HealthMetrics } from '@/types/database'
import { ChevronLeft } from 'lucide-react'
import { MetricInfo } from '@/components/ui/metric-info'

function StatRow({ label, value, tooltipSlug }: { label: string; value: string | number | null; tooltipSlug?: string }) {
  if (value === null || value === undefined) return null
  return (
    <div className="flex justify-between py-3 border-b border-gray-100 dark:border-zinc-800 last:border-0">
      <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-400">
        {label}
        {tooltipSlug && <MetricInfo slug={tooltipSlug} />}
      </span>
      <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{value}</span>
    </div>
  )
}

function isStravaSource(source: string | null | undefined): boolean {
  if (!source) return false
  return source.toLowerCase().includes('strava')
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ActivityDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: activityRaw } = await supabase
    .from('activities')
    .select('*')
    .eq('id', id)
    .single()

  const activity: Activity | null =
    activityRaw
      ? (activityRaw as Activity)
      : (mockActivities.find((a) => a.id === id) ?? null)

  if (!activity) notFound()

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

  const stravaId = activity.external_id
  const showStravaLink = isStravaSource(activity.source) && stravaId

  return (
    <div className="space-y-6 max-w-2xl px-4 sm:px-6 py-6 lg:py-10">
      {/* Back link */}
      <Link
        href="/activities"
        className="inline-flex items-center gap-1 text-sm text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Activities
      </Link>

      {/* Title block */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-50 leading-snug">
            {activity.title}
          </h1>
          <Badge variant="blue" className="flex-shrink-0">
            {TYPE_LABELS[activity.activity_type] ?? activity.activity_type}
          </Badge>
        </div>
        <p className="mt-1.5 text-sm text-gray-400 dark:text-zinc-500">
          {format(new Date(activity.start_time), 'EEEE, d MMMM yyyy · HH:mm')}
        </p>
        {/* Strava deep-link */}
        {showStravaLink && (
          <a
            href={`https://www.strava.com/activities/${stravaId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-sm text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
          >
            Open in Strava →
          </a>
        )}
      </div>

      {/* Stats — borderless section */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
          Session stats
        </p>
        <StatRow label="Duration"       value={formatDuration(activity.duration_minutes)}                          tooltipSlug="duration" />
        <StatRow label="Distance"       value={activity.distance_km ? `${activity.distance_km.toFixed(2)} km` : null} tooltipSlug="distance" />
        <StatRow label="Elevation"      value={activity.elevation_gain_m ? `${activity.elevation_gain_m} m` : null}   tooltipSlug="elevation-gain" />
        <StatRow label="Avg heart rate" value={activity.avg_hr ? `${activity.avg_hr} bpm` : null}                     tooltipSlug="heart-rate" />
        <StatRow label="Max heart rate" value={activity.max_hr ? `${activity.max_hr} bpm` : null}                     tooltipSlug="heart-rate" />
        <StatRow label="Avg power"      value={activity.avg_power ? `${activity.avg_power} W` : null}                 tooltipSlug="average-power" />
        <StatRow label="Calories"       value={activity.calories ? `${activity.calories} kcal` : null} />
        <StatRow label="Perceived effort" value={activity.perceived_effort ? `${activity.perceived_effort}/10` : null} />
      </div>

      {/* Conditions */}
      {(activity.weather_temp_c !== null || activity.weather_wind_kph !== null) && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
            Conditions
          </p>
          <StatRow label="Temperature" value={activity.weather_temp_c !== null ? `${activity.weather_temp_c}°C` : null} />
          <StatRow label="Wind"        value={activity.weather_wind_kph !== null ? `${activity.weather_wind_kph} km/h` : null} />
        </div>
      )}

      {/* Difficulty analysis */}
      <DifficultyCard explanation={explanation} />

      {/* Notes */}
      {activity.difficulty_note && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Notes</p>
          <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">{activity.difficulty_note}</p>
        </div>
      )}
    </div>
  )
}
