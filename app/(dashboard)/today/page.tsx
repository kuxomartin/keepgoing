export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, subDays, startOfDay, differenceInCalendarDays } from 'date-fns'
import { StatCard } from '@/components/ui/stat-card'
import { DailyCheckinForm } from '@/components/dashboard/daily-checkin-form'
import { QuickAddWeight } from '@/components/dashboard/quick-add-weight'
import { QuickAddFood } from '@/components/dashboard/quick-add-food'
import { QuickAddActivity } from '@/components/dashboard/quick-add-activity'
import { QuickActionsPanel } from '@/components/dashboard/quick-actions-panel'
import { TodayWidget } from '@/components/dashboard/today-widget'
import { YesterdayWidget } from '@/components/dashboard/yesterday-widget'
import { TrendWidget } from '@/components/dashboard/trend-widget'
import { RecommendationCard } from '@/components/dashboard/recommendation-card'
import { runInsightEngine } from '@/lib/insights/engine'
import { computeBaselines } from '@/lib/insights/baselines'
import { computeTrendItems, computeTrendSummary } from '@/lib/insights/trends'
import { generateCoffeeInsights } from '@/lib/insights/coffee-rules'
import { generateDailyRecommendation } from '@/lib/insights/recommendation'
import { loadPersonalContextSummary } from '@/lib/profile/context-loader'
import { mockHealthMetrics, mockWeightLogs } from '@/lib/mock-data/demo-data'
import type { HealthMetrics, WeightLog } from '@/types/database'
import type { DaySummary } from '@/lib/insights/types'
import Link from 'next/link'
import { Scale, Moon, Heart, Zap, UtensilsCrossed } from 'lucide-react'

// ── Data assembly ─────────────────────────────────────────────────────────────

