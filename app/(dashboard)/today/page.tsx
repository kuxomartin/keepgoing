export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, subDays, startOfDay } from 'date-fns'
import { StatCard } from '@/components/ui/stat-card'
import { DailyCheckinForm } from '@/components/dashboard/daily-checkin-form'
import { QuickAddWeight } from '@/components/dashboard/quick-add-weight'
import { QuickAddFood } from '@/components/dashboard/quick-add-food'
import { QuickAddActivity } from '@/components/dashboard/quick-add-activity'
import { TodayStatus } from '@/components/dashboard/today-status'
import { DailySummaryCard } from '@/components/dashboard/daily-summary-card'
import { InsightsSection } from '@/components/dashboard/insights-section'
import { getRecoveryScore } from '@/lib/calculations/recovery-score'
import { runInsightEngine } from '@/lib/insights/engine'
import { mockHealthMetrics, mockWeightLogs } from '@/lib/mock-data/demo-data'
import type { HealthMetrics, WeightLog } from '@/types/database'
import type { DaySummary } from '@/lib/insights/types'
import Link from 'next/link'
import { Scale, Moon, Heart, Zap, UtensilsCrossed } from 'lucide-react'
import { QuickActionsPanel } from '@/components/dashboard/quick-actions-panel'

// ── Data assembly helper ──────────────────────────────────────────────────────

