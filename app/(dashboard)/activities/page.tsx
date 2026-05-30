export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ActivityDurationChart } from '@/components/charts/activity-duration-chart'
import { weeklyActivityTotals } from '@/lib/calculations/weekly-totals'
import { mockActivities } from '@/lib/mock-data/demo-data'
import type { Activity } from '@/types/database'
import { ChevronRight, Bike, PersonStanding, Swords, CircleDot, Mountain, Dumbbell, Footprints } from 'lucide-react'
import { MetricInfo } from '@/components/ui/metric-info'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ride: <Bike className="h-4 w-4" />,
  run: <PersonStanding className="h-4 w-4" />,
  badminton: <Swords className="h-4 w-4" />,
  golf: <CircleDot className="h-4 w-4" />,
  hike: <Mountain className="h-4 w-4" />,
  gym: <Dumbbell className="h-4 w-4" />,
  walk: <Footprints className="h-4 w-4" />,
}

const TYPE_LABELS: Record<string, string> = {
  ride: 'Ride',
  run: 'Run',
  badminton: 'Badminton',
  golf: 'Golf',
  hike: 'Hike',
  gym: 'Gym',
  walk: 'Walk',
  other: 'Other',
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

  // Filter by type
  const filtered = typeFilter
    ? allActivities.filter((a) => a.activity_type === typeFilter)
    : allActivities

  // Get unique activity types for filter buttons
  const allTypes = [...new Set(allActivities.map((a) => a.activity_type))].sort()

  // Weekly totals for chart
  const weeklyTotals = weeklyActivityTotals(allActivities)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activities</h1>
        <p className="mt-1 text-sm text-gray-500">Your training sessions and movement history.</p>
        {isUsingMock && (
          <p className="mt-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-block">
            Showing demo data
          </p>
        )}
      </div>

      {/* Weekly chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-1.5">
            <CardTitle>Training volume by week</CardTitle>
            <MetricInfo slug="training-load" />
          </div>
        </CardHeader>
        <CardContent>
          <ActivityDurationChart data={weeklyTotals} />
        </CardContent>
      </Card>

      {/* Filter buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/activities"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!typeFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          All ({allActivities.length})
        </Link>
        {allTypes.map((type) => {
          const count = allActivities.filter((a) => a.activity_type === type).length
          return (
            <Link
              key={type}
              href={`/activities?type=${type}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${typeFilter === type ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {TYPE_LABELS[type] ?? type} ({count})
            </Link>
          )
        })}
      </div>

      {/* Activity list */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No activities found{typeFilter ? ` for type "${typeFilter}"` : ''}.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((activity) => (
                <li key={activity.id}>
                  <Link
                    href={`/activities/${activity.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                      {TYPE_ICONS[activity.activity_type] ?? <Mountain className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
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
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
