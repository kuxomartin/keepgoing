export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, subDays, startOfDay } from 'date-fns'
import { WeightChart } from '@/components/charts/weight-chart'
import { movingAverage } from '@/lib/calculations/moving-average'
import type { WeightLog } from '@/types/database'
import type { WeightChartPoint } from '@/components/charts/weight-chart'
import { loadPersonalContextSummary } from '@/lib/profile/context-loader'
import { computeEnergyBalanceDays } from '@/lib/weight/energy-balance'
import { EnergyBalanceSection } from '@/components/weight/energy-balance-section'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Plus } from 'lucide-react'

// ── Interpretation ─────────────────────────────────────────────────────────────
function getInterpretation(
  change30d: number | null,
  change7d: number | null,
  goalKg: number | null,
  currentKg: number | null,
): string {
  const delta = change30d ?? change7d
  if (delta == null) return 'Not enough data to show a trend yet.'
  const period = change30d != null ? '30 days' : '7 days'
  const stable = Math.abs(delta) <= 0.4

  if (stable) return `Weight stable over last ${period}.`

  const losingWeight = delta < 0
  const gainingWeight = delta > 0

  if (goalKg != null && currentKg != null) {
    const needToLose = goalKg < currentKg
    const needToGain = goalKg > currentKg

    if (needToLose && losingWeight) return 'Weight trending toward goal.'
    if (needToLose && gainingWeight) return 'Weight increasing — moving away from goal.'
    if (needToGain && gainingWeight) return 'Weight trending toward goal.'
    if (needToGain && losingWeight) return 'Weight decreasing — moving away from goal.'
  }

  return losingWeight
    ? `Weight decreasing over last ${period}.`
    : `Weight increasing over last ${period}.`
}

function fmtChange(v: number | null): string {
  if (v == null) return '—'
  return (v > 0 ? '+' : '') + v.toFixed(1) + ' kg'
}

function fmtDate(d: string): string {
  return format(new Date(d + 'T12:00:00'), 'd MMM yyyy')
}