function buildDaySummaries(
  dateRange: string[],
  metricsByDate: Record<string, HealthMetrics>,
  foodByDate: Record<string, { calories: number; protein: number }>,
  weightByDate: Record<string, number>,
  activityMinutesByDate: Record<string, number>,
): DaySummary[] {
  return dateRange.map(date => ({
    date,
    hrv:           metricsByDate[date]?.hrv_ms         ?? null,
    restingHr:     metricsByDate[date]?.resting_hr     ?? null,
    sleepMinutes:  metricsByDate[date]?.sleep_minutes  ?? null,
    steps:         metricsByDate[date]?.steps          ?? null,
    activeEnergy:  metricsByDate[date]?.active_energy_kcal  ?? null,
    restingEnergy: metricsByDate[date]?.resting_energy_kcal ?? null,
    calories:      foodByDate[date]?.calories  ?? null,
    protein:       foodByDate[date]?.protein   ?? null,
    weight:        weightByDate[date]          ?? null,
    activityMinutes: activityMinutesByDate[date] ?? 0,
  }))
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TodayPage() {
  const supabase  = await createClient()
  const today     = format(new Date(), 'yyyy-MM-dd')
  const longDate  = format(new Date(), 'EEEE, d MMMM yyyy')
  const oldest30  = format(subDays(startOfDay(new Date()), 29), 'yyyy-MM-dd')
  const oldest14  = format(subDays(startOfDay(new Date()), 13), 'yyyy-MM-dd')

  // ── Parallel fetch: wider windows for insight engine ──────────────────────
  const [
    { data: metricsRaw },
    { data: foodRaw },
    { data: weightsRaw },
    { data: activitiesRaw },
    { data: checkinRaw },
  ] = await Promise.all([
    // 30 days of health metrics
    supabase
      .from('health_metrics')
      .select('date, hrv_ms, resting_hr, sleep_minutes, steps, active_energy_kcal, resting_energy_kcal')
      .gte('date', oldest30)
      .lte('date', today)
      .order('date', { ascending: true }),
    // 14 days of food logs (calories + protein)
    supabase
      .from('food_logs')
      .select('date, estimated_calories, protein_g')
      .gte('date', oldest14)
      .lte('date', today),
    // 30 days of weight logs
    supabase
      .from('weight_logs')
      .select('date, weight_kg')
      .gte('date', oldest30)
      .lte('date', today)
      .order('date', { ascending: true }),
    // 14 days of activities
    supabase
      .from('activities')
      .select('start_time, duration_minutes')
      .gte('start_time', oldest14 + 'T00:00:00')
      .lte('start_time', today   + 'T23:59:59'),
    // Today's check-in
    supabase
      .from('daily_checkins')
      .select('energy, stress, soreness')
      .eq('date', today)
      .limit(1),
  ])

  // ── Index raw data by date ────────────────────────────────────────────────
  const metricsByDate: Record<string, HealthMetrics> = {}
  for (const row of metricsRaw ?? []) {
    metricsByDate[row.date] = row as HealthMetrics
  }

  const foodByDate: Record<string, { calories: number; protein: number }> = {}
  for (const row of foodRaw ?? []) {
    if (!foodByDate[row.date]) foodByDate[row.date] = { calories: 0, protein: 0 }
    foodByDate[row.date].calories += row.estimated_calories ?? 0
    foodByDate[row.date].protein  += row.protein_g         ?? 0
  }

  const weightByDate: Record<string, number> = {}
  let latestWeightReal: { date: string; weight_kg: number } | null = null
  for (const row of weightsRaw ?? []) {
    weightByDate[row.date] = row.weight_kg
    latestWeightReal = row
  }

  const activityMinutesByDate: Record<string, number> = {}
  for (const row of activitiesRaw ?? []) {
    const date = row.start_time.slice(0, 10) // extract YYYY-MM-DD
    activityMinutesByDate[date] = (activityMinutesByDate[date] ?? 0) + (row.duration_minutes ?? 0)
  }

  // ── Build 30-day timeline for insight engine ──────────────────────────────
  const dateRange = Array.from({ length: 30 }, (_, i) =>
    format(subDays(startOfDay(new Date()), 29 - i), 'yyyy-MM-dd')
  )
  const allDays = buildDaySummaries(
    dateRange, metricsByDate, foodByDate, weightByDate, activityMinutesByDate,
  )

  // ── Run insight engine ────────────────────────────────────────────────────
  const engineOutput = runInsightEngine(allDays, today)

  // ── Today-specific values (real data only, no cross-date fallback) ─────────
  const realMetrics    = metricsByDate[today] as HealthMetrics | undefined ?? null
  const todayFood      = foodByDate[today]    ?? null
  const checkinData    = checkinRaw?.[0]      ?? null

  const consumed       = todayFood?.calories    ?? null
  const protein        = todayFood?.protein     ?? null
  const activeEnergy   = realMetrics?.active_energy_kcal  ?? null
  const restingEnergy  = realMetrics?.resting_energy_kcal ?? null

  const activityCount   = activitiesRaw?.filter(a => a.start_time.slice(0, 10) === today).length ?? 0
  const activityMinutes = activityMinutesByDate[today] ?? 0

  // 7-day weight average (for DailySummaryCard delta)
  const weight7dVals = dateRange.slice(-7).map(d => weightByDate[d]).filter((v): v is number => v != null)
  const avgWeight7d  = weight7dVals.length >= 2
    ? weight7dVals.reduce((a, b) => a + b, 0) / weight7dVals.length
    : null

  // ── Mock fallback for display-only StatCards ──────────────────────────────
  const todayMetrics: HealthMetrics | null =
    realMetrics ?? (mockHealthMetrics.find(m => m.date === today) ?? mockHealthMetrics[0])

  const latestWeightDisplay: WeightLog | null =
    latestWeightReal
      ? { ...latestWeightReal, id: '', user_id: '', waist_cm: null, body_fat_percent: null, notes: null, created_at: '' }
      : mockWeightLogs[0]

  const sleepHours = todayMetrics?.sleep_minutes
    ? parseFloat((todayMetrics.sleep_minutes / 60).toFixed(1))
    : null

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{longDate}</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-0.5">Today</h1>
      </div>

      {/* ① Insights — proactive, surfaces what matters */}
      <InsightsSection insights={engineOutput.insights} />

      {/* ② Action-oriented status */}
      <TodayStatus
        readiness={engineOutput.todayReadiness}
        headline={engineOutput.todayHeadline}
        supporting={engineOutput.todaySupporting}
      />

      {/* ③ Metric stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Weight"
          value={latestWeightDisplay ? latestWeightDisplay.weight_kg.toFixed(1) : '—'}
          unit={latestWeightDisplay ? 'kg' : ''}
          subtitle={latestWeightDisplay ? `Last: ${latestWeightDisplay.date}` : 'Not logged yet'}
          icon={<Scale className="h-5 w-5" />}
        />
        <StatCard
          label="Sleep"
          value={sleepHours ?? '—'}
          unit={sleepHours ? 'h' : ''}
          subtitle={todayMetrics?.deep_sleep_minutes
            ? `${Math.round(todayMetrics.deep_sleep_minutes / 60 * 10) / 10}h deep`
            : undefined}
          status={sleepHours
            ? (sleepHours >= 7 ? 'green' : sleepHours >= 6 ? 'yellow' : 'red')
            : 'neutral'}
          icon={<Moon className="h-5 w-5" />}
        />
        <StatCard
          label="Resting HR"
          value={todayMetrics?.resting_hr ?? '—'}
          unit={todayMetrics?.resting_hr ? 'bpm' : ''}
          status={todayMetrics?.resting_hr
            ? (todayMetrics.resting_hr <= 55 ? 'green' : todayMetrics.resting_hr <= 65 ? 'yellow' : 'red')
            : 'neutral'}
          icon={<Heart className="h-5 w-5" />}
        />
        <StatCard
          label="HRV"
          value={todayMetrics?.hrv_ms != null ? Math.round(Number(todayMetrics.hrv_ms)) : '—'}
          unit={todayMetrics?.hrv_ms != null ? 'ms' : ''}
          status={todayMetrics?.hrv_ms != null
            ? (Number(todayMetrics.hrv_ms) >= 55 ? 'green' : Number(todayMetrics.hrv_ms) >= 40 ? 'yellow' : 'red')
            : 'neutral'}
          icon={<Zap className="h-5 w-5" />}
        />
      </div>

      {/* ④ Full daily summary — real data only */}
      <DailySummaryCard
        consumed={consumed}
        protein={protein}
        activeEnergy={activeEnergy}
        restingEnergy={restingEnergy}
        recovery={realMetrics ? getRecoveryScore(realMetrics) : null}
        hrv={realMetrics?.hrv_ms ?? null}
        restingHr={realMetrics?.resting_hr ?? null}
        sleepHours={realMetrics?.sleep_minutes != null ? realMetrics.sleep_minutes / 60 : null}
        steps={realMetrics?.steps ?? null}
        activityCount={activityCount}
        activityMinutes={activityMinutes}
        latestWeight={latestWeightReal?.weight_kg ?? null}
        avgWeight7d={avgWeight7d}
        checkin={checkinData}
      />

      {/* Mobile: Add Meal shortcut */}
      <Link
        href="/food/add?from=today"
        className="lg:hidden flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm hover:border-blue-200 hover:shadow-md transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            <UtensilsCrossed className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Log a meal</p>
            <p className="text-xs text-gray-400">Tap to add food</p>
          </div>
        </div>
        <span className="text-blue-600 font-semibold text-lg">+</span>
      </Link>

      <QuickActionsPanel />
      <DailyCheckinForm />

      <div className="hidden lg:grid grid-cols-3 gap-4">
        <QuickAddWeight />
        <QuickAddFood />
        <QuickAddActivity />
      </div>
    </div>
  )
}
