export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, subDays, startOfDay, differenceInCalendarDays } from 'date-fns'
import { MetricInfo } from '@/components/ui/metric-info'
import { trendColor } from '@/lib/spark-utils'
import { cn } from '@/lib/utils'
import { CheckinPanel } from '@/components/dashboard/checkin-panel'
import { TodayConsole } from '@/components/dashboard/today-console'
import { runInsightEngine } from '@/lib/insights/engine'
import { computeBaselines } from '@/lib/insights/baselines'
import { computeTrendItems, computeTrendSummary } from '@/lib/insights/trends'
import { generateCoffeeInsights } from '@/lib/insights/coffee-rules'
import { generateDailyRecommendation } from '@/lib/insights/recommendation'
import { loadPersonalContextSummary } from '@/lib/profile/context-loader'
import {
  computeProteinTarget, detectDuckMeat, detectEveningFruit, generateFoodObservationInsights,
} from '@/lib/profile/food-context'
import { getSleepContextSentence } from '@/lib/calculations/sleep-verdict'
import type { HealthMetrics, SleepRecord } from '@/types/database'
import type { DaySummary, TodayReadiness } from '@/lib/insights/types'

// ── Verdict ────────────────────────────────────────────────────────────────────
const VERDICT_TEXT: Record<TodayReadiness, string> = {
  push:    'Great day for a hard session.',
  train:   'Good recovery today.',
  easy:    'Take it easy today.',
  recover: 'Body still recovering.',
}
const VERDICT_COLOR: Record<TodayReadiness, string> = {
  push:    'text-[#0D0D0D] dark:text-zinc-50',
  train:   'text-[#0D0D0D] dark:text-zinc-50',
  easy:    'text-[#0D0D0D] dark:text-zinc-50',
  recover: 'text-[#E5173F]',
}

// ── HRV trend display ─────────────────────────────────────────────────────────
const TREND_LABEL: Record<string, string> = {
  green: '↑ improving', amber: '↓ declining', red: '↓ declining', blue: '→ stable', gray: '',
}
const TREND_CLS: Record<string, string> = {
  green: 'text-[#16A34A]', amber: 'text-[#D97706]', red: 'text-[#E5173F]',
  blue:  'text-white/30',  gray:  '',
}

