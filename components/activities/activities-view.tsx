'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  format, parseISO, addDays,
  startOfWeek, startOfYear, endOfYear, subYears,
} from 'date-fns'
import { ActivityFrequencyChart, type ChartPoint } from '@/components/charts/activity-frequency-chart'
import { LoadCalendarChart } from '@/components/charts/load-calendar-chart'
import type { Activity } from '@/types/database'
import { cn } from '@/lib/utils'

// ── Training load ─────────────────────────────────────────────────────────────
const SPORT_HR: Record<string, number> = {
  walk: 95, ride: 130, run: 150, badminton: 130, hike: 110, golf: 80, gym: 120,
}

function calcLoad(a: Activity): number {
  const hours = (a.duration_minutes ?? 0) / 60
  if (hours <= 0) return 0
  const hr = a.avg_hr != null && a.avg_hr > 50 && a.avg_hr < 230 ? a.avg_hr : null
  if (hr != null) return hours * hr
  return hours * (SPORT_HR[a.activity_type] ?? 110)
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACTIVITY_COLOR: Record<string, string> = {
  ride: '#FF7A00', run: '#E5173F', golf: '#D4B483',
  walk: '#888888', hike: '#FFB000', gym: '#E5173F',
  badminton: '#FFB000', other: '#888888',
}
const TYPE_LABELS: Record<string, string> = {
  ride: 'Ride', run: 'Run', badminton: 'Badminton', golf: 'Golf',
  hike: 'Hike', gym: 'Gym', walk: 'Walk', other: 'Other',
}

type Range = '2w' | '1m' | '1y' | 'prev1y'
type ChartMode = 'daily' | 'weekly'

// Order: Last month (default) · This year · Last year · Last 2 weeks
const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: '1m',     label: 'Last month'   },
  { key: '1y',     label: 'This year'    },
  { key: 'prev1y', label: 'Last year'    },
  { key: '2w',     label: 'Last 2 weeks' },
]

const CHART_SUBTITLE: Record<Range, string> = {
  '2w':     'Dot size = load. Color = next-day recovery.',
  '1m':     'Dot size = load. Color = next-day recovery.',
  '1y':     'Weekly load · this year',
  'prev1y': 'Weekly load · last year',
}

// ── Chart data builders ───────────────────────────────────────────────────────
function buildChartData(activities: Activity[], range: Range): { data: ChartPoint[]; mode: ChartMode } {
  const now = new Date()

  if (range === '2w' || range === '1m') {
    const days = range === '2w' ? 14 : 30
    const data: ChartPoint[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = format(new Date(now.getTime() - i * 86400000), 'yyyy-MM-dd')
      const inDay = activities.filter(a => a.start_time.slice(0, 10) === d)
      const load  = inDay.reduce((s, a) => s + calcLoad(a), 0)
      const totalMinutes = inDay.reduce((s, a) => s + (a.duration_minutes ?? 0), 0)
      data.push({ period: d, load, count: inDay.length, totalMinutes, label: format(parseISO(d), 'd MMM') })
    }
    return { data, mode: 'daily' }
  }

  const rangeStart = range === '1y' ? startOfYear(now) : startOfYear(subYears(now, 1))
  const rangeEndD  = range === '1y' ? now              : endOfYear(subYears(now, 1))

  const data: ChartPoint[] = []
  let wk = startOfWeek(rangeStart, { weekStartsOn: 1 })
  while (wk <= rangeEndD) {
    const ws = format(wk, 'yyyy-MM-dd')
    const we = format(addDays(wk, 7), 'yyyy-MM-dd')
    const inWk = activities.filter(a => {
      const d = a.start_time.slice(0, 10)
      return d >= ws && d < we
    })
    const load = inWk.reduce((s, a) => s + calcLoad(a), 0)
    const totalMinutes = inWk.reduce((s, a) => s + (a.duration_minutes ?? 0), 0)
    data.push({ period: ws, load, count: inWk.length, totalMinutes, label: format(wk, 'd MMM') })
    wk = addDays(wk, 7)
  }
  return { data, mode: 'weekly' }
}

