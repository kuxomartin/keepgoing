export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format, startOfWeek, endOfWeek, isThisWeek, subWeeks, isSameWeek } from 'date-fns'
import { ActivityDurationChart } from '@/components/charts/activity-duration-chart'
import { weeklyActivityTotals } from '@/lib/calculations/weekly-totals'
import { mockActivities } from '@/lib/mock-data/demo-data'
import type { Activity } from '@/types/database'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<string, string> = {
  ride: 'Bike Ride', run: 'Run', badminton: 'Badminton', golf: 'Golf',
  hike: 'Hike', gym: 'Strength', walk: 'Walk', other: 'Other',
}

function formatDuration(min: number | null): string {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Group activities by week label
function groupByWeek(activities: Activity[]): { label: string; activities: Activity[] }[] {
  const groups: Record<string, Activity[]> = {}
  for (const a of activities) {
    const date = new Date(a.start_time)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 })
    const key = format(weekStart, 'yyyy-MM-dd')
    if (!groups[key]) groups[key] = []
    groups[key].push(a)
  }

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a)) // most recent first
    .map(([key, acts]) => {
      const weekStart = new Date(key + 'T12:00:00')
      const acts0 = acts[0]
      const lastWeekStart = subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1)
      const label = isThisWeek(weekStart, { weekStartsOn: 1 })
        ? 'This week'
        : isSameWeek(weekStart, lastWeekStart, { weekStartsOn: 1 })
          ? 'Last week'
          : format(weekStart, 'd MMM') + ' – ' + format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'd MMM')
      return { label, activities: acts.sort((a, b) => b.start_time.localeCompare(a.start_time)) }
    })
}

// Surface for each week group — alternates
const WEEK_SURFACES = ['bg-white dark:bg-zinc-950', 'bg-[#F2EDE6] dark:bg-zinc-900', 'bg-[#EDEDEB] dark:bg-zinc-900/80']

interface PageProps { searchParams: Promise<{ type?: string }> }

export default async function ActivitiesPage({ searchParams }: PageProps) {
  const { type: typeFilter } = await searchParams
  const supabase = await createClient()

  const { data: rawActivities } = await supabase
    .from('activities').select('*').order('start_time', { ascending: false }).limit(100)

  const allActivities: Activity[] =
    rawActivities && rawActivities.length > 0 ? (rawActivities as Activity[]) : mockActivities

  const isUsingMock = !rawActivities || rawActivities.length === 0

  const filtered = typeFilter ? allActivities.filter(a => a.activity_type === typeFilter) : allActivities
  const allTypes = [...new Set(allActivities.map(a => a.activity_type))].sort()
  const weeklyTotals = weeklyActivityTotals(allActivities)
  const weekGroups = groupByWeek(filtered)

  return (
    <div className="flex flex-col">

      {/* ── Training load wave — no container ─────────────────────────── */}
      <div className="px-6 sm:px-10 lg:px-14 pt-10 pb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Training load · weekly</p>
          {isUsingMock && (
            <span className="text-[10px] text-[#D97706] uppercase tracking-widest">demo data</span>
          )}
        </div>
        {/* Full-bleed chart — no border, no card */}
        <div className="-mx-6 sm:-mx-10 lg:-mx-14">
          <ActivityDurationChart data={weeklyTotals} />
        </div>
      </div>

      {/* ── Type filter pills ──────────────────────────────────────────── */}
      <div className="px-6 sm:px-10 lg:px-14 py-4 border-b border-[#D9D9D9] dark:border-zinc-800">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/activities"
            className={cn(
              'text-sm font-medium transition-colors',
              !typeFilter ? 'text-[#0D0D0D] dark:text-zinc-50 font-semibold' : 'text-[#888888] hover:text-[#0D0D0D] dark:hover:text-zinc-100'
            )}
          >
            All
          </Link>
          {allTypes.map(type => (
            <Link
              key={type}
              href={`/activities?type=${type}`}
              className={cn(
                'text-sm font-medium transition-colors capitalize',
                typeFilter === type ? 'text-[#0D0D0D] dark:text-zinc-50 font-semibold' : 'text-[#888888] hover:text-[#0D0D0D] dark:hover:text-zinc-100'
              )}
            >
              {TYPE_LABELS[type] ?? type}
            </Link>
          ))}
          <div className="ml-auto">
            <Link
              href="/activities/add"
              className="text-sm font-medium text-[#888888] hover:text-[#0D0D0D] dark:hover:text-zinc-100 transition-colors"
            >
              + Add manually
            </Link>
          </div>
        </div>
      </div>

      {/* ── Activity feed — week groups with alternating surfaces ─────── */}
      {weekGroups.length === 0 ? (
        <div className="px-6 sm:px-10 lg:px-14 py-16 text-center">
          <p className="text-[#888888]">No activities found.</p>
        </div>
      ) : (
        weekGroups.map((group, gi) => (
          <div key={group.label} className={WEEK_SURFACES[gi % WEEK_SURFACES.length]}>

            {/* Week label */}
            <div className="px-6 sm:px-10 lg:px-14 pt-8 pb-3">
              <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em]">
                {group.label}
              </p>
            </div>

            {/* Activities in this week */}
            <div>
              {group.activities.map((activity, ai) => (
                <div key={activity.id}>
                  {ai > 0 && <div className="mx-6 sm:mx-10 lg:mx-14 border-t border-[#D9D9D9]/60 dark:border-zinc-800" />}
                  <Link
                    href={`/activities/${activity.id}`}
                    className="flex items-start justify-between px-6 sm:px-10 lg:px-14 py-5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      {/* Date */}
                      <p className="text-[10px] font-semibold text-[#888888] uppercase tracking-[0.1em] mb-1">
                        {format(new Date(activity.start_time), 'EEE, d MMM · HH:mm')}
                      </p>
                      {/* Title — dominant */}
                      <p className="text-lg font-bold text-[#0D0D0D] dark:text-zinc-50 leading-tight mb-1.5">
                        {activity.title}
                      </p>
                      {/* Stats */}
                      <p className="text-sm text-[#888888]">
                        {formatDuration(activity.duration_minutes)}
                        {activity.distance_km ? ` · ${activity.distance_km.toFixed(1)} km` : ''}
                        {activity.avg_hr ? ` · avg ${activity.avg_hr} bpm` : ''}
                        {activity.activity_type && ` · ${TYPE_LABELS[activity.activity_type] ?? activity.activity_type}`}
                      </p>

                      {/* Effort bar */}
                      {activity.perceived_effort != null && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="h-0.5 w-24 bg-[#D9D9D9] dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                activity.perceived_effort >= 8 ? 'bg-[#E5173F]' :
                                activity.perceived_effort >= 5 ? 'bg-[#D97706]' : 'bg-[#16A34A]'
                              )}
                              style={{ width: `${(activity.perceived_effort / 10) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-[#888888]">{activity.perceived_effort}/10</span>
                        </div>
                      )}
                    </div>

                    {/* Chevron — appears on hover only */}
                    <span className="text-[#888888] opacity-0 group-hover:opacity-100 transition-opacity ml-4 mt-1 flex-shrink-0">›</span>
                  </Link>
                </div>
              ))}
            </div>

            {/* Bottom padding for each group */}
            <div className="pb-4" />
          </div>
        ))
      )}

    </div>
  )
}
