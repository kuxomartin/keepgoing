export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { ActivityDurationChart } from '@/components/charts/activity-duration-chart'
import { weeklyActivityTotals } from '@/lib/calculations/weekly-totals'
import { mockActivities } from '@/lib/mock-data/demo-data'
import type { Activity } from '@/types/database'
import { Bike, PersonStanding, Swords, CircleDot, Mountain, Dumbbell, Footprints } from 'lucide-react'
import { MetricInfo } from '@/components/ui/metric-info'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ride:      <Bike className="h-4 w-4" />,
  run:       <PersonStanding className="h-4 w-4" />,
  badminton: <Swords className="h-4 w-4" />,
  golf:      <CircleDot className="h-4 w-4" />,
  hike:      <Mountain className="h-4 w-4" />,
  gym:       <Dumbbell className="h-4 w-4" />,
  walk:      <Footprints className="h-4 w-4" />,
}

const TYPE_LABELS: Record<string, string> = {
  ride: 'Ride', run: 'Run', badminton: 'Badminton', golf: 'Golf',
  hike: 'Hike', gym: 'Gym', walk: 'Walk', other: 'Other',
}

const EFFORT_COLORS: Record<number, 'green' | 'yellow' | 'red' | 'default'> = {
  1: 'green', 2: 'green', 3: 'green', 4: 'green',
  5: 'yellow', 6: 'yellow', 7: 'yellow',
  8: 'red', 9: 'red', 10: 'red',
}

function formatDuration(min: number | null) {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

interface PageProps {
  searchParams: Promise<{ type?: string }>
}

export default async function ActivitiesPage({ searchParams }: PageProps) {
  const { type: typeFilter } = await searchParams
  const supabase = await createClient()

  const { data: rawActivities } = await supabase
    .from('activities')
    .select('*')
    .order('start_time', { ascending: false })
    .limit(100)

  const allActivities: Activity[] =
    rawActivities && rawActivities.length > 0
      ? (rawActivities as Activity[])
      : mockActivities

  const isUsingMock = !rawActivities || rawActivities.length === 0

  const filtered = typeFilter
    ? allActivities.filter((a) => a.activity_type === typeFilter)
    : allActivities

  const allTypes = [...new Set(allActivities.map((a) => a.activity_type))].sort()
  const weeklyTotals = weeklyActivityTotals(allActivities)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Activities</p>
          {isUsingMock && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-3 py-1.5 inline-block">
              Showing demo data
            </p>
          )}
        </div>
        <Link
          href="/activities/add"
          className="flex-shrink-0 px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-gray-600 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-zinc-600 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors whitespace-nowrap"
        >
          + Add Manually
        </Link>
      </div>

      {/* ── Training volume chart — no card border ─────────────────────────── */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Training volume</span>
          <span className="text-xs text-gray-400 dark:text-zinc-500">per week</span>
          <MetricInfo slug="training-load" />
        </div>
        <ActivityDurationChart data={weeklyTotals} />
      </div>

      {/* ── Type filter pills ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/activities"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !typeFilter
              ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
              : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
          }`}
        >
          All ({allActivities.length})
        </Link>
        {allTypes.map((type) => {
          const count = allActivities.filter((a) => a.activity_type === type).length
          return (
            <Link
              key={type}
              href={`/activities?type=${type}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                typeFilter === type
                  ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
              }`}
            >
              {TYPE_LABELS[type] ?? type} ({count})
            </Link>
          )
        })}
      </div>

      {/* ── Activity feed — no card wrapper ────────────────────────────────── */}
      <div className="border-t border-gray-100 dark:border-zinc-800">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-zinc-500">
            No activities found{typeFilter ? ` for type "${typeFilter}"` : ''}.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
            {filtered.map((activity) => (
              <li key={activity.id}>
                <Link
                  href={`/activities/${activity.id}`}
                  className="flex items-center gap-4 py-4 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors group"
                >
                  {/* Type icon — neutral, not blue */}
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-gray-400 dark:text-zinc-500">
                    {TYPE_ICONS[activity.activity_type] ?? <Mountain className="h-4 w-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">{activity.title}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                      {format(new Date(activity.start_time), 'EEE d MMM, HH:mm')}
                      {' · '}
                      {formatDuration(activity.duration_minutes)}
                      {activity.distance_km ? ` · ${activity.distance_km.toFixed(1)} km` : ''}
                      {activity.avg_hr ? ` · ♥ ${activity.avg_hr} bpm` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {activity.perceived_effort && (
                      <Badge variant={EFFORT_COLORS[activity.perceived_effort] ?? 'default'}>
                        {activity.perceived_effort}/10
                      </Badge>
                    )}
                    {/* Subtle chevron — visible only on hover */}
                    <span className="text-gray-200 dark:text-zinc-700 group-hover:text-gray-400 dark:group-hover:text-zinc-500 transition-colors text-sm">›</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
