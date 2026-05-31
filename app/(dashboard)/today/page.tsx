export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, subDays, startOfDay, differenceInCalendarDays } from 'date-fns'
import { MetricInfo } from '@/components/ui/metric-info'
import { trendColor } from '@/lib/spark-utils'
import { cn } from '@/lib/utils'
import { DailyCheckinForm } from '@/components/dashboard/daily-checkin-form'
import { QuickAddWeight } from '@/components/dashboard/quick-add-weight'
import { QuickAddFood } from '@/components/dashboard/quick-add-food'
import { QuickActionsPanel } from '@/components/dashboard/quick-actions-panel'
import { YesterdayWidget } from '@/components/dashboard/yesterday-widget'
import { TrendWidget } from '@/components/dashboard/trend-widget'
import { QuickAddCoffee } from '@/components/dashboard/quick-add-coffee'
import { runInsightEngine } from '@/lib/insights/engine'
import { computeBaselines } from '@/lib/insights/baselines'
import { computeTrendItems, computeTrendSummary } from '@/lib/insights/trends'
import { generateCoffeeInsights } from '@/lib/insights/coffee-rules'
import { generateDailyRecommendation } from '@/lib/insights/recommendation'
import { loadPersonalContextSummary } from '@/lib/profile/context-loader'
import { computeProteinTarget, detectDuckMeat, detectEveningFruit, generateFoodObservationInsights } from '@/lib/profile/food-context'
import type { HealthMetrics } from '@/types/database'
import type { DaySummary } from '@/lib/insights/types'

// ── Trend label config ────────────────────────────────────────────────────────

const TREND: Record<string, { arrow: string; label: string; cls: string }> = {
  green: { arrow: '↑', label: 'improving', cls: 'text-emerald-500 dark:text-emerald-400' },
  amber: { arrow: '↓', label: 'declining', cls: 'text-amber-500  dark:text-amber-400'   },
  red:   { arrow: '↓', label: 'declining', cls: 'text-rose-500   dark:text-rose-400'    },
  blue:  { arrow: '→', label: 'stable',    cls: 'text-gray-400   dark:text-zinc-500'    },
  gray:  { arrow: '',  label: '',          cls: ''                                       },
}

// ── Metric tile — large number, label below, trend ────────────────────────────