// ── Data builder ───────────────────────────────────────────────────────────────
function buildDaySummaries(
  dateRange: string[],
  metricsByDate: Record<string, HealthMetrics>,
  foodByDate: Record<string, { calories: number; protein: number; fat: number; carbs: number }>,
  weightByDate: Record<string, number>,
  actMins: Record<string, number>,
): DaySummary[] {
  return dateRange.map(date => ({
    date,
    hrv:            metricsByDate[date]?.hrv_ms              ?? null,
    restingHr:      metricsByDate[date]?.resting_hr          ?? null,
    sleepMinutes:   metricsByDate[date]?.sleep_minutes       ?? null,
    steps:          metricsByDate[date]?.steps               ?? null,
    activeEnergy:   metricsByDate[date]?.active_energy_kcal  ?? null,
    restingEnergy:  metricsByDate[date]?.resting_energy_kcal ?? null,
    calories:       foodByDate[date]?.calories  ?? null,
    protein:        foodByDate[date]?.protein   ?? null,
    weight:         weightByDate[date]          ?? null,
    activityMinutes: actMins[date] ?? 0,
  }))
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default async function TodayPage() {
  const supabase = await createClient()
  const today    = format(new Date(), 'yyyy-MM-dd')
  const longDate = format(new Date(), 'EEEE, d MMMM yyyy').toUpperCase()
  const d30ago   = format(subDays(startOfDay(new Date()), 29), 'yyyy-MM-dd')
  const d14ago   = format(subDays(startOfDay(new Date()), 13), 'yyyy-MM-dd')

  const [
    { data: metricsRaw },
    { data: foodRaw },
    { data: weightsRaw },
    { data: activitiesRaw },
    { data: checkinRaw },
    { data: coffeeRaw },
    { data: todayFoodDesc },
    personalContext,
    { data: sleepRecordRaw },
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
    supabase.from('food_logs').select('description, eaten_at').eq('date', today),
    loadPersonalContextSummary(supabase),
    supabase.from('sleep_records')
      .select('asleep_minutes, efficiency_pct, wake_count, avg_hrv')
      .gte('date', format(subDays(startOfDay(new Date()), 1), 'yyyy-MM-dd'))
      .lte('date', today)
      .order('date', { ascending: false })
      .limit(1),
  ])

  // ── Index by date ─────────────────────────────────────────────────────────
  const metricsByDate: Record<string, HealthMetrics> = {}
  for (const r of metricsRaw ?? []) metricsByDate[r.date] = r as HealthMetrics

  const foodByDate: Record<string, { calories: number; protein: number; fat: number; carbs: number }> = {}
  for (const r of foodRaw ?? []) {
    if (!foodByDate[r.date]) foodByDate[r.date] = { calories: 0, protein: 0, fat: 0, carbs: 0 }
    foodByDate[r.date].calories += r.estimated_calories ?? 0
    foodByDate[r.date].protein  += r.protein_g ?? 0
    foodByDate[r.date].fat      += r.fat_g ?? 0
    foodByDate[r.date].carbs    += r.carbs_g ?? 0
  }

  const weightByDate: Record<string, number> = {}
  let latestWeightReal: { date: string; weight_kg: number } | null = null
  for (const r of weightsRaw ?? []) { weightByDate[r.date] = r.weight_kg; latestWeightReal = r }

  const actMins: Record<string, number> = {}
  for (const r of activitiesRaw ?? []) {
    const d = r.start_time.slice(0, 10)
    actMins[d] = (actMins[d] ?? 0) + (r.duration_minutes ?? 0)
  }

  const dateRange  = Array.from({ length: 30 }, (_, i) =>
    format(subDays(startOfDay(new Date()), 29 - i), 'yyyy-MM-dd')
  )
  const allDays    = buildDaySummaries(dateRange, metricsByDate, foodByDate, weightByDate, actMins)
  const historical = allDays.filter(d => d.date < today)
  const yday       = historical.slice(-1)[0] ?? null

  // ── Coffee ────────────────────────────────────────────────────────────────
  const coffeeLogs     = coffeeRaw ?? []
  const coffeeCups     = coffeeLogs.reduce((s, l) => s + Number(l.cups), 0)
  const coffeeMg       = coffeeLogs.reduce((s, l) => s + (l.caffeine_mg ?? 0), 0)
  const lastCoffeeLog  = coffeeLogs.length > 0 ? coffeeLogs[coffeeLogs.length - 1] : null
  const lastCoffeeTime = lastCoffeeLog ? lastCoffeeLog.consumed_at.slice(11, 16) : null
  const lastCoffeeHour = lastCoffeeLog ? parseInt(lastCoffeeLog.consumed_at.slice(11, 13), 10) : null

  // ── Today ─────────────────────────────────────────────────────────────────
  const realMetrics  = metricsByDate[today] as HealthMetrics | null ?? null
  const todayFood    = foodByDate[today] ?? null
  const consumed     = todayFood?.calories ?? null
  const proteinToday = todayFood?.protein  ?? null
  const fatToday     = todayFood?.fat      ?? null
  const actMinsToday = actMins[today] ?? 0

  // ── Personal context ──────────────────────────────────────────────────────
  const latestWeightKg = latestWeightReal?.weight_kg ?? personalContext.weightCurrentKg ?? null
  const proteinTarget  = computeProteinTarget(personalContext, latestWeightKg, 140)

  const todayDescriptions = (todayFoodDesc ?? []) as Array<{ description: string; eaten_at: string | null }>
  const duckFound         = personalContext.hasDuckMeatReaction && detectDuckMeat(todayDescriptions.map(f => f.description))
  const eveningFruitFound = personalContext.eveningFruitContext && detectEveningFruit(todayDescriptions)

  // ── Engine ────────────────────────────────────────────────────────────────
  const checkinData  = checkinRaw?.[0] ?? null
  const engine       = runInsightEngine(allDays, today, checkinData)

  const coffeeInsights  = generateCoffeeInsights({ totalCaffeineMg: coffeeMg > 0 ? coffeeMg : null, lastCoffeeHour, hasCoffeeSensitivity: personalContext.hasCoffeeSensitivity })
  const foodObsInsights = generateFoodObservationInsights({ duckFound, eveningFruitFound })
  void [...foodObsInsights, ...coffeeInsights, ...engine.insights].slice(0, 5)

  const trendItems   = computeTrendItems(historical)
  const trendSummary = computeTrendSummary(trendItems)

  // ── Fallback recovery ─────────────────────────────────────────────────────
  const fallbackRecovery = engine.usingFallback
    ? [...historical].reverse().find(d => d.hrv != null || d.sleepMinutes != null)
    : undefined

  const widgetSleepH = realMetrics?.sleep_minutes != null
    ? realMetrics.sleep_minutes / 60
    : fallbackRecovery?.sleepMinutes != null ? fallbackRecovery.sleepMinutes / 60 : null
  const widgetHrv    = realMetrics?.hrv_ms ?? fallbackRecovery?.hrv ?? null
  const widgetWeight = latestWeightReal?.weight_kg ?? null

  // ── HRV/Sleep trends ──────────────────────────────────────────────────────
  const last7    = historical.slice(-7)
  const hrvSpark = last7.map(d => d.hrv).filter((v): v is number => v != null)
  const slpSpark = last7.map(d => d.sleepMinutes).filter((v): v is number => v != null).map(m => m / 60)
  const hrvTrendKey = hrvSpark.length >= 4 ? trendColor(hrvSpark, true)  : 'gray'
  const slpTrendKey = slpSpark.length >= 4 ? trendColor(slpSpark, true) : 'gray'

  // ── Yesterday ─────────────────────────────────────────────────────────────
  const ydayBurned  = yday ? ((yday.activeEnergy ?? 0) + (yday.restingEnergy ?? 0)) || null : null
  const ydayBalance = yday?.calories != null && ydayBurned != null && ydayBurned > 0
    ? Math.round(yday.calories - ydayBurned) : null

  // ── Daily rec (engines must run, output unused on this page) ──────────────
  const baselines = computeBaselines(historical)
  const bikeRides = (activitiesRaw ?? []).filter(r => r.activity_type === 'ride').map(r => r.start_time.slice(0, 10)).sort().reverse()
  const daysSinceLastBike = bikeRides.length > 0 ? differenceInCalendarDays(new Date(), new Date(bikeRides[0] + 'T12:00:00')) : null
  const d7ago = format(subDays(startOfDay(new Date()), 6), 'yyyy-MM-dd')
  const weeklyActivityMins = Object.entries(actMins).filter(([d]) => d >= d7ago && d <= today).reduce((s, [, m]) => s + m, 0)
  void generateDailyRecommendation({ todayHrv: realMetrics?.hrv_ms != null ? Number(realMetrics.hrv_ms) : null, hrv14dBaseline: baselines.hrv14d, todaySleepH: widgetSleepH, consumedKcal: consumed, proteinG: proteinToday, fatG: fatToday, historical, yday, weeklyActivityMins, daysSinceLastBike, proteinTargetG: proteinTarget.grams, personalContext })

  const latestSleepRecord = (sleepRecordRaw?.[0] ?? null) as SleepRecord | null
  const sleepContextSentence = getSleepContextSentence(latestSleepRecord)

  const verdictText  = VERDICT_TEXT[engine.todayReadiness]
  const verdictColor = VERDICT_COLOR[engine.todayReadiness]
  const hasMetrics   = widgetHrv != null || widgetSleepH != null || widgetWeight != null

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">

      {/* ═══════════════════════════════════════════════════════════════════
          TOP — 70vh split: LEFT verdict / RIGHT instruments + check-in
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row" style={{ minHeight: '70vh' }}>

        {/* LEFT — White — Verdict + Briefing */}
        <div className="flex-[65] flex flex-col justify-center px-6 sm:px-10 lg:px-14 py-10 lg:py-0">
          {/* Date — closer to verdict */}
          <p className="text-[10px] font-semibold text-[#888888] uppercase tracking-[0.15em] mb-5">
            {longDate}
          </p>

          {/* Verdict — tight leading, constrained width = stronger presence */}
          <h1
            className={cn(
              'font-display font-bold mb-5',
              'text-[3rem] sm:text-[4rem] lg:text-[6rem]',
              verdictColor,
            )}
            style={{ lineHeight: 0.92, letterSpacing: '-0.03em', maxWidth: '520px' }}
          >
            {verdictText}
          </h1>

          {/* Interpretation + Recommendation — one tight block */}
          <div className="space-y-1.5" style={{ maxWidth: '480px' }}>
            <p className="text-base text-[#888888] leading-snug">
              {engine.todayInterpretation}
            </p>
            <p className="text-base font-semibold text-[#0D0D0D] dark:text-zinc-200 leading-snug">
              {engine.todayRecommendation}
            </p>
            {sleepContextSentence && (
              <p className="text-sm text-[#888888] leading-snug">{sleepContextSentence}</p>
            )}
            {engine.usingFallback && (
              <p className="text-xs text-[#888888] pt-0.5">Using yesterday&apos;s recovery data</p>
            )}
          </div>
        </div>

        {/* RIGHT — Dark — Check-in + Instruments */}
        <div className="flex-[35] bg-[#0D0D0D] flex flex-col px-6 sm:px-8 lg:px-10 py-10 lg:py-12 gap-8">

          {/* ── Check-in — interactive, fixes the LOG no-op ── */}
          <CheckinPanel existingCheckin={checkinData} />

          {/* Divider */}
          {hasMetrics && <div className="border-t border-white/10" />}

          {/* ── Instruments — HRV, Sleep, Weight ── */}
          {hasMetrics && (
            <div className="flex flex-col gap-8">

              {widgetHrv != null && (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-[4rem] font-bold text-white tabular-nums leading-none">
                      {Math.round(Number(widgetHrv))}
                    </span>
                    <span className="text-sm text-white/30">ms</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.12em]">HRV</span>
                    <MetricInfo slug="hrv" />
                    {TREND_LABEL[hrvTrendKey] && (
                      <span className={cn('text-[10px] font-bold uppercase tracking-[0.12em]', TREND_CLS[hrvTrendKey])}>
                        {TREND_LABEL[hrvTrendKey]}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {widgetSleepH != null && (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-[4rem] font-bold text-white tabular-nums leading-none">
                      {widgetSleepH.toFixed(1)}
                    </span>
                    <span className="text-sm text-white/30">h</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.12em]">Sleep</span>
                    <MetricInfo slug="sleep" />
                    {TREND_LABEL[slpTrendKey] && (
                      <span className={cn('text-[10px] font-bold uppercase tracking-[0.12em]', TREND_CLS[slpTrendKey])}>
                        {TREND_LABEL[slpTrendKey]}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {widgetWeight != null && (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-[4rem] font-bold text-white tabular-nums leading-none">
                      {widgetWeight.toFixed(1)}
                    </span>
                    <span className="text-sm text-white/30">kg</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.12em]">Weight</span>
                    <MetricInfo slug="weight" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          BOTTOM — Unified Today Console (replaces both strip + old console)
      ═══════════════════════════════════════════════════════════════════ */}
      <TodayConsole
        todayCalories={consumed}
        todayProtein={proteinToday}
        actMinsToday={actMinsToday}
        coffeeCups={coffeeCups}
        coffeeMg={coffeeMg}
        lastCoffeeTime={lastCoffeeTime}
        currentWeight={widgetWeight}
        ydayCalories={yday?.calories ?? null}
        ydayBalance={ydayBalance}
        ydayProtein={yday?.protein ?? null}
        ydayActivityMinutes={yday?.activityMinutes ?? 0}
        trendItems={trendItems.slice(0, 3).map(t => ({
          label: t.label,
          direction: t.direction,
          sentiment: t.sentiment,
          value: t.value,
        }))}
        trendSummaryText={trendSummary.interpretation ?? ''}
      />

    </div>
  )
}
