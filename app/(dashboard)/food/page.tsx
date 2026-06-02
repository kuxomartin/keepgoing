export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, subDays, parseISO } from 'date-fns'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { FoodLog, CoffeeLog } from '@/types/database'
import { coffeeLabel } from '@/lib/coffee/types'
import { cn } from '@/lib/utils'
import { AddMealForm } from '@/components/food/add-meal-form'
import { AddCoffeeForm } from '@/components/coffee/add-coffee-form'
import { DateNavStrip } from '@/components/food/date-nav-strip'
import {
  runNutritionIntelligence,
  analyzeSupplements,
  type NutritionInsight,
  type SupplementSuggestion,
  type DayBalance,
} from '@/lib/nutrition/intelligence'
import { computeTodayNutritionStatus } from '@/lib/nutrition/today-status'
import { NutritionStatusSection } from '@/components/nutrition/nutrition-status-section'
import { computeMissingFoods } from '@/lib/nutrition/missing-foods'
import { computeFoodDiversityReport } from '@/lib/nutrition/food-diversity'

interface PageProps {
  searchParams: Promise<{ date?: string; add?: string }>
}

type TimelineEntry =
  | { type: 'food';   time: Date | null; food: FoodLog   }
  | { type: 'coffee'; time: Date | null; coffee: CoffeeLog }

function fmtTime(d: Date | null): string | null {
  if (!d) return null
  try { return format(d, 'HH:mm') } catch { return null }
}

// ── Verdict — uses balance for completed past days ────────────────────────────
function getIntakeVerdict(
  intakeKcal: number | null,
  balanceKcal: number | null,
  proteinG: number,
  totalCoffeeMg: number,
  isToday: boolean,
): { verdict: string; explanation: string } {
  if (intakeKcal == null || intakeKcal === 0) {
    return { verdict: 'No meals logged.', explanation: 'Nothing logged for this date.' }
  }
  if (totalCoffeeMg >= 400) {
    return {
      verdict: 'Caffeine already high.',
      explanation: `Caffeine intake reached ${totalCoffeeMg}mg — above the 400mg daily recommendation.`,
    }
  }
  // Past day with balance data → use balance for verdict
  if (!isToday && balanceKcal != null) {
    if (balanceKcal <= -700) return { verdict: 'Large calorie deficit.', explanation: 'Intake was substantially below energy expenditure.' }
    if (balanceKcal <= -300) return { verdict: 'Calorie deficit.', explanation: 'Intake was below estimated expenditure for the day.' }
    if (balanceKcal >= 700)  return { verdict: 'Calorie surplus.', explanation: 'Calorie intake exceeded estimated energy expenditure.' }
    if (balanceKcal >= 300)  return { verdict: 'Slight calorie surplus.', explanation: 'Intake slightly exceeded estimated daily expenditure.' }
    if (proteinG > 0 && proteinG < 100) return { verdict: 'Protein target missed.', explanation: 'Protein intake was below the recommended daily target.' }
    return { verdict: 'Nutrition on track.', explanation: 'Energy intake was well balanced for the day.' }
  }
  // Today or no burn data
  if (proteinG > 0 && proteinG < 100) {
    return { verdict: 'Protein target missed.', explanation: 'Protein intake is below the recommended daily target.' }
  }
  if (isToday && intakeKcal < 1000) {
    return { verdict: 'Food intake still incomplete.', explanation: 'Intake appears low — log more meals to complete the picture.' }
  }
  return { verdict: 'Nutrition on track.', explanation: isToday ? 'Meals logged. Balance calculated once the day is complete.' : 'Energy intake was on track for the day.' }
}

// ── Energy balance interpretation ─────────────────────────────────────────────
function getBalanceInterpretation(balance: number | null, isToday: boolean): string {
  if (isToday) return 'Day still in progress — burn data will be complete tomorrow.'
  if (balance == null) return 'Burn data unavailable for this date.'
  if (balance <= -700) return 'Large calorie deficit.'
  if (balance <= -300) return 'Moderate calorie deficit.'
  if (balance >= -100 && balance <= 200) return 'Near maintenance.'
  if (balance < -100) return 'Near maintenance.'
  if (balance <= 500) return 'Moderate calorie surplus.'
  return 'Calorie surplus.'
}