function MetricTile({
  label, value, unit, slug, sparkValues, higherIsBetter, showTrend = true,
}: {
  label: string
  value: string
  unit: string
  slug: string
  sparkValues: number[]
  higherIsBetter: boolean
  showTrend?: boolean
}) {
  const colorKey = showTrend && sparkValues.length >= 4 ? trendColor(sparkValues, higherIsBetter) : 'gray'
  const trend    = TREND[colorKey]

  return (
    <div>
      <div className="flex items-baseline gap-1 leading-none">
        <span className="text-[2rem] font-black text-gray-900 dark:text-zinc-50 tabular-nums leading-none">
          {value}
        </span>
        <span className="text-sm text-gray-400 dark:text-zinc-500">{unit}</span>
      </div>
      <div className="flex items-center gap-0.5 mt-2">
        <span className="text-xs text-gray-400 dark:text-zinc-500">{label}</span>
        <MetricInfo slug={slug} />
      </div>
      {trend.label && (
        <span className={cn('text-xs font-medium mt-0.5 block', trend.cls)}>
          {trend.arrow} {trend.label}
        </span>
      )}
    </div>
  )
}

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

  // 8 parallel fetches
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
      .select('energy, soreness, digestion, notes')
      .eq('date', today).limit(1),

    supabase.from('coffee_logs')
      .select('consumed_at, cups, caffeine_mg')
      .eq('date', today)
      .order('consumed_at', { ascending: true }),

    supabase.from('food_logs')
      .select('description, eaten_at')
      .eq('date', today),

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

  // ── 30-day timeline ───────────────────────────────────────────────────────
  const dateRange = Array.from({ length: 30 }, (_, i) =>
    format(subDays(startOfDay(new Date()), 29 - i), 'yyyy-MM-dd')
  )
  const allDays    = buildDaySummaries(dateRange, metricsByDate, foodByDate, weightByDate, actMins)
  const historical = allDays.filter(d => d.date < today)
  const yday       = historical.slice(-1)[0] ?? null

  // ── Coffee today ──────────────────────────────────────────────────────────
  const coffeeLogs     = coffeeRaw ?? []
  const coffeeCups     = coffeeLogs.reduce((s, l) => s + Number(l.cups), 0)
  const coffeeMg       = coffeeLogs.reduce((s, l) => s + (l.caffeine_mg ?? 0), 0)
  const lastCoffeeLog  = coffeeLogs.length > 0 ? coffeeLogs[coffeeLogs.length - 1] : null
  const lastCoffeeTime = lastCoffeeLog ? lastCoffeeLog.consumed_at.slice(11, 16) : null
  const lastCoffeeHour = lastCoffeeLog ? parseInt(lastCoffeeLog.consumed_at.slice(11, 13), 10) : null

  // ── Today values ──────────────────────────────────────────────────────────
  const realMetrics     = metricsByDate[today] as HealthMetrics | null ?? null
  const todayFood       = foodByDate[today] ?? null
  const consumed        = todayFood?.calories ?? null
  const proteinToday    = todayFood?.protein  ?? null
  const fatToday        = todayFood?.fat      ?? null
  const activityMinutes = actMins[today] ?? 0

  // ── Protein target ────────────────────────────────────────────────────────
  const latestWeightKg = latestWeightReal?.weight_kg ?? personalContext.weightCurrentKg ?? null
  const proteinTarget  = computeProteinTarget(personalContext, latestWeightKg, 140)

  // ── Food observation detection ────────────────────────────────────────────
  const todayDescriptions = (todayFoodDesc ?? []) as Array<{ description: string; eaten_at: string | null }>
  const duckFound         = personalContext.hasDuckMeatReaction && detectDuckMeat(todayDescriptions.map(f => f.description))
  const eveningFruitFound = personalContext.eveningFruitContext  && detectEveningFruit(todayDescriptions)

  // ── Engines ───────────────────────────────────────────────────────────────
  const checkinData = checkinRaw?.[0] ?? null
  const engine = runInsightEngine(allDays, today, checkinData)

  const coffeeInsights  = generateCoffeeInsights({
    totalCaffeineMg: coffeeMg > 0 ? coffeeMg : null,
    lastCoffeeHour,
    hasCoffeeSensitivity: personalContext.hasCoffeeSensitivity,
  })
  const foodObsInsights = generateFoodObservationInsights({ duckFound, eveningFruitFound })
  // Merged insights available for future use — not rendered in this pass
  const _allInsights    = [...foodObsInsights, ...coffeeInsights, ...engine.insights].slice(0, 5)

  const trendItems   = computeTrendItems(historical)
  const trendSummary = computeTrendSummary(trendItems)

  // ── Recovery fallback ─────────────────────────────────────────────────────
  const fallbackRecovery = engine.usingFallback
    ? [...historical].reverse().find(d => d.hrv != null || d.sleepMinutes != null || d.restingHr != null)
    : undefined

  const widgetSleepH = realMetrics?.sleep_minutes != null
    ? realMetrics.sleep_minutes / 60
    : fallbackRecovery?.sleepMinutes != null
      ? fallbackRecovery.sleepMinutes / 60
      : null

  const widgetHrv    = realMetrics?.hrv_ms     ?? fallbackRecovery?.hrv      ?? null
  const widgetWeight = latestWeightReal?.weight_kg ?? null

  // ── 7-day sparklines for metric tiles ────────────────────────────────────
  const last7      = historical.slice(-7)
  const sleepSpark = last7.map(d => d.sleepMinutes).filter((v): v is number => v != null).map(m => m / 60)
  const hrvSpark   = last7.map(d => d.hrv).filter((v): v is number => v != null)

  // ── Calorie baseline for yesterday context ────────────────────────────────
  const calBase7d = (() => {
    const vals = historical.slice(-7).map(d => d.calories).filter((v): v is number => v != null && v > 400)
    return vals.length >= 3 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  })()

  // ── Daily recommendation (kept for future use) ────────────────────────────
  const baselines = computeBaselines(historical)
  const bikeRides = (activitiesRaw ?? [])
    .filter((r): r is typeof r & { activity_type: string } => r.activity_type === 'ride')
    .map(r => r.start_time.slice(0, 10)).sort().reverse()
  const daysSinceLastBike: number | null = bikeRides.length > 0
    ? differenceInCalendarDays(new Date(), new Date(bikeRides[0] + 'T12:00:00'))
    : null
  const d7ago = format(subDays(startOfDay(new Date()), 6), 'yyyy-MM-dd')
  const weeklyActivityMins = Object.entries(actMins)
    .filter(([d]) => d >= d7ago && d <= today)
    .reduce((sum, [, mins]) => sum + mins, 0)
  const _dailyRec = generateDailyRecommendation({
    todayHrv:       realMetrics?.hrv_ms != null ? Number(realMetrics.hrv_ms) : null,
    hrv14dBaseline: baselines.hrv14d,
    todaySleepH:    widgetSleepH,
    consumedKcal:   consumed,
    proteinG:       proteinToday,
    fatG:           fatToday,
    historical,
    yday,
    weeklyActivityMins,
    daysSinceLastBike,
    proteinTargetG:  proteinTarget.grams,
    personalContext,
  })

  // ── Derived flags ─────────────────────────────────────────────────────────
  const hasLogged = consumed != null || proteinToday != null || activityMinutes > 0 || coffeeCups > 0

  // Count visible metric tiles for grid columns
  const metricCount = [widgetHrv != null, widgetSleepH != null, widgetWeight != null].filter(Boolean).length

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── DATE ─────────────────────────────────────────────────────────── */}
      <p className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-8">
        {longDate}
      </p>

      {/* ── BRIEFING ─────────────────────────────────────────────────────── */}

      {/* 1. Headline — the hero */}
      <h1 className="text-4xl font-bold text-gray-900 dark:text-zinc-50 leading-tight tracking-tight mb-3">
        {engine.todayHeadline}
      </h1>

      {/* 2. Interpretation — the why */}
      <p className="text-base text-gray-500 dark:text-zinc-400 leading-relaxed mb-4">
        {engine.todayInterpretation}
      </p>

      {/* 3. Recommendation — no decorative arrow */}
      <div className="mb-6 space-y-2">
        <p className="text-base font-semibold text-gray-800 dark:text-zinc-200 leading-relaxed">
          {engine.todayRecommendation}
        </p>
        {engine.usingFallback && (
          <p className="text-xs text-gray-400 dark:text-zinc-600">
            Using yesterday&apos;s recovery data
          </p>
        )}
      </div>

      {/* ── MORNING CHECK-IN — time-sensitive, shown early ───────────────── */}
      <DailyCheckinForm existingCheckin={checkinData} />

      {/* ── METRICS — HRV · Sleep · Weight as instrument tiles ───────────── */}
      {metricCount > 0 && (
        <div className="border-t border-gray-100 dark:border-zinc-800 pt-6 mb-8 mt-6">
          <div className={cn(
            'grid gap-6',
            metricCount === 3 ? 'grid-cols-3' :
            metricCount === 2 ? 'grid-cols-2' : 'grid-cols-1'
          )}>
            {widgetHrv != null && (
              <MetricTile
                label="HRV"
                value={String(Math.round(Number(widgetHrv)))}
                unit="ms"
                slug="hrv"
                sparkValues={hrvSpark}
                higherIsBetter={true}
              />
            )}
            {widgetSleepH != null && (
              <MetricTile
                label="Sleep"
                value={widgetSleepH.toFixed(1)}
                unit="h"
                slug="sleep"
                sparkValues={sleepSpark}
                higherIsBetter={true}
              />
            )}
            {widgetWeight != null && (
              <MetricTile
                label="Weight"
                value={widgetWeight.toFixed(1)}
                unit="kg"
                slug="weight"
                sparkValues={[]}
                higherIsBetter={false}
                showTrend={false}
              />
            )}
          </div>
        </div>
      )}

      {/* ── TODAY LOGGED ─────────────────────────────────────────────────── */}
      {hasLogged && (
        <div className="mb-7">
          <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">
            Today logged
          </p>
          <div className="space-y-1 text-sm text-gray-600 dark:text-zinc-400">
            {(consumed != null || proteinToday != null) && (
              <p>
                {consumed != null && (
                  <span className="font-semibold text-gray-800 dark:text-zinc-200 tabular-nums">
                    {consumed.toLocaleString()} kcal
                  </span>
                )}
                {consumed != null && proteinToday != null && (
                  <span className="text-gray-300 dark:text-zinc-700"> · </span>
                )}
                {proteinToday != null && (
                  <span>{Math.round(proteinToday)}g protein</span>
                )}
              </p>
            )}
            {coffeeCups > 0 && (
              <p>
                ☕{' '}
                {coffeeCups % 1 === 0 ? coffeeCups : coffeeCups.toFixed(1)} cup{coffeeCups !== 1 ? 's' : ''}
                {coffeeMg > 0 && (
                  <span className="text-gray-400 dark:text-zinc-600"> · {coffeeMg}mg caffeine</span>
                )}
                {lastCoffeeTime && (
                  <span className="text-gray-400 dark:text-zinc-600"> · last {lastCoffeeTime}</span>
                )}
              </p>
            )}
            {activityMinutes > 0 && (
              <p>{activityMinutes} min active</p>
            )}
          </div>
        </div>
      )}

      {/* ── YESTERDAY ────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 dark:border-zinc-800 pt-5 mb-6">
        <YesterdayWidget yday={yday} calBase7d={calBase7d} />
      </div>

      {/* ── RECENT TREND ─────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 dark:border-zinc-800 pt-5 mb-8">
        <TrendWidget
          items={trendItems}
          interpretation={trendSummary.interpretation}
          recommendation={trendSummary.recommendation}
        />
      </div>

      {/* ── QUICK ACTIONS ────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 dark:border-zinc-800 pt-5 space-y-4">
        <QuickActionsPanel />
        <div className="hidden lg:grid grid-cols-3 gap-4">
          <QuickAddFood />
          <QuickAddCoffee />
          <QuickAddWeight />
        </div>
      </div>

    </div>
  )
}