export default async function WeightPage() {
  const supabase = await createClient()

  const today   = format(new Date(), 'yyyy-MM-dd')
  const d31ago  = format(subDays(startOfDay(new Date()), 30), 'yyyy-MM-dd')

  const [{ data: rawLogs }, personalContext, { data: foodRaw }, { data: metricsRaw }, { data: activitiesRaw }] = await Promise.all([
    supabase.from('weight_logs')
      .select('*')
      .gte('date', '2026-03-01')
      .order('date', { ascending: true })
      .limit(120),
    loadPersonalContextSummary(supabase),
    // Energy balance: food intake per day
    supabase.from('food_logs')
      .select('date, estimated_calories')
      .gte('date', d31ago)
      .lte('date', today),
    // Energy balance: burn from Apple Health (all sources, we merge below)
    supabase.from('health_metrics')
      .select('date, active_energy_kcal, resting_energy_kcal')
      .gte('date', d31ago)
      .lte('date', today)
      .order('date', { ascending: true }),
    // Workout calories — used as fallback when health_metrics active energy is a
    // partial-day snapshot (HAE ran before the workout was logged to HealthKit).
    supabase.from('activities')
      .select('start_time, calories')
      .gte('start_time', d31ago + 'T00:00:00')
      .lte('start_time', today + 'T23:59:59')
      .not('calories', 'is', null),
  ])

  const logs: WeightLog[] = rawLogs && rawLogs.length > 0 ? (rawLogs as WeightLog[]) : []
  const hasData = logs.length > 0

  const weights = logs.map(l => l.weight_kg)
  const ma7 = movingAverage(weights, 7)
  // 7-day and 30-day averages for the Trend Coach
  const cutoffAvg7  = format(subDays(startOfDay(new Date()), 6),  'yyyy-MM-dd')
  const cutoffAvg30 = format(subDays(startOfDay(new Date()), 29), 'yyyy-MM-dd')
  const logs7  = logs.filter(l => l.date >= cutoffAvg7)
  const logs30 = logs.filter(l => l.date >= cutoffAvg30)
  const avg7d  = logs7.length  > 0 ? Math.round((logs7.reduce((s, l)  => s + l.weight_kg, 0) / logs7.length)  * 10) / 10 : null
  const avg30d = logs30.length > 0 ? Math.round((logs30.reduce((s, l) => s + l.weight_kg, 0) / logs30.length) * 10) / 10 : null
  const chartData: WeightChartPoint[] = logs.map((l, i) => ({
    date: l.date, weight: l.weight_kg, ma7: ma7[i],
  }))

  const latest = logs[logs.length - 1] ?? null

  // Nearest measurement to 7/30 days ago
  const cutoff7  = format(subDays(startOfDay(new Date()), 7),  'yyyy-MM-dd')
  const cutoff30 = format(subDays(startOfDay(new Date()), 30), 'yyyy-MM-dd')
  const sevenAgoLog  = logs.slice().reverse().find(l => l.date <= cutoff7)  ?? null
  const thirtyAgoLog = logs.slice().reverse().find(l => l.date <= cutoff30) ?? null

  const change7d  = latest && sevenAgoLog  && sevenAgoLog.id  !== latest.id
    ? Math.round((latest.weight_kg - sevenAgoLog.weight_kg)  * 10) / 10 : null
  const change30d = latest && thirtyAgoLog && thirtyAgoLog.id !== latest.id
    ? Math.round((latest.weight_kg - thirtyAgoLog.weight_kg) * 10) / 10 : null

  const goalKg    = personalContext.weightGoalKg ?? null
  const currentKg = latest?.weight_kg ?? null
  const deltaKg   = goalKg != null && currentKg != null
    ? Math.round((currentKg - goalKg) * 10) / 10 : null
  const goalReached = deltaKg != null && Math.abs(deltaKg) <= 0.1

  const interpretation = getInterpretation(change30d, change7d, goalKg, currentKg)

  // Monthly rate (kg/month) — extrapolate from 30-day change if available
  const monthlyRate: number | null = (() => {
    if (change30d != null && thirtyAgoLog != null && latest != null) {
      const days = (new Date(latest.date + 'T12:00:00').getTime() - new Date(thirtyAgoLog.date + 'T12:00:00').getTime()) / 86400000
      if (days > 3) return Math.round(((change30d / days) * 30) * 10) / 10
    }
    if (change7d != null && sevenAgoLog != null && latest != null) {
      const days = (new Date(latest.date + 'T12:00:00').getTime() - new Date(sevenAgoLog.date + 'T12:00:00').getTime()) / 86400000
      if (days > 1) return Math.round(((change7d / days) * 30) * 10) / 10
    }
    return null
  })()

  function getTrendAssessment(): string {
    if (monthlyRate == null) return 'Not enough data to assess trend direction yet.'
    const r = monthlyRate
    const goalDir = goalKg != null && currentKg != null
      ? (goalKg < currentKg ? 'down' : goalKg > currentKg ? 'up' : null)
      : null

    if (goalDir === 'down') {
      if (r < -1.5) return 'Losing weight faster than is typically sustainable.'
      if (r >= -1.5 && r <= -0.2) return 'Current trajectory matches target.'
      if (Math.abs(r) <= 0.15) return 'Weight loss has stalled.'
      return 'Weight increasing — moving away from goal.'
    }
    if (goalDir === 'up') {
      if (r > 0.1 && r < 1.5) return 'Current trajectory matches target.'
      if (Math.abs(r) <= 0.1) return 'Weight gain has stalled.'
      if (r >= 1.5) return 'Weight increasing faster than intended.'
      return 'Weight trending in the wrong direction.'
    }
    if (Math.abs(r) <= 0.2) return 'Weight is stable.'
    if (r < 0) return 'Weight trending downward.'
    return 'Weight trending upward.'
  }
  const trendAssessment = getTrendAssessment()
  const monthlyRateStr  = monthlyRate != null
    ? (monthlyRate > 0 ? '+' : '') + monthlyRate.toFixed(1) + ' kg / month'
    : null

  function getWeightExplanation(): string {
    const delta = change30d ?? change7d
    if (delta == null) return 'Not enough data points to assess trend direction yet.'
    const stable = Math.abs(delta) <= 0.4
    if (stable) return 'Current trend is largely unchanged over the past 30 days.'
    if (delta < -0.4) {
      if (goalKg != null && currentKg != null && goalKg < currentKg) return 'Recent direction suggests you are moving toward your target.'
      return 'Weight is declining at a steady rate.'
    }
    if (delta > 0.4) {
      if (goalKg != null && currentKg != null && goalKg < currentKg) return 'Recent gain is moving away from goal.'
      return 'Weight is increasing over recent days.'
    }
    if (deltaKg != null && Math.abs(deltaKg) > 0.1) {
      return `Weight remains ${Math.abs(deltaKg)} kg ${deltaKg > 0 ? 'above' : 'below'} goal.`
    }
    return 'Weight trend is within normal variation.'
  }
  const weightExplanation = getWeightExplanation()

  const changeColor = (v: number | null, goalDirection: 'down' | 'up' | null) => {
    if (v == null) return 'text-white/25'
    if (goalDirection === 'down') return v < -0.4 ? 'text-[#16A34A]' : v > 0.4 ? 'text-[#E5173F]' : 'text-white'
    if (goalDirection === 'up') return v > 0.4 ? 'text-[#16A34A]' : v < -0.4 ? 'text-[#E5173F]' : 'text-white'
    return v < -0.4 ? 'text-[#16A34A]' : v > 0.4 ? 'text-[#E5173F]' : 'text-white'
  }
  const goalDir: 'down' | 'up' | null = goalKg == null || currentKg == null ? null
    : goalKg < currentKg ? 'down' : 'up'

  // ── Energy Balance data ───────────────────────────────────────────────────
  // Food intake by date
  const intakeByDate: Record<string, number> = {}
  for (const row of foodRaw ?? []) {
    const r = row as { date: string; estimated_calories: number | null }
    intakeByDate[r.date] = (intakeByDate[r.date] ?? 0) + (r.estimated_calories ?? 0)
  }

  // ── Activity calories per date (workout fallback for active energy) ──────────
  // When Apple Health's active_energy_kcal is a partial-day snapshot (HAE ran
  // before the workout was accumulated into HealthKit), use workout calories
  // as the active energy component instead.
  const activityCalsByDate: Record<string, number> = {}
  for (const a of activitiesRaw ?? []) {
    const row  = a as { start_time: string; calories: number | null }
    const date = row.start_time.slice(0, 10)
    if (row.calories != null && row.calories > 0)
      activityCalsByDate[date] = (activityCalsByDate[date] ?? 0) + row.calories
  }

  // ── Burn by date ─────────────────────────────────────────────────────────────
  // daily_active = MAX(health_metrics active_energy, sum of workout calories)
  // daily_burn   = resting_energy + daily_active
  //
  // Using MAX (not SUM) avoids double-counting on days where HealthKit already
  // included workout calories in active_energy_kcal.
  const activeByDate:  Record<string, number> = {}
  const restingByDate: Record<string, number> = {}
  for (const row of metricsRaw ?? []) {
    const r = row as { date: string; active_energy_kcal: number | null; resting_energy_kcal: number | null }
    if (r.active_energy_kcal  != null && r.active_energy_kcal  > (activeByDate[r.date]  ?? 0)) activeByDate[r.date]  = r.active_energy_kcal
    if (r.resting_energy_kcal != null && r.resting_energy_kcal > (restingByDate[r.date] ?? 0)) restingByDate[r.date] = r.resting_energy_kcal
  }
  const burnByDate:                 Record<string, number>  = {}
  const isPartialByDate:            Record<string, boolean> = {}
  const usedWorkoutFallbackByDate:  Record<string, boolean> = {}
  const allDatesWithBurn = new Set([
    ...Object.keys(activeByDate),
    ...Object.keys(restingByDate),
    ...Object.keys(activityCalsByDate),
  ])
  for (const date of allDatesWithBurn) {
    const hmActive    = activeByDate[date]     ?? 0
    const workoutCals = activityCalsByDate[date] ?? 0
    const resting     = restingByDate[date]    ?? 0
    // MAX: workout calories used only when they exceed what health_metrics reports
    const activeUsed  = Math.max(hmActive, workoutCals)
    const burn        = resting + activeUsed
    if (burn > 0) {
      burnByDate[date]                = Math.round(burn)
      isPartialByDate[date]           = resting < 500      // < 500 kcal resting = incomplete day
      usedWorkoutFallbackByDate[date] = workoutCals > hmActive && workoutCals > 0
    }
  }

  // Date range: last 30 completed days (excludes today)
  const completedDates = Array.from({ length: 30 }, (_, i) =>
    format(subDays(startOfDay(new Date()), 30 - i), 'yyyy-MM-dd')
  ).filter(d => d < today)

  const energyBalanceDays = computeEnergyBalanceDays(
    intakeByDate, burnByDate, completedDates,
    isPartialByDate, usedWorkoutFallbackByDate,
  )

  // Today's intake (partial — no burn yet)
  const todayIntakeKcal = intakeByDate[today] ? Math.round(intakeByDate[today]) : null

  return (
    <div className="flex flex-col">

      {/* ═══════════════════════════════════════════════════════════════════
          ZONE 1 — Dark hero
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#1B2128]">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 pt-12 pb-14">

          <div className="flex items-start justify-between mb-10">
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.15em]">Weight</p>
            <Link
              href="/weight/add"
              className="flex items-center gap-1.5 px-4 py-2 border border-white/[0.12] text-white/50 hover:text-white hover:border-white/30 text-xs font-semibold transition-colors"
            >
              <Plus className="h-3 w-3" />
              Log weight
            </Link>
          </div>

          {hasData ? (
            <>
              {/* Big number */}
              <div className="flex items-baseline gap-4 mb-4">
                <span
                  className="font-bold text-white font-mono tabular-nums leading-none"
                  style={{ fontSize: 'clamp(5rem, 12vw, 9rem)' }}
                >
                  {currentKg!.toFixed(1)}
                </span>
                <span className="text-2xl text-white/25 font-light">kg</span>
              </div>

              {/* Date + goal sub-line */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 mb-5">
                {latest && (
                  <p className="text-sm text-white/35">
                    Last measured {fmtDate(latest.date)}
                  </p>
                )}
                {goalKg != null && deltaKg != null && (
                  goalReached
                    ? <p className="text-sm text-[#16A34A] font-semibold">Goal reached — {goalKg} kg</p>
                    : <p className="text-sm text-white/35">
                        <span className="text-white/70">{Math.abs(deltaKg)} kg</span>
                        {' '}{deltaKg > 0 ? 'above' : 'below'} goal ({goalKg} kg)
                      </p>
                )}
              </div>

              {/* Verdict headline */}
              <p className="font-display text-xl sm:text-2xl font-bold text-white mb-2 leading-snug max-w-lg"
                 style={{ letterSpacing: '-0.02em' }}>
                {interpretation}
              </p>

              {/* Explanation */}
              <p className="text-sm text-white/40 leading-relaxed max-w-lg">{weightExplanation}</p>
            </>
          ) : (
            <p className="text-2xl text-white/30 font-light">No weight data since March 2026.</p>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ZONE 2 — Weight Trend Coach
      ═══════════════════════════════════════════════════════════════════ */}
      {hasData && (
        <div className="bg-[#272D35]">
          <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-10">

            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-7">
              Weight Trend
            </p>

            {/* Metrics row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-8">

              <div className="pr-6 sm:pr-8 border-r border-white/[0.08]">
                <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-2">Current</p>
                <p className="font-mono text-2xl font-bold text-white tabular-nums">
                  {currentKg != null ? currentKg.toFixed(1) : '—'} kg
                </p>
              </div>

              <div className="px-6 sm:px-8 border-r border-white/[0.08]">
                <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-2">7-day avg</p>
                <p className="font-mono text-2xl font-bold text-white tabular-nums">
                  {avg7d != null ? avg7d.toFixed(1) : '—'} kg
                </p>
              </div>

              <div className="px-6 sm:px-8 border-r border-white/[0.08]">
                <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-2">30-day avg</p>
                <p className="font-mono text-2xl font-bold text-white tabular-nums">
                  {avg30d != null ? avg30d.toFixed(1) : '—'} kg
                </p>
              </div>

              <div className="pl-6 sm:pl-8">
                <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-2">Direction</p>
                <p className={cn(
                  'font-mono text-xl font-bold tabular-nums',
                  monthlyRate == null ? 'text-white/25'
                    : monthlyRate < -0.2 ? 'text-[#16A34A]'
                    : monthlyRate > 0.2  ? 'text-[#FFB800]'
                    : 'text-white/60'
                )}>
                  {monthlyRateStr ?? '—'}
                </p>
              </div>
            </div>

            {/* Assessment */}
            <p className="font-display text-lg sm:text-xl font-bold text-white leading-snug"
               style={{ letterSpacing: '-0.015em' }}>
              {trendAssessment}
            </p>
            {goalKg != null && deltaKg != null && !goalReached && (
              <p className="text-sm text-white/35 mt-2">
                {Math.abs(deltaKg)} kg {deltaKg > 0 ? 'above' : 'below'} goal ({goalKg} kg).
                {monthlyRate != null && Math.abs(monthlyRate) > 0.1 && goalDir != null && (
                  ' ' + (Math.abs(deltaKg) / Math.abs(monthlyRate)).toFixed(1) + ' months at current rate.'
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ZONE 3 — Chart (light graphite)
      ═══════════════════════════════════════════════════════════════════ */}
      {hasData && (
        <div className="bg-[#272D35]">
          <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-10">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">
                Trend · since March 2026
              </span>
              <div className="ml-auto flex items-center gap-4 text-[10px] text-[#888888]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#D9D9D9] inline-block" /> Daily
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#20252B] inline-block" /> 7-day avg
                </span>
              </div>
            </div>
            <WeightChart data={chartData} />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ZONE 4 — Energy Balance
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#20252B] border-t border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-10">
          <EnergyBalanceSection
            days={energyBalanceDays}
            todayIntake={todayIntakeKcal}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ZONE 5 — Log (dark)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#20252B]">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-10">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-6">Recent log</p>

          {logs.length === 0 ? (
            <p className="text-white/30 text-sm">No entries yet.</p>
          ) : (
            <div>
              {[...logs].reverse().slice(0, 20).map((log, i) => (
                <div key={log.id}>
                  {i > 0 && <div className="border-t border-white/[0.06]" />}
                  <div className="flex items-center justify-between py-3.5">
                    <p className="text-sm text-white/35">
                      {format(new Date(log.date + 'T12:00:00'), 'EEE, d MMM yyyy')}
                    </p>
                    <div className="flex items-center gap-6 text-sm font-mono tabular-nums">
                      <span className="text-base font-semibold text-white">{log.weight_kg.toFixed(1)} kg</span>
                      {log.waist_cm && (
                        <span className="text-white/30 hidden sm:inline">{log.waist_cm} cm</span>
                      )}
                      {log.body_fat_percent && (
                        <span className="text-white/30 hidden md:inline">{log.body_fat_percent}%</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