// ── Confidence colours ────────────────────────────────────────────────────────
const CONF_CLS: Record<string, string> = {
  HIGH:   'text-[#E5173F]',
  MEDIUM: 'text-[#FFB000]',
  LOW:    'text-white/30',
}

function InsightCard({ insight }: { insight: NutritionInsight }) {
  return (
    <div className="bg-[#272D35] border border-white/[0.06]">
      <div className="px-7 pt-7 pb-5 border-b border-white/[0.06]">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-bold text-white uppercase leading-tight"
              style={{ fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
            {insight.headline}
          </h3>
          <span className={cn('text-[10px] font-black uppercase tracking-[0.2em] flex-shrink-0 mt-0.5', CONF_CLS[insight.confidence])}>
            {insight.confidence}
          </span>
        </div>
      </div>
      <div className="px-7 py-5 border-b border-white/[0.06]">
        <p className="text-sm text-white/70 leading-relaxed">{insight.evidence}</p>
      </div>
      <div className="px-7 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-1.5">Potential impact</p>
          <p className="text-sm text-white/50 leading-relaxed">{insight.impact}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-1.5">Try</p>
          <p className="text-sm text-white/70 leading-relaxed">{insight.action}</p>
        </div>
      </div>
    </div>
  )
}

function SupplementCard({ s }: { s: SupplementSuggestion }) {
  return (
    <div className="bg-[#272D35] border border-white/[0.06]">
      <div className="px-7 pt-7 pb-5 border-b border-white/[0.06]">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-bold text-white uppercase leading-tight"
              style={{ fontSize: '1.125rem', letterSpacing: '-0.01em' }}>
            {s.name}
          </h3>
          <span className={cn('text-[10px] font-black uppercase tracking-[0.2em] flex-shrink-0 mt-0.5', CONF_CLS[s.confidence])}>
            {s.confidence}
          </span>
        </div>
      </div>
      <div className="px-7 py-5">
        <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-1.5">Reason</p>
        <p className="text-sm text-white/60 leading-relaxed">{s.reason}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function FoodPage({ searchParams }: PageProps) {
  const { date: dateParam, add } = await searchParams
  const today        = format(new Date(), 'yyyy-MM-dd')
  const yesterday    = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const selectedDate = dateParam || today
  const isToday      = selectedDate === today
  const supabase     = await createClient()

  // Rolling window bounds for intelligence (always from today)
  const date30dAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')
  const date14dAgo = format(subDays(new Date(), 14), 'yyyy-MM-dd')

  const [
    // ── Selected date: all page data ─────────────────────────────────────────
    { data: rawLogs },
    { data: coffeeRaw },
    { data: metricsRaw },          // burn data for selectedDate

    // ── Intelligence: rolling 30d from TODAY ────────────────────────────────
    { data: food30dRaw },
    { data: coffee14dRaw },
    { data: metrics14dRaw },
    { data: weightRecentRaw },
    activities30dResult,

    // ── Modal data ──────────────────────────────────────────────────────────
    recentMealsResult,
    yesterdayMealsResult,
  ] = await Promise.all([
    // Selected date food + coffee (used for BOTH hero and timeline)
    supabase.from('food_logs').select('*').eq('date', selectedDate)
      .order('eaten_at', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('coffee_logs').select('*').eq('date', selectedDate)
      .order('consumed_at', { ascending: true }),
    // Selected date burn (for energy balance)
    supabase.from('health_metrics')
      .select('active_energy_kcal, resting_energy_kcal')
      .eq('date', selectedDate)
      .order('source', { ascending: true })
      .limit(5),

    // Intelligence — always rolling from today, independent of selectedDate
    supabase.from('food_logs')
      .select('id, date, description, protein_g, estimated_calories')
      .gte('date', date30dAgo).lte('date', today)
      .order('date', { ascending: true }),
    supabase.from('coffee_logs')
      .select('id, date, consumed_at, caffeine_mg')
      .gte('date', date14dAgo).lte('date', today),
    supabase.from('health_metrics')
      .select('date, active_energy_kcal, resting_energy_kcal')
      .gte('date', date14dAgo).lte('date', today)
      .order('date', { ascending: true }),
    supabase.from('weight_logs')
      .select('weight_kg')
      .order('date', { ascending: false })
      .limit(1),
    supabase.from('activities')
      .select('id', { count: 'exact', head: true })
      .gte('start_time', new Date(date30dAgo).toISOString()),

    // Modal
    add === 'meal'
      ? supabase.from('food_logs').select('*').order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: null }),
    add === 'meal'
      ? supabase.from('food_logs').select('*').eq('date', yesterday).order('created_at', { ascending: true })
      : Promise.resolve({ data: null }),
  ])

  // ── Derive everything from selectedDate data ──────────────────────────────
  const logs: FoodLog[]         = (rawLogs   ?? []) as FoodLog[]
  const coffeeLogs: CoffeeLog[] = (coffeeRaw ?? []) as CoffeeLog[]

  const totalCalories = logs.reduce((s, f) => s + (f.estimated_calories ?? 0), 0)
  const totalProtein  = logs.reduce((s, f) => s + (f.protein_g  ?? 0), 0)
  const totalCoffeeMg = coffeeLogs.reduce((s, c) => s + (c.caffeine_mg ?? 0), 0)
  const intakeKcal    = totalCalories > 0 ? totalCalories : null

  // Energy balance for selectedDate
  let activeEnergy: number | null  = null
  let restingEnergy: number | null = null
  for (const m of metricsRaw ?? []) {
    if (activeEnergy  == null && (m as { active_energy_kcal?: number }).active_energy_kcal  != null)
      activeEnergy  = (m as { active_energy_kcal: number }).active_energy_kcal
    if (restingEnergy == null && (m as { resting_energy_kcal?: number }).resting_energy_kcal != null)
      restingEnergy = (m as { resting_energy_kcal: number }).resting_energy_kcal
  }
  const burnedKcal  = activeEnergy != null || restingEnergy != null ? (activeEnergy ?? 0) + (restingEnergy ?? 0) : null
  const balanceKcal = intakeKcal != null && burnedKcal != null ? intakeKcal - burnedKcal : null

  const { verdict, explanation: verdictExplanation } =
    getIntakeVerdict(intakeKcal, balanceKcal, totalProtein, totalCoffeeMg, isToday)
  const balanceInterpretation = getBalanceInterpretation(balanceKcal, isToday)

  // ── Nutrition Intelligence (rolling from today, not selectedDate) ──────────
  let nutritionInsights: NutritionInsight[]   = []
  let supplementSuggestions: SupplementSuggestion[] = []

  if (food30dRaw) {
    const meals30d   = food30dRaw as FoodLog[]
    const coffees14d = (coffee14dRaw ?? []) as CoffeeLog[]
    const weightKg   = (weightRecentRaw?.[0] as { weight_kg: number } | undefined)?.weight_kg ?? 80

    const burnByDate: Record<string, number> = {}
    for (const m of metrics14dRaw ?? []) {
      const row = m as { date: string; active_energy_kcal?: number; resting_energy_kcal?: number }
      burnByDate[row.date] = (row.active_energy_kcal ?? 0) + (row.resting_energy_kcal ?? 0)
    }
    const foodByDate: Record<string, number> = {}
    for (const f of meals30d) {
      if (f.date >= date14dAgo) foodByDate[f.date] = (foodByDate[f.date] ?? 0) + (f.estimated_calories ?? 0)
    }

    const balanceDays: DayBalance[] = Array.from({ length: 14 }, (_, i) => {
      const d = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd')
      return { date: d, intake: foodByDate[d] ?? null, burn: burnByDate[d] ?? null }
    })

    nutritionInsights = runNutritionIntelligence({ meals30d, coffeeLogs14d: coffees14d, balanceDays, weightKg, today })

    const hasFishRecent = meals30d.some(m =>
      m.date >= format(subDays(new Date(), 21), 'yyyy-MM-dd') &&
      ['fish','salmon','tuna','sardine','mackerel','trout','seafood','cod','herring','sea bass','losos','ryba']
        .some(k => m.description.toLowerCase().includes(k))
    )
    const avgCaffeine          = coffees14d.length > 0 ? coffees14d.reduce((s, c) => s + (c.caffeine_mg ?? 0), 0) / 14 : 0
    const actCount             = (activities30dResult as unknown as { count?: number } | null)
    const weeklyActivityCount  = Math.round(((actCount?.count ?? 0) as number) / 4.3)

    supplementSuggestions = analyzeSupplements({
      hasFishRecent,
      weeklyActivityCount,
      avgDailyCaffeineMg: avgCaffeine,
      month: new Date().getMonth() + 1,
    })
  }

  // ── Today Nutrition Status (only when viewing today) ─────────────────────
  const todayFoodDescriptions = isToday ? logs.map(f => f.description) : []
  const lastCoffeeFoodPage    = isToday && coffeeLogs.length > 0
    ? coffeeLogs[coffeeLogs.length - 1]
    : null
  const lastCoffeeHourFoodPage = lastCoffeeFoodPage
    ? parseInt(lastCoffeeFoodPage.consumed_at.slice(11, 13), 10)
    : null
  const weightKgFoodPage = (weightRecentRaw?.[0] as { weight_kg: number } | undefined)?.weight_kg ?? 80
  const proteinTargetFoodPage = Math.round(weightKgFoodPage * 1.6)

  const nutritionStatusItems = isToday ? computeTodayNutritionStatus({
    calories:         intakeKcal,
    calorieTarget:    2000,
    protein:          totalProtein > 0 ? totalProtein : null,
    proteinTargetG:   proteinTargetFoodPage,
    coffeeMg:         totalCoffeeMg > 0 ? totalCoffeeMg : null,
    lastCoffeeHour:   lastCoffeeHourFoodPage,
    foodDescriptions: todayFoodDescriptions,
  }) : []

  const foodPlanContext = {
    foodDescriptions:  todayFoodDescriptions,
    caloriesConsumed:  intakeKcal ?? 0,
    proteinConsumed:   totalProtein,
    calorieTarget:     2000,
    proteinTarget:     proteinTargetFoodPage,
    coffeeMg:          totalCoffeeMg,
    recoveryScore:     null as number | null,
    sleepH:            null as number | null,
    todayTraining:     null as string | null,
  }

  // ── Missing Foods (always from today's 30d window) ────────────────────────
  const allFoodEntries = (food30dRaw ?? []).map(f => ({
    date: f.date,
    description: f.description ?? '',
  }))
  const missingFoods = computeMissingFoods(allFoodEntries, today)

  // ── Food Diversity Report (always from 30d window) ────────────────────────
  const allDescriptions30d = (food30dRaw ?? []).map(f => f.description ?? '')
  const diversityReport    = computeFoodDiversityReport(allDescriptions30d)

  // ── Modal recent meals ────────────────────────────────────────────────────
  const seen = new Set<string>()
  const recentMeals: FoodLog[] = []
  for (const row of (recentMealsResult?.data ?? []) as FoodLog[]) {
    const key = row.description.toLowerCase().trim()
    if (!seen.has(key) && recentMeals.length < 10) { seen.add(key); recentMeals.push(row) }
  }
  const yesterdayMeals = (yesterdayMealsResult?.data ?? []) as FoodLog[]

  // ── Timeline ──────────────────────────────────────────────────────────────
  const entries: TimelineEntry[] = [
    ...logs.map(f => ({ type: 'food'   as const, time: f.eaten_at    ? new Date(f.eaten_at)    : null, food: f })),
    ...coffeeLogs.map(c => ({ type: 'coffee' as const, time: c.consumed_at ? new Date(c.consumed_at) : null, coffee: c })),
  ].sort((a, b) => {
    if (!a.time && !b.time) return 0
    if (!a.time) return 1
    if (!b.time) return -1
    return a.time.getTime() - b.time.getTime()
  })

  const dateLabel        = isToday ? 'Today' : format(parseISO(selectedDate), 'EEE, d MMM')
  const balanceDateLabel = isToday
    ? `Today · ${format(parseISO(selectedDate), 'd MMM')} (in progress)`
    : format(parseISO(selectedDate), 'EEE, d MMM')
  const modalReturnTo    = `/food?date=${selectedDate}`

  const showIntelligence  = nutritionInsights.length > 0 || supplementSuggestions.length > 0
  const highSupplements   = supplementSuggestions.filter(s => s.confidence === 'HIGH')
  const mediumSupplements = supplementSuggestions.filter(s => s.confidence === 'MEDIUM')

  return (
    <>
    <div className="flex flex-col bg-[#1B2128] min-h-screen">

      {/* ═══════════════════════════════════════════════════════════════════
          DATE STRIP — compact single row
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="max-w-[1200px] mx-auto w-full px-6 sm:px-10 lg:px-16 pt-6 pb-0">
        <DateNavStrip selectedDate={selectedDate} />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO — verdict + metrics for selectedDate
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="max-w-[1200px] mx-auto w-full px-6 sm:px-10 lg:px-16 pt-8 pb-8">

        <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.15em] mb-4">
          Intake · {dateLabel}
        </p>

        <h1 className="font-display font-bold text-white leading-tight mb-2"
            style={{ fontSize: 'clamp(1.75rem, 5vw, 3.5rem)' }}>
          {verdict}
        </h1>

        <p className="text-sm text-white/40 leading-relaxed max-w-lg mb-7">{verdictExplanation}</p>

        {/* Metrics row */}
        {(intakeKcal != null || totalProtein > 0 || totalCoffeeMg > 0) && (
          <div className="flex flex-wrap gap-x-10 gap-y-4 mb-7">
            {intakeKcal != null && (
              <div>
                <p className="font-mono font-bold text-white tabular-nums leading-none text-3xl sm:text-4xl">
                  {Math.round(intakeKcal).toLocaleString()}
                </p>
                <p className="text-[10px] text-white/30 uppercase tracking-[0.12em] mt-1.5">kcal</p>
              </div>
            )}
            {totalProtein > 0 && (
              <div>
                <p className="font-mono font-bold text-white tabular-nums leading-none text-3xl sm:text-4xl">
                  {Math.round(totalProtein)}
                </p>
                <p className="text-[10px] text-white/30 uppercase tracking-[0.12em] mt-1.5">g protein</p>
              </div>
            )}
            {totalCoffeeMg > 0 && (
              <div>
                <p className="font-mono font-bold text-white tabular-nums leading-none text-3xl sm:text-4xl">
                  {totalCoffeeMg}
                </p>
                <p className="text-[10px] text-white/30 uppercase tracking-[0.12em] mt-1.5">mg caffeine</p>
              </div>
            )}
          </div>
        )}

        {/* Action row — logs to selectedDate */}
        <div className="flex items-center gap-3">
          <Link
            href={`/food?date=${selectedDate}&add=meal`}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-white/[0.15] text-white/60 hover:text-white hover:border-white/35 text-sm font-semibold transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Meal
          </Link>
          <Link
            href={`/food?date=${selectedDate}&add=coffee`}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-white/[0.10] text-white/40 hover:text-white/70 hover:border-white/25 text-sm font-semibold transition-colors"
          >
            <span className="text-sm">☕</span>
            Log Coffee
          </Link>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TODAY NUTRITION STATUS — rule-based, today only
      ═══════════════════════════════════════════════════════════════════ */}
      {isToday && (
        <div className="bg-[#272D35] border-t border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-10">
            <NutritionStatusSection
              statusItems={nutritionStatusItems}
              planContext={foodPlanContext}
            />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ENERGY BALANCE — selectedDate
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#272D35] border-t border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-6">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-4">
            Energy Balance · {balanceDateLabel}
          </p>

          <div className="grid grid-cols-3 divide-x divide-white/[0.06] mb-4">
            <div className="pr-6 sm:pr-8">
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1.5">Intake</p>
              <p className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-white">
                {intakeKcal != null ? Math.round(intakeKcal).toLocaleString() : '—'}
              </p>
              <p className="text-[10px] text-white/20 mt-0.5">kcal logged</p>
            </div>
            <div className="px-6 sm:px-8">
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1.5">Burn</p>
              <p className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-white">
                {burnedKcal != null ? Math.round(burnedKcal).toLocaleString() : '—'}
              </p>
              <p className="text-[10px] text-white/20 mt-0.5">
                {burnedKcal != null
                  ? (activeEnergy != null && restingEnergy != null
                    ? `${Math.round(activeEnergy)} + ${Math.round(restingEnergy)}`
                    : 'from Apple Health')
                  : 'Pending'}
              </p>
            </div>
            <div className="pl-6 sm:pl-8">
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1.5">Balance</p>
              <p className={cn(
                'font-mono text-xl sm:text-2xl font-bold tabular-nums',
                balanceKcal == null ? 'text-white/25'
                  : balanceKcal < -800 ? 'text-[#FFB000]'
                  : balanceKcal > 600  ? 'text-[#FF7A00]'
                  : 'text-white'
              )}>
                {balanceKcal != null
                  ? `${balanceKcal > 0 ? '+' : ''}${Math.round(balanceKcal).toLocaleString()}`
                  : '—'}
              </p>
              <p className="text-[10px] text-white/20 mt-0.5">kcal</p>
            </div>
          </div>

          <p className="text-sm text-white/40 leading-relaxed">{balanceInterpretation}</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          NUTRITION INTELLIGENCE + SUPPLEMENT ADVISOR
      ═══════════════════════════════════════════════════════════════════ */}
      {showIntelligence && (
        <div className="border-t border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-10">

            <div className="mb-8">
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.18em] mb-3">
                Nutrition Intelligence
              </p>
              <h2 className="font-black text-white text-2xl sm:text-3xl" style={{ lineHeight: 1.0 }}>
                Pattern analysis from the last 30 days.
              </h2>
              <p className="text-sm text-white/35 mt-2">Rule-based findings. Not a diagnosis.</p>
            </div>

            {nutritionInsights.length > 0 && (
              <div className={cn(
                'grid gap-4 mb-10',
                nutritionInsights.length === 1 ? 'grid-cols-1 max-w-2xl' : 'grid-cols-1 lg:grid-cols-2'
              )}>
                {nutritionInsights.map(insight => <InsightCard key={insight.id} insight={insight} />)}
              </div>
            )}

            {supplementSuggestions.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.18em] mb-6">
                  Supplement Advisor
                </p>
                {highSupplements.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[10px] font-bold text-[#E5173F] uppercase tracking-[0.15em] mb-3">High Confidence</p>
                    <div className={cn('grid gap-4', highSupplements.length === 1 ? 'grid-cols-1 max-w-2xl' : 'grid-cols-1 sm:grid-cols-2')}>
                      {highSupplements.map(s => <SupplementCard key={s.id} s={s} />)}
                    </div>
                  </div>
                )}
                {mediumSupplements.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[#FFB000] uppercase tracking-[0.15em] mb-3">Medium Confidence</p>
                    <div className={cn('grid gap-4', mediumSupplements.length === 1 ? 'grid-cols-1 max-w-2xl' : 'grid-cols-1 sm:grid-cols-2')}>
                      {mediumSupplements.map(s => <SupplementCard key={s.id} s={s} />)}
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-white/20 mt-6 max-w-xl leading-relaxed">
                  Evidence-based suggestions, not medical advice. Consult a healthcare professional before starting any supplement.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MISSING FOODS — always visible when there are gaps
      ═══════════════════════════════════════════════════════════════════ */}
      {missingFoods.length > 0 && (
        <div className="bg-[#20252B] border-t border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-10">

            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.18em] mb-6">
              Missing Foods · Last 30 Days
            </p>

            <div className="space-y-3">
              {missingFoods.map(item => (
                <div key={item.key} className="flex items-start gap-3">
                  <span className="text-[#FFB800] font-bold text-sm leading-none flex-shrink-0 mt-0.5">⚠</span>
                  <div>
                    <p className="text-sm text-white/70 leading-snug">{item.label}</p>
                    {item.detail && (
                      <p className="font-mono text-xs text-white/30 mt-0.5">{item.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          FOOD DIVERSITY REPORT — 30-day analysis
      ═══════════════════════════════════════════════════════════════════ */}
      {diversityReport.totalEntries >= 5 && (
        <div className="bg-[#272D35] border-t border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16 py-10">

            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.18em] mb-6">
              Food Diversity · Last 30 Days
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

              {/* Left: protein sources + plant diversity */}
              <div className="space-y-8">

                {diversityReport.proteinSources.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-4">
                      Protein Sources
                    </p>
                    <div className="space-y-2.5">
                      {diversityReport.proteinSources.map(p => (
                        <div key={p.name} className="flex items-center gap-3">
                          <p className="text-sm text-white/60 w-32 flex-shrink-0">{p.name}</p>
                          <div className="flex-1 h-1 bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full bg-white/30"
                              style={{ width: `${p.percent}%` }}
                            />
                          </div>
                          <p className="font-mono text-xs text-white/30 w-8 text-right flex-shrink-0">
                            {p.percent}%
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-4">
                    Plant Diversity
                  </p>
                  <div className="flex gap-8">
                    <div>
                      <p className="font-mono text-3xl font-bold text-white tabular-nums leading-none">
                        {diversityReport.distinctVegetables}
                      </p>
                      <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] mt-1.5">Vegetables</p>
                    </div>
                    <div>
                      <p className="font-mono text-3xl font-bold text-white tabular-nums leading-none">
                        {diversityReport.distinctFruits}
                      </p>
                      <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] mt-1.5">Fruits</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-4">
                    Meal Composition
                  </p>
                  <div className="flex gap-8">
                    <div>
                      <p className="font-mono text-3xl font-bold text-white tabular-nums leading-none">
                        {diversityReport.animalBasedPercent}%
                      </p>
                      <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] mt-1.5">Animal-based</p>
                    </div>
                    <div>
                      <p className="font-mono text-3xl font-bold text-white tabular-nums leading-none">
                        {diversityReport.plantBasedPercent}%
                      </p>
                      <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] mt-1.5">Plant-based</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: assessment */}
              <div className="space-y-6">
                {diversityReport.strengths.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-3">
                      Strengths
                    </p>
                    <div className="space-y-2">
                      {diversityReport.strengths.map((s, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="text-[#16A34A] font-bold text-sm leading-none flex-shrink-0 mt-0.5">✓</span>
                          <p className="text-sm text-white/65 leading-snug">{s}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {diversityReport.opportunities.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-3">
                      Opportunities
                    </p>
                    <div className="space-y-2">
                      {diversityReport.opportunities.map((o, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="text-[#FFB800] font-bold text-sm leading-none flex-shrink-0 mt-0.5">⚠</span>
                          <p className="text-sm text-white/65 leading-snug">{o}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-white/15 leading-relaxed max-w-xs">
                  Based on {diversityReport.totalEntries} food entries in the last 30 days.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TIMELINE — selectedDate
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="max-w-[1200px] mx-auto w-full px-6 sm:px-10 lg:px-16 py-8 flex-1">

        <div className="flex items-center gap-3 mb-5">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em]">Timeline</p>
          <span className="font-mono text-[10px] text-white/20">{dateLabel}</span>
        </div>

        {entries.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-white/25 text-sm mb-5">Nothing logged for {dateLabel}.</p>
            <Link href={`/food?date=${selectedDate}&add=meal`}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-white/[0.12] text-white/50 hover:text-white hover:border-white/30 text-sm font-semibold transition-colors">
              <Plus className="h-4 w-4" />
              Add meal
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => (
              entry.type === 'food' ? (
                <div key={i} className="bg-[#313943] border border-white/[0.06] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="text-[11px] font-mono text-white/30 tabular-nums flex-shrink-0">
                          {fmtTime(entry.time) ?? '—'}
                        </span>
                        <p className="text-sm font-medium text-white leading-snug truncate">
                          {entry.food.description}
                        </p>
                      </div>
                      {(entry.food.protein_g || entry.food.carbs_g || entry.food.fat_g) && (
                        <p className="text-xs font-mono text-white/30 tabular-nums ml-[52px]">
                          {[
                            entry.food.protein_g ? `P ${Math.round(entry.food.protein_g)}g` : null,
                            entry.food.carbs_g   ? `C ${Math.round(entry.food.carbs_g)}g`   : null,
                            entry.food.fat_g     ? `F ${Math.round(entry.food.fat_g)}g`     : null,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {entry.food.estimated_calories != null && (
                        <span className="font-mono text-sm font-semibold text-white tabular-nums">
                          {entry.food.estimated_calories}
                        </span>
                      )}
                      <Link href={`/food/${entry.food.id}/edit`}
                        className="text-[11px] text-white/25 hover:text-white/50 transition-colors">
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={i} className="bg-[#313943] border border-white/[0.06] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-white/30 tabular-nums flex-shrink-0">
                        {fmtTime(entry.time) ?? '—'}
                      </span>
                      <div>
                        <p className="text-sm text-white">
                          ☕ {coffeeLabel(entry.coffee.coffee_type)}
                          {Number(entry.coffee.cups) !== 1 && ` ×${entry.coffee.cups}`}
                        </p>
                        {entry.coffee.caffeine_mg != null && (
                          <p className="font-mono text-xs text-white/30">{entry.coffee.caffeine_mg}mg caffeine</p>
                        )}
                      </div>
                    </div>
                    <Link href={`/coffee/${entry.coffee.id}/edit`}
                      className="text-[11px] text-white/25 hover:text-white/50 transition-colors flex-shrink-0">
                      Edit
                    </Link>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>

    </div>

    {/* ═══════════════════════════════════════════════════════════════════
        ADD MEAL MODAL
    ═══════════════════════════════════════════════════════════════════ */}
    {add === 'meal' && (
      <>
        <div className="fixed inset-0 z-[450] bg-black/70" aria-hidden="true" />
        <div className="fixed inset-x-0 bottom-0 lg:inset-0 lg:flex lg:items-center lg:justify-center z-[500]">
          <div className="bg-[#313943] border-t lg:border border-white/[0.08] w-full lg:max-w-lg lg:mx-4 max-h-[90vh] overflow-y-auto"
               style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
              <h2 className="text-base font-bold text-white">Add Meal</h2>
              <Link href={modalReturnTo} className="text-white/40 hover:text-white text-2xl leading-none transition-colors">×</Link>
            </div>
            <div className="px-5 py-4">
              <AddMealForm recentMeals={recentMeals} yesterdayMeals={yesterdayMeals} returnTo={modalReturnTo} />
            </div>
          </div>
        </div>
      </>
    )}

    {/* ═══════════════════════════════════════════════════════════════════
        LOG COFFEE MODAL
    ═══════════════════════════════════════════════════════════════════ */}
    {add === 'coffee' && (
      <>
        <div className="fixed inset-0 z-[450] bg-black/70" aria-hidden="true" />
        <div className="fixed inset-x-0 bottom-0 lg:inset-0 lg:flex lg:items-center lg:justify-center z-[500]">
          <div className="bg-[#313943] border-t lg:border border-white/[0.08] w-full lg:max-w-lg lg:mx-4 max-h-[90vh] overflow-y-auto"
               style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
              <h2 className="text-base font-bold text-white">Log Coffee</h2>
              <Link href={modalReturnTo} className="text-white/40 hover:text-white text-2xl leading-none transition-colors">×</Link>
            </div>
            <div className="px-5 py-4">
              <AddCoffeeForm returnTo={modalReturnTo} />
            </div>
          </div>
        </div>
      </>
    )}
    </>
  )
}