function buildDaySummaries(
  dateRange: string[],
  metricsByDate: Record<string, HealthMetrics>,
  foodByDate: Record<string, { calories: number; protein: number; fat: number; carbs: number }>,
  weightByDate: Record<string, number>,
  actMins: Record<string, number>,
): DaySummary[] {
  return dateRange.map(date => ({
    date,
    hrv:           metricsByDate[date]?.hrv_ms              ?? null,
    restingHr:     metricsByDate[date]?.resting_hr          ?? null,
    sleepMinutes:  metricsByDate[date]?.sleep_minutes       ?? null,
    steps:         metricsByDate[date]?.steps               ?? null,
    activeEnergy:  metricsByDate[date]?.active_energy_kcal  ?? null,
    restingEnergy: metricsByDate[date]?.resting_energy_kcal ?? null,
    calories:      foodByDate[date]?.calories  ?? null,
    protein:       foodByDate[date]?.protein   ?? null,
    weight:        weightByDate[date]          ?? null,
    activityMinutes: actMins[date] ?? 0,
  }))
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TodayPage() {
  const supabase = await createClient()
  const today    = format(new Date(), 'yyyy-MM-dd')
  const longDate = format(new Date(), 'EEEE, d MMMM yyyy')
  const d30ago   = format(subDays(startOfDay(new Date()), 29), 'yyyy-MM-dd')
  const d14ago   = format(subDays(startOfDay(new Date()), 13), 'yyyy-MM-dd')

  // 7 parallel fetches — wider windows for insight engine
  const [
    { data: metricsRaw },
    { data: foodRaw },
    { data: weightsRaw },
    { data: activitiesRaw },
    { data: checkinRaw },
    { data: coffeeRaw },
    personalContext,
  ] = await Promise.all([
    supabase.from('health_metrics')
      .select('date, hrv_ms, resting_hr, sleep_minutes, steps, active_energy_kcal, resting_energy_kcal')
      .gte('date', d30ago).lte('date', today).order('date', { ascending: true }),

    supabase.from('food_logs')
      .select('date, estimated_calories, protein_g, fat_g, carbs_g')
      .gte('date', d14ago).lte('date', today),

    supabase.from('weight_logs')
      .select('date, weight_kg')
      .gte('date', d30ago).lte('date', today).order('date', { ascending: true }),

    supabase.from('activities')
      .select('start_time, duration_minutes, activity_type')
      .gte('start_time', d30ago + 'T00:00:00')
      .lte('start_time', today  + 'T23:59:59'),

    supabase.from('daily_checkins')
      .select('energy, stress, soreness')
      .eq('date', today).limit(1),

    // Today's coffee logs — for widget display and insight rules
    supabase.from('coffee_logs')
      .select('consumed_at, cups, caffeine_mg')
      .eq('date', today)
      .order('consumed_at', { ascending: true }),

    // Personal context (gracefully returns EMPTY_CONTEXT if table is empty)
    loadPersonalContextSummary(supabase),
  ])

  // ── Index by date ─────────────────────────────────────────────────────────
  const metricsByDate: Record<string, HealthMetrics> = {}
  for (const r of metricsRaw ?? []) metricsByDate[r.date] = r as HealthMetrics

  const foodByDate: Record<string, { calories: number; protein: number; fat: number; carbs: number }> = {}
  for (const r of foodRaw ?? []) {
    if (!foodByDate[r.date]) foodByDate[r.date] = { calories: 0, protein: 0, fat: 0, carbs: 0 }
    foodByDate[r.date].calories += r.estimated_calories ?? 0
    foodByDate[r.date].protein  += r.protein_g         ?? 0
    foodByDate[r.date].fat      += r.fat_g             ?? 0
    foodByDate[r.date].carbs    += r.carbs_g           ?? 0
  }

  const weightByDate: Record<string, number> = {}
  let latestWeightReal: { date: string; weight_kg: number } | null = null
  for (const r of weightsRaw ?? []) {
    weightByDate[r.date] = r.weight_kg
    latestWeightReal = r
  }

  const actMins: Record<string, number> = {}
  for (const r of activitiesRaw ?? []) {
    const d = r.start_time.slice(0, 10)
    actMins[d] = (actMins[d] ?? 0) + (r.duration_minutes ?? 0)
  }

  // ── Build 30-day timeline ─────────────────────────────────────────────────
  const dateRange = Array.from({ length: 30 }, (_, i) =>
    format(subDays(startOfDay(new Date()), 29 - i), 'yyyy-MM-dd')
  )
  const allDays = buildDaySummaries(dateRange, metricsByDate, foodByDate, weightByDate, actMins)

  const historical = allDays.filter(d => d.date < today)
  const yday = historical.slice(-1)[0] ?? null   // yesterday

  // ── Coffee today ─────────────────────────────────────────────────────────
  const coffeeLogs    = coffeeRaw ?? []
  const coffeeCups    = coffeeLogs.reduce((s, l) => s + Number(l.cups), 0)
  const coffeeMg      = coffeeLogs.reduce((s, l) => s + (l.caffeine_mg ?? 0), 0)
  const lastCoffeeLog = coffeeLogs.length > 0 ? coffeeLogs[coffeeLogs.length - 1] : null
  const lastCoffeeTime = lastCoffeeLog
    ? lastCoffeeLog.consumed_at.slice(11, 16)  // HH:MM from ISO string
    : null
  // Hour from consumed_at (treating stored time as local-naive)
  const lastCoffeeHour = lastCoffeeLog
    ? parseInt(lastCoffeeLog.consumed_at.slice(11, 13), 10)
    : null

  // ── Run engines ───────────────────────────────────────────────────────────
  const engine = runInsightEngine(allDays, today)
  const coffeeInsights = generateCoffeeInsights({
    totalCaffeineMg: coffeeMg > 0 ? coffeeMg : null,
    lastCoffeeHour,
  })
  // Merge coffee insights at the front (warnings) then engine insights
  const allInsights = [...coffeeInsights, ...engine.insights].slice(0, 5)
  const trendItems   = computeTrendItems(historical)
  const trendSummary = computeTrendSummary(trendItems)

  // ── Today-specific values ─────────────────────────────────────────────────
  const realMetrics = metricsByDate[today] as HealthMetrics | null ?? null
  const todayFood   = foodByDate[today] ?? null
  const checkin     = checkinRaw?.[0] ?? null

  const consumed        = todayFood?.calories ?? null
  const proteinToday    = todayFood?.protein  ?? null
  const fatToday        = todayFood?.fat      ?? null
  const activityMinutes = actMins[today]      ?? 0

  // Recovery metrics for TodayWidget:
  // If today has no Apple Health data, fall back to the most recent historical day
  // that has HRV / sleep / RHR — mirrors the engine's usingFallback logic.
  const fallbackRecovery = engine.usingFallback
    ? [...historical].reverse().find(d => d.hrv != null || d.sleepMinutes != null || d.restingHr != null)
    : undefined

  const widgetSleepH = realMetrics?.sleep_minutes != null
    ? realMetrics.sleep_minutes / 60
    : fallbackRecovery?.sleepMinutes != null
      ? fallbackRecovery.sleepMinutes / 60
      : null

  const widgetHrv = realMetrics?.hrv_ms      ?? fallbackRecovery?.hrv      ?? null
  const widgetRhr = realMetrics?.resting_hr  ?? fallbackRecovery?.restingHr ?? null

  // 7-day calorie baseline for YesterdayWidget context
  const calBase7d = (() => {
    const vals = historical.slice(-7)
      .map(d => d.calories)
      .filter((v): v is number => v != null && v > 400)
    return vals.length >= 3 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  })()

  // ── Recommendation engine inputs ─────────────────────────────────────────
  const baselines = computeBaselines(historical)

  // Days since last bike ride (activity_type = 'ride'), within 30-day window
  const bikeRides = (activitiesRaw ?? [])
    .filter((r): r is typeof r & { activity_type: string } => r.activity_type === 'ride')
    .map(r => r.start_time.slice(0, 10))
    .sort()
    .reverse()

  const daysSinceLastBike: number | null = bikeRides.length > 0
    ? differenceInCalendarDays(new Date(), new Date(bikeRides[0] + 'T12:00:00'))
    : null

  // Weekly activity minutes (last 7 days including today)
  const d7ago = format(subDays(startOfDay(new Date()), 6), 'yyyy-MM-dd')
  const weeklyActivityMins = Object.entries(actMins)
    .filter(([d]) => d >= d7ago && d <= today)
    .reduce((sum, [, mins]) => sum + mins, 0)

  const dailyRec = generateDailyRecommendation({
    todayHrv:           realMetrics?.hrv_ms       != null ? Number(realMetrics.hrv_ms) : null,
    hrv14dBaseline:     baselines.hrv14d,
    todaySleepH:        widgetSleepH,
    consumedKcal:       consumed,
    proteinG:           proteinToday,
    fatG:               fatToday,
    historical,
    yday,
    weeklyActivityMins,
    daysSinceLastBike,
    proteinTargetG:     140,
    personalContext,
  })

  // ── Mock fallback for StatCards only ─────────────────────────────────────
  const todayMetrics: HealthMetrics | null =
    realMetrics ?? (mockHealthMetrics.find(m => m.date === today) ?? mockHealthMetrics[0])

  const latestWeightDisplay: WeightLog | null =
    latestWeightReal
      ? { id: '', user_id: '', waist_cm: null, body_fat_percent: null, notes: null, created_at: '', ...latestWeightReal }
      : mockWeightLogs[0]

  const sleepHoursDisplay = todayMetrics?.sleep_minutes
    ? parseFloat((todayMetrics.sleep_minutes / 60).toFixed(1))
    : null

  return (
    <div className="space-y-4">
      {/* Date header */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{longDate}</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-0.5">Today</h1>
      </div>

      {/* ━━━ THREE PRIMARY WIDGETS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      {/* Widget 1 — TODAY */}
      <TodayWidget
        readiness={engine.todayReadiness}
        interpretation={engine.todayInterpretation}
        recommendation={engine.todayRecommendation}
        supporting={engine.todaySupporting}
        usingFallback={engine.usingFallback}
        sleepH={widgetSleepH}
        hrv={widgetHrv}
        rhr={widgetRhr}
        consumedKcal={consumed}
        proteinG={proteinToday}
        activityMinutes={activityMinutes}
        coffeeCups={coffeeCups}
        coffeeMg={coffeeMg > 0 ? coffeeMg : null}
        lastCoffeeTime={lastCoffeeTime}
      />

      {/* Widget 2 — YESTERDAY */}
      <YesterdayWidget yday={yday} calBase7d={calBase7d} />

      {/* Widget 3 — RECENT TREND */}
      <TrendWidget
        items={trendItems}
        interpretation={trendSummary.interpretation}
        recommendation={trendSummary.recommendation}
      />

      {/* ━━━ RECOMMENDATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <RecommendationCard rec={dailyRec} />

      {/* ━━━ SECONDARY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      {/* Metric reference cards */}
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
          value={sleepHoursDisplay ?? '—'}
          unit={sleepHoursDisplay ? 'h' : ''}
          subtitle={todayMetrics?.deep_sleep_minutes
            ? `${Math.round(todayMetrics.deep_sleep_minutes / 60 * 10) / 10}h deep`
            : undefined}
          status={sleepHoursDisplay
            ? (sleepHoursDisplay >= 7 ? 'green' : sleepHoursDisplay >= 6 ? 'yellow' : 'red')
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

      {/* Add Meal shortcut (mobile) */}
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
