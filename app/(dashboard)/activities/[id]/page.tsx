export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { explainActivityDifficulty } from '@/lib/insights/activity-difficulty'
import { mockActivities, mockHealthMetrics } from '@/lib/mock-data/demo-data'
import type { Activity, HealthMetrics } from '@/types/database'
import { ChevronLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { MetricInfo } from '@/components/ui/metric-info'

// ── Activity accent colors ────────────────────────────────────────────────────
const ACTIVITY_COLOR: Record<string, string> = {
  ride: '#FF7A00', run: '#E5173F', golf: '#D4B483',
  walk: '#888888', hike: '#FFB000', gym: '#E5173F',
  badminton: '#FFB000', other: '#888888',
}
const TYPE_LABELS: Record<string, string> = {
  ride: 'Bike Ride', run: 'Run', badminton: 'Badminton',
  golf: 'Golf', hike: 'Hike', gym: 'Gym', walk: 'Walk', other: 'Other',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(min: number | null): string {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ── Session summary (rule-based) ──────────────────────────────────────────────
function getSessionSummary(a: Activity, hr: number | null, pwr: number | null): string {
  const dist = a.distance_km
  const dur  = a.duration_minutes
  const elev = a.elevation_gain_m
  const type = a.activity_type

  const distStr = dist ? `${dist.toFixed(0)} km` : null
  const durStr  = fmt(dur)

  if (type === 'ride') {
    if (dur != null && dur < 40 && (hr == null || hr < 130))
      return 'Short recovery ride intended to maintain activity with low cardiovascular stress.'
    if (hr != null && hr > 155)
      return `${distStr ? distStr + ' ' : ''}endurance ride with elevated heart rate and high cardiovascular load.`
    if (elev != null && elev > 800 && dist != null)
      return `${distStr} endurance ride with substantial climbing and steady effort across ${durStr}.`
    if (pwr != null && pwr > 200)
      return `${distStr ? distStr + ' ' : ''}ride with strong average power output across ${durStr}.`
    return `${distStr ? distStr + ' ' : ''}ride with moderate training load across ${durStr}.`
  }
  if (type === 'walk')
    return 'Low intensity walk with light cardiovascular load and minimal training stress.'
  if (type === 'hike')
    return elev != null && elev > 300
      ? `Hike covering ${distStr ?? durStr} with ${Math.round(elev)}m of elevation gain.`
      : `Hike session covering ${distStr ?? durStr} at a comfortable pace.`
  if (type === 'run')
    return `Run session covering ${distStr ?? durStr} with moderate cardiovascular load.`
  if (type === 'gym')
    return 'Gym session focused on strength and conditioning work.'
  return `${TYPE_LABELS[type] ?? type} session lasting ${durStr}.`
}

// ── Training signal (rule-based classification) ───────────────────────────────
function getTrainingSignal(a: Activity, hr: number | null, pwr: number | null): {
  label: string; explanation: string
} {
  const dur  = a.duration_minutes
  const dist = a.distance_km
  const elev = a.elevation_gain_m

  if (dur != null && dur < 40 && (hr == null || hr < 130)) {
    return { label: 'Recovery session', explanation: 'Short duration and low cardiovascular load suggest a recovery-level effort.' }
  }
  if ((hr != null && hr > 160) || (pwr != null && pwr > 250)) {
    return { label: 'High intensity session', explanation: 'Elevated heart rate or power output indicates sustained high-effort work.' }
  }
  if (elev != null && dist != null && dist > 0 && elev / dist > 15 && elev > 800) {
    return { label: 'Climbing-focused session', explanation: 'High elevation gain relative to distance indicates a climbing-heavy effort.' }
  }
  if ((dist != null && dist > 60) || (dur != null && dur > 100)) {
    return { label: 'Endurance session', explanation: 'Long duration or distance indicates a sustained aerobic effort.' }
  }
  return { label: 'Short maintenance session', explanation: 'Moderate effort at manageable intensity.' }
}

// ── Comparison against recent activities ─────────────────────────────────────
interface Comparison { label: string; pct: number }

function avgField(arr: Activity[], key: 'distance_km' | 'duration_minutes' | 'elevation_gain_m'): number | null {
  const vals = arr.map(x => x[key]).filter((v): v is number => v != null)
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
}

function buildComparisons(a: Activity, recent: Activity[]): Comparison[] {
  if (!recent.length) return []
  const same = recent.filter(r => r.id !== a.id && r.activity_type === a.activity_type)
  if (same.length < 2) return []

  const result: Comparison[] = []
  const avgDist = avgField(same, 'distance_km')
  const avgDur  = avgField(same, 'duration_minutes')
  const avgElev = avgField(same, 'elevation_gain_m')

  if (a.distance_km != null && avgDist != null && avgDist > 0) {
    result.push({ label: 'Distance', pct: Math.round(((a.distance_km - avgDist) / avgDist) * 100) })
  }
  if (a.duration_minutes != null && avgDur != null && avgDur > 0) {
    result.push({ label: 'Duration', pct: Math.round(((a.duration_minutes - avgDur) / avgDur) * 100) })
  }
  if (a.elevation_gain_m != null && avgElev != null && avgElev > 0) {
    result.push({ label: 'Elevation', pct: Math.round(((a.elevation_gain_m - avgElev) / avgElev) * 100) })
  }
  return result
}

// ── Stat row ─────────────────────────────────────────────────────────────────
function StatRow({ label, value, tooltipSlug }: {
  label: string; value: string | null; tooltipSlug?: string
}) {
  if (!value) return null
  return (
    <div className="flex justify-between py-3 border-b border-white/[0.06] last:border-0">
      <span className="flex items-center gap-1 text-sm text-white/40">
        {label}
        {tooltipSlug && <MetricInfo slug={tooltipSlug} />}
      </span>
      <span className="text-sm font-semibold text-white font-mono tabular-nums">{value}</span>
    </div>
  )
}

interface PageProps { params: Promise<{ id: string }> }

export default async function ActivityDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: activityRaw } = await supabase
    .from('activities').select('*').eq('id', id).single()

  const activity: Activity | null =
    activityRaw
      ? (activityRaw as Activity)
      : (mockActivities.find(a => a.id === id) ?? null)

  if (!activity) notFound()

  const activityDate = activity.start_time.slice(0, 10)
  const sevenDaysBack = format(
    new Date(new Date(activityDate).getTime() - 7 * 86400000), 'yyyy-MM-dd'
  )
  const ninetyDaysAgo = format(new Date(new Date(activityDate).getTime() - 90 * 86400000), 'yyyy-MM-dd')

  const [{ data: metricsRaw }, { data: recentActivitiesRaw }] = await Promise.all([
    supabase.from('health_metrics').select('*')
      .gte('date', sevenDaysBack).lte('date', activityDate),
    supabase.from('activities').select('id,activity_type,distance_km,duration_minutes,elevation_gain_m')
      .eq('activity_type', activity.activity_type)
      .gte('start_time', ninetyDaysAgo + 'T00:00:00')
      .order('start_time', { ascending: false }).limit(15),
  ])

  const recentMetrics: HealthMetrics[] =
    metricsRaw && metricsRaw.length > 0
      ? (metricsRaw as HealthMetrics[])
      : mockHealthMetrics.filter(m => m.date >= sevenDaysBack && m.date <= activityDate)

  const explanation = explainActivityDifficulty(activity, recentMetrics)
  const accentColor = ACTIVITY_COLOR[activity.activity_type] ?? '#888888'
  const typeLabel   = TYPE_LABELS[activity.activity_type] ?? activity.activity_type
  const isStrava    = activity.source?.toLowerCase().includes('strava') && activity.external_id

  // ── Sanitise impossible sensor values ────────────────────────────────────
  const displayHr    = activity.avg_hr    != null && activity.avg_hr    < 230 ? activity.avg_hr    : null
  const displayMaxHr = activity.max_hr    != null && activity.max_hr    < 240 ? activity.max_hr    : null
  const displayPwr   = activity.avg_power != null && activity.avg_power < 600 ? activity.avg_power : null

  const sessionSummary   = getSessionSummary(activity, displayHr, displayPwr)
  const trainingSignal   = getTrainingSignal(activity, displayHr, displayPwr)
  const recentActivities = (recentActivitiesRaw ?? []) as Activity[]
  const comparisons      = buildComparisons(activity, recentActivities)

  return (
    <div className="bg-[#20252B] min-h-screen">
      <div className="max-w-[1200px] mx-auto">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <div className="px-6 sm:px-10 lg:px-16 pt-10 pb-12">
          <Link
            href="/activities"
            className="inline-flex items-center gap-1 text-sm text-white/35 hover:text-white/70 transition-colors mb-8"
          >
            <ChevronLeft className="h-4 w-4" />
            Activities
          </Link>

          {/* Type + Strava link */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: accentColor }}>
              {typeLabel}
            </span>
            {isStrava && (
              <a
                href={`https://www.strava.com/activities/${activity.external_id}`}
                target="_blank" rel="noopener noreferrer"
                className="text-[10px] font-medium text-white/25 hover:text-white/50 transition-colors"
              >
                Open in Strava →
              </a>
            )}
          </div>

          {/* Title */}
          <h1 className="font-display font-bold text-white leading-tight mb-3"
              style={{ fontSize: 'clamp(2rem, 5vw, 4rem)' }}>
            {activity.title}
          </h1>

          {/* Date */}
          <p className="text-sm text-white/35 mb-10">
            {format(new Date(activity.start_time), 'EEEE, d MMMM yyyy · HH:mm')}
          </p>

          {/* Large metrics row */}
          <div className="flex flex-wrap gap-x-12 gap-y-6">
            {activity.distance_km != null && (
              <div>
                <p className="font-bold text-white font-mono tabular-nums leading-none text-4xl sm:text-5xl">
                  {activity.distance_km.toFixed(1)}
                </p>
                <p className="text-[10px] text-white/30 uppercase tracking-[0.12em] mt-1.5">km</p>
              </div>
            )}
            {activity.duration_minutes != null && (
              <div>
                <p className="font-bold text-white font-mono tabular-nums leading-none text-4xl sm:text-5xl">
                  {fmt(activity.duration_minutes)}
                </p>
                <p className="text-[10px] text-white/30 uppercase tracking-[0.12em] mt-1.5">Duration</p>
              </div>
            )}
            {activity.elevation_gain_m != null && activity.elevation_gain_m > 0 && (
              <div>
                <p className="font-bold text-white font-mono tabular-nums leading-none text-4xl sm:text-5xl">
                  {Math.round(activity.elevation_gain_m)}
                </p>
                <p className="text-[10px] text-white/30 uppercase tracking-[0.12em] mt-1.5">m gain</p>
              </div>
            )}
            {displayHr != null && (
              <div>
                <p className="font-bold text-white font-mono tabular-nums leading-none text-4xl sm:text-5xl">
                  {displayHr}
                </p>
                <p className="text-[10px] text-white/30 uppercase tracking-[0.12em] mt-1.5">avg bpm</p>
              </div>
            )}
            {displayPwr != null && (
              <div>
                <p className="font-bold font-mono tabular-nums leading-none text-4xl sm:text-5xl" style={{ color: accentColor }}>
                  {displayPwr}
                </p>
                <p className="text-[10px] text-white/30 uppercase tracking-[0.12em] mt-1.5">avg W</p>
              </div>
            )}
          </div>
        </div>

        {/* ── SESSION SUMMARY ──────────────────────────────────────────── */}
        <div className="bg-[#272D35] border-t border-white/[0.06] px-6 sm:px-10 lg:px-16 py-8">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-3">Session summary</p>
          <p className="text-base text-white/70 leading-relaxed max-w-xl">{sessionSummary}</p>
        </div>

        {/* ── COMPARED TO RECENT ACTIVITIES ────────────────────────────── */}
        {comparisons.length > 0 && (
          <div className="bg-[#20252B] border-t border-white/[0.06] px-6 sm:px-10 lg:px-16 py-8">
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-5">
              Compared to your recent {TYPE_LABELS[activity.activity_type]?.toLowerCase() ?? activity.activity_type}s
            </p>
            <div className="flex flex-wrap gap-x-12 gap-y-4">
              {comparisons.map(({ label, pct }) => (
                <div key={label}>
                  <p className={`font-bold font-mono tabular-nums leading-none text-2xl sm:text-3xl ${
                    pct > 10 ? 'text-[#FF7A00]' : pct < -10 ? 'text-white/40' : 'text-white'
                  }`}>
                    {pct > 0 ? '+' : ''}{pct}%
                  </p>
                  <p className="text-[10px] text-white/30 uppercase tracking-[0.12em] mt-1.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TRAINING SIGNAL ──────────────────────────────────────────── */}
        <div className="bg-[#272D35] border-t border-white/[0.06] px-6 sm:px-10 lg:px-16 py-8">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-3">Training signal</p>
          <p className="text-base font-semibold text-white mb-1.5">{trainingSignal.label}</p>
          <p className="text-sm text-white/50 max-w-xl">{trainingSignal.explanation}</p>
        </div>

        {/* ── SESSION STATS ─────────────────────────────────────────────── */}
        <div className="bg-[#20252B] px-6 sm:px-10 lg:px-16 py-8">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-1">Stats</p>
          <div className="max-w-lg">
            <StatRow label="Duration"         value={fmt(activity.duration_minutes)}                                   tooltipSlug="duration" />
            <StatRow label="Distance"         value={activity.distance_km ? `${activity.distance_km.toFixed(2)} km` : null} tooltipSlug="distance" />
            <StatRow label="Elevation gain"   value={activity.elevation_gain_m ? `${activity.elevation_gain_m} m` : null}   tooltipSlug="elevation-gain" />
            <StatRow label="Avg heart rate"   value={displayHr ? `${displayHr} bpm` : null}                           tooltipSlug="heart-rate" />
            <StatRow label="Max heart rate"   value={displayMaxHr ? `${displayMaxHr} bpm` : null}                     tooltipSlug="heart-rate" />
            <StatRow label="Avg power"        value={displayPwr ? `${displayPwr} W` : null}                           tooltipSlug="average-power" />
            <StatRow label="Calories"         value={activity.calories ? `${activity.calories} kcal` : null} />
            <StatRow label="Perceived effort" value={activity.perceived_effort ? `${activity.perceived_effort}/10` : null} />
          </div>
        </div>

        {/* ── CONDITIONS ───────────────────────────────────────────────── */}
        {(activity.weather_temp_c != null || activity.weather_wind_kph != null) && (
          <div className="bg-[#272D35] border-t border-white/[0.06] px-6 sm:px-10 lg:px-16 py-8">
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-1">Conditions</p>
            <div className="max-w-lg">
              <StatRow label="Temperature" value={activity.weather_temp_c != null ? `${activity.weather_temp_c}°C` : null} />
              <StatRow label="Wind"        value={activity.weather_wind_kph != null ? `${activity.weather_wind_kph} km/h` : null} />
            </div>
          </div>
        )}

        {/* ── WHY THIS MATTERS ─────────────────────────────────────────── */}
        {explanation.reasons.length > 0 && (
          <div className="bg-[#20252B] border-t border-white/[0.06] px-6 sm:px-10 lg:px-16 py-8">
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-4">
              Why did this feel hard?
            </p>
            <div className="space-y-3 max-w-xl">
              {explanation.reasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-[#FFB000] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-white/70 leading-relaxed">{reason}</span>
                </div>
              ))}
              <p className="text-xs text-white/25 pt-2 border-t border-white/[0.06]">{explanation.summary}</p>
            </div>
          </div>
        )}
        {explanation.reasons.length === 0 && (
          <div className="bg-[#20252B] border-t border-white/[0.06] px-6 sm:px-10 lg:px-16 py-8">
            <div className="flex items-start gap-2.5 max-w-xl">
              <CheckCircle className="h-4 w-4 text-[#16A34A] flex-shrink-0 mt-0.5" />
              <span className="text-sm text-white/60 leading-relaxed">{explanation.summary}</span>
            </div>
          </div>
        )}

        {/* ── NOTES ────────────────────────────────────────────────────── */}
        {activity.difficulty_note && (
          <div className="bg-[#272D35] border-t border-white/[0.06] px-6 sm:px-10 lg:px-16 py-8">
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-2">Notes</p>
            <p className="text-sm text-white/60 leading-relaxed max-w-xl">{activity.difficulty_note}</p>
          </div>
        )}

      </div>
    </div>
  )
}
