export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, subDays, startOfDay, differenceInCalendarDays } from 'date-fns'
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
import { computeProteinTarget, detectDuckMeat, detectEveningFruit, generateFoodObservationInsights } from '@/lib/profile/food-context'
import type { HealthMetrics } from '@/types/database'
import type { DaySummary } from '@/lib/insights/types'
import Link from 'next/link'
import { UtensilsCrossed } from 'lucide-react'

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

  // 8 parallel fetches — wider windows for insight engine
  const [
    { data: metricsRaw },
    { data: foodRaw },
    { data: weightsRaw },
    { data: activitiesRaw },
    { data: checkinRaw },
    { data: coffeeRaw },
    { data: todayFoodDesc },
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

    // Today's food descriptions — for keyword matching (duck, evening fruit)
    supabase.from('food_logs')
      .select('description, eaten_at')
      .eq('date', today),

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

  // ── Today-specific values ─────────────────────────────────────────────────
  const realMetrics = metricsByDate[today] as HealthMetrics | null ?? null
  const todayFood   = foodByDate[today] ?? null
  const checkin     = checkinRaw?.[0] ?? null

  const consumed        = todayFood?.calories ?? null
  const proteinToday    = todayFood?.protein  ?? null
  const fatToday        = todayFood?.fat      ?? null
  const activityMinutes = actMins[today]      ?? 0

  // ── Dynamic protein target (#2) ───────────────────────────────────────────
  const latestWeightKg = latestWeightReal?.weight_kg ?? personalContext.weightCurrentKg ?? null
  const proteinTarget  = computeProteinTarget(personalContext, latestWeightKg, 140)

  // ── Food observation detection (#4 duck, #5 evening fruit) ───────────────
  const todayDescriptions = (todayFoodDesc ?? []) as Array<{ description: string; eaten_at: string | null }>
  const duckFound         = personalContext.hasDuckMeatReaction && detectDuckMeat(todayDescriptions.map(f => f.description))
  const eveningFruitFound = personalContext.eveningFruitContext  && detectEveningFruit(todayDescriptions)

  // ── Run engines ───────────────────────────────────────────────────────────
  const engine = runInsightEngine(allDays, today)

  // Coffee insights (#6) — personalized when IgG sensitivity flag exists
  const coffeeInsights = generateCoffeeInsights({
    totalCaffeineMg:     coffeeMg > 0 ? coffeeMg : null,
    lastCoffeeHour,
    hasCoffeeSensitivity: personalContext.hasCoffeeSensitivity,
  })

  // Food observation insights (#4, #5) — max 2, self-reported only
  const foodObsInsights = generateFoodObservationInsights({ duckFound, eveningFruitFound })

  // Merge: food-obs first (highest severity), then coffee warnings, then engine
  const allInsights = [...foodObsInsights, ...coffeeInsights, ...engine.insights].slice(0, 5)
  const trendItems   = computeTrendItems(historical)
  const trendSummary = computeTrendSummary(trendItems)

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
    proteinTargetG:     proteinTarget.grams,
    personalContext,
  })


  return (
    <div className="space-y-4">
      {/* Date header */}
      <p className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">{longDate}</p>

      {/* ━━━ HERO — TODAY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
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

      {/* ━━━ RECOMMENDATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <RecommendationCard rec={dailyRec} />

      {/* ━━━ CONTEXT: Yesterday + Trend — combined flat panel ━━━━━━━━━━━━━━ */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
        <div className="px-5 py-4">
          <YesterdayWidget yday={yday} calBase7d={calBase7d} />
        </div>
        <div className="px-5 py-4">
          <TrendWidget
            items={trendItems}
            interpretation={trendSummary.interpretation}
            recommendation={trendSummary.recommendation}
          />
        </div>
      </div>

      {/* ━━━ QUICK ACTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* Add Meal shortcut (mobile) */}
      <Link
        href="/food/add?from=today"
        className="lg:hidden flex items-center justify-between bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 px-5 py-4 hover:border-blue-200 dark:hover:border-blue-500/30 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 dark:bg-blue-500/10 rounded-xl flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 transition-colors">
            <UtensilsCrossed className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Log a meal</p>
        </div>
        <span className="text-blue-500 dark:text-blue-400 font-semibold text-lg leading-none">+</span>
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