// ── Range boundaries ──────────────────────────────────────────────────────────
function getRangeBounds(range: Range): { start: string; end: string } {
  const now = new Date()
  if (range === '2w')     return { start: format(new Date(now.getTime() - 14 * 86400000), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') }
  if (range === '1m')     return { start: format(new Date(now.getTime() - 30 * 86400000), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') }
  if (range === '1y')     return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') }
  if (range === 'prev1y') return { start: format(startOfYear(subYears(now, 1)), 'yyyy-MM-dd'), end: format(endOfYear(subYears(now, 1)), 'yyyy-MM-dd') }
  return { start: format(new Date(now.getTime() - 14 * 86400000), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') }
}

// ── Formatters ────────────────────────────────────────────────────────────────
function formatDuration(min: number | null): string {
  if (!min) return '—'
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function formatSpeed(distKm: number | null, minDur: number | null): string | null {
  if (!distKm || !minDur || minDur < 1) return null
  return `${(distKm / (minDur / 60)).toFixed(1)} km/h`
}
function getCardSummary(a: Activity): string {
  const dur = formatDuration(a.duration_minutes)
  const hr  = a.avg_hr    != null && a.avg_hr    < 230 ? a.avg_hr    : null
  const pwr = a.avg_power != null && a.avg_power < 600 ? a.avg_power : null
  const t   = a.activity_type
  if (t === 'ride') {
    if (a.duration_minutes != null && a.duration_minutes < 40 && (hr == null || hr < 130)) return 'Short recovery ride with low cardiovascular load.'
    if (hr != null && hr > 155) return 'Hard ride with elevated heart rate.'
    if (a.elevation_gain_m != null && a.elevation_gain_m > 800) return 'Long endurance ride with significant climbing.'
    if (pwr != null) return `Ride averaging ${pwr}W.`
    return `${a.distance_km ? a.distance_km.toFixed(0) + ' km ride' : 'Ride'} with moderate training load.`
  }
  if (t === 'walk')  return 'Low intensity walk.'
  if (t === 'hike')  return a.elevation_gain_m != null && a.elevation_gain_m > 100 ? `Hike with ${Math.round(a.elevation_gain_m)}m elevation.` : 'Hike session.'
  if (t === 'run')   return 'Run session with moderate cardiovascular load.'
  if (t === 'gym')   return 'Strength session.'
  return `${TYPE_LABELS[t] ?? t} · ${dur}`
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Stats {
  totalActivities: number
  totalHours:      number
  totalDist:       number
  thisWeekCount:   number
}

interface Props {
  allActivities:        Activity[]
  typeFilter?:          string
  weeklyGoal?:          number
  hrvByDate?:           Record<string, number>
  activeEnergyByDate?:  Record<string, number>
  stats:                Stats
  isUsingMock?:         boolean
}

export function ActivitiesView({
  allActivities,
  typeFilter,
  weeklyGoal = 3,
  hrvByDate = {},
  activeEnergyByDate = {},
  stats,
  isUsingMock,
}: Props) {
  const [selectedRange,  setSelectedRange]  = useState<Range>('1m')
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)

  const { data: chartData, mode: chartMode } = useMemo(
    () => buildChartData(allActivities, selectedRange),
    [allActivities, selectedRange]
  )

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => getRangeBounds(selectedRange),
    [selectedRange]
  )

  const activitiesInRange = useMemo(() =>
    allActivities.filter(a => {
      const d = a.start_time.slice(0, 10)
      return d >= rangeStart && d <= rangeEnd
    }),
  [allActivities, rangeStart, rangeEnd])

  const typeFiltered = useMemo(() =>
    typeFilter ? activitiesInRange.filter(a => a.activity_type === typeFilter) : activitiesInRange,
  [activitiesInRange, typeFilter])

  const displayed = useMemo(() => {
    if (!selectedPeriod) return typeFiltered
    if (chartMode === 'daily') {
      return typeFiltered.filter(a => a.start_time.slice(0, 10) === selectedPeriod)
    }
    const weekEndD = format(addDays(parseISO(selectedPeriod), 7), 'yyyy-MM-dd')
    return typeFiltered.filter(a => {
      const d = a.start_time.slice(0, 10)
      return d >= selectedPeriod && d < weekEndD
    })
  }, [typeFiltered, selectedPeriod, chartMode])

  const filterLabel = selectedPeriod
    ? chartMode === 'daily'
      ? `Showing activities from ${format(parseISO(selectedPeriod), 'd MMM')}`
      : `Showing activities from week of ${format(parseISO(selectedPeriod), 'd MMM')}`
    : null

  const onTarget = stats.thisWeekCount >= weeklyGoal

  return (
    <>
      {/* ── Two-column hero: summary (left) + range + calendar (right) ───── */}
      <div className="bg-[#20252B]">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-8">

          {/* Header row: label + range pills */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.15em]">
              Activities
              {isUsingMock && <span className="ml-3 text-[#FFB000]">demo data</span>}
            </p>
            <div className="flex items-center gap-0.5 flex-wrap justify-end">
              {RANGE_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setSelectedRange(key); setSelectedPeriod(null) }}
                  className={cn(
                    'px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors',
                    selectedRange === key
                      ? 'bg-white text-[#0D0D0D]'
                      : 'text-white/35 hover:text-white/70'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

            {/* ── LEFT: summary only ────────────────────────────────────── */}
            <div className="flex-shrink-0 lg:w-48 xl:w-56">
              <div className="space-y-3">
                <div>
                  <p className="font-mono font-bold text-white tabular-nums leading-none"
                     style={{ fontSize: '2.25rem' }}>
                    {stats.totalActivities}
                  </p>
                  <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mt-1">
                    Activities · 90d
                  </p>
                </div>
                <div>
                  <p className="font-mono font-bold text-white tabular-nums leading-none"
                     style={{ fontSize: '2.25rem' }}>
                    {stats.totalHours}h
                  </p>
                  <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mt-1">
                    Total time
                  </p>
                </div>
                {stats.totalDist > 0 && (
                  <div>
                    <p className="font-mono font-bold text-white tabular-nums leading-none"
                       style={{ fontSize: '2.25rem' }}>
                      {stats.totalDist} km
                    </p>
                    <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mt-1">
                      Distance
                    </p>
                  </div>
                )}
                <div>
                  <p className={cn(
                    'font-mono font-bold tabular-nums leading-none',
                    onTarget ? 'text-[#FF7A00]' : 'text-white'
                  )} style={{ fontSize: '2.25rem' }}>
                    {stats.thisWeekCount}
                    <span className="text-white/25 font-normal ml-1.5 text-xl">/ {weeklyGoal}</span>
                  </p>
                  <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mt-1">
                    {onTarget ? 'This week · on target' : `This week · goal ${weeklyGoal}/wk`}
                  </p>
                </div>
              </div>
            </div>

            {/* ── RIGHT: chart ──────────────────────────────────────────── */}
            <div className="flex-1 min-w-0">

              {/* Chart title */}
              <div className="mb-3">
                <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.12em]">
                  {chartMode === 'daily' ? 'Load Calendar' : 'Training Load'}
                </p>
                <p className="text-[11px] text-white/25 mt-0.5">
                  {CHART_SUBTITLE[selectedRange]}
                </p>
              </div>

              {chartMode === 'daily' ? (
                <LoadCalendarChart
                  data={chartData}
                  hrvByDate={hrvByDate}
                  activeEnergyByDate={activeEnergyByDate}
                  selectedPeriod={selectedPeriod}
                  onDotClick={(period) => setSelectedPeriod(prev => prev === period ? null : period)}
                />
              ) : (
                <ActivityFrequencyChart
                  data={chartData}
                  weeklyGoal={weeklyGoal}
                  isDaily={false}
                  selectedPeriod={selectedPeriod}
                  onBarClick={(period) => setSelectedPeriod(prev => prev === period ? null : period)}
                />
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Activity card grid ────────────────────────────────────────────── */}
      <div className="bg-[#20252B] border-t border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-8">

          {filterLabel && (
            <div className="flex items-center gap-3 mb-5">
              <span className="text-sm text-white/60">{filterLabel}</span>
              <button
                onClick={() => setSelectedPeriod(null)}
                className="text-xs text-[#E5173F] hover:text-white transition-colors"
              >
                Clear filter
              </button>
            </div>
          )}

          {displayed.length === 0 ? (
            <p className="text-white/30 text-sm py-6">No activities in this period.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayed.map(activity => {
                const color     = ACTIVITY_COLOR[activity.activity_type] ?? '#888888'
                const typeLabel = TYPE_LABELS[activity.activity_type] ?? activity.activity_type
                const speed     = formatSpeed(activity.distance_km, activity.duration_minutes)
                const date      = format(new Date(activity.start_time), 'EEE, d MMM · HH:mm')
                const summary   = getCardSummary(activity)
                const dispHr    = activity.avg_hr    != null && activity.avg_hr    < 230 ? activity.avg_hr    : null
                const dispPwr   = activity.avg_power != null && activity.avg_power < 600 ? activity.avg_power : null

                return (
                  <Link
                    key={activity.id}
                    href={`/activities/${activity.id}`}
                    className="group block bg-[#313943] border border-white/[0.06] hover:border-white/[0.15] transition-colors"
                  >
                    <div className="h-[3px]" style={{ background: color }} />
                    <div className="p-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color }}>
                        {typeLabel}
                      </p>
                      <p className="text-base font-bold text-white leading-snug mb-1 group-hover:text-white/90">
                        {activity.title}
                      </p>
                      <p className="text-[11px] text-white/30 mb-4">{date}</p>

                      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                        {activity.distance_km != null && (
                          <p className="text-sm font-semibold text-white font-mono tabular-nums">
                            {activity.distance_km.toFixed(1)} km
                          </p>
                        )}
                        {activity.duration_minutes != null && (
                          <p className="text-sm font-semibold text-white font-mono tabular-nums">
                            {formatDuration(activity.duration_minutes)}
                          </p>
                        )}
                        {speed    && <p className="text-sm text-white/50 font-mono tabular-nums">{speed}</p>}
                        {dispPwr != null && <p className="text-sm text-white/50 font-mono tabular-nums">{dispPwr}W</p>}
                        {dispHr  != null && <p className="text-sm text-white/50 font-mono tabular-nums">{dispHr} bpm</p>}
                        {activity.elevation_gain_m != null && activity.elevation_gain_m > 0 && (
                          <p className="text-sm text-white/40 font-mono tabular-nums">↑ {Math.round(activity.elevation_gain_m)}m</p>
                        )}
                      </div>

                      {activity.perceived_effort != null && (
                        <div className="flex items-center gap-2 mt-3">
                          <div className="h-0.5 flex-1 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(activity.perceived_effort / 10) * 100}%`,
                                background: activity.perceived_effort >= 8 ? '#E5173F'
                                  : activity.perceived_effort >= 5 ? '#FFB000' : '#888888',
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-white/25 flex-shrink-0">
                            {activity.perceived_effort}/10
                          </span>
                        </div>
                      )}

                      <p className="text-[11px] text-white/35 mt-3 leading-snug">{summary}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
