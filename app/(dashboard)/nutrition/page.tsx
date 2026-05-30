export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, subDays, startOfDay } from 'date-fns'
import { CardContent } from '@/components/ui/card'
import { CalorieBalanceChart, type DayBalance } from '@/components/charts/calorie-balance-chart'
import { computeBalance, fmtKcal } from '@/lib/calculations/calorie-balance'
import { MetricInfo } from '@/components/ui/metric-info'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { loadPersonalContextSummary } from '@/lib/profile/context-loader'
import { computeProteinTarget } from '@/lib/profile/food-context'

function avg(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => v != null)
  if (!nums.length) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

export default async function NutritionPage() {
  const supabase = await createClient()

  const today = format(new Date(), 'yyyy-MM-dd')
  const dates = Array.from({ length: 7 }, (_, i) =>
    format(subDays(startOfDay(new Date()), 6 - i), 'yyyy-MM-dd')
  )
  const oldest = dates[0]

  const [personalContext, { data: latestWeightRaw }] = await Promise.all([
    loadPersonalContextSummary(supabase),
    supabase.from('weight_logs').select('weight_kg').order('date', { ascending: false }).limit(1).single(),
  ])
  const latestWeightKg = (latestWeightRaw?.weight_kg as number | null) ?? personalContext.weightCurrentKg ?? null
  const proteinTarget  = computeProteinTarget(personalContext, latestWeightKg, 140)

  const { data: metricsRaw } = await supabase
    .from('health_metrics')
    .select('date, active_energy_kcal, resting_energy_kcal')
    .gte('date', oldest).lte('date', today).order('date', { ascending: true })

  const { data: foodRaw } = await supabase
    .from('food_logs')
    .select('date, estimated_calories, protein_g, carbs_g, fat_g')
    .gte('date', oldest).lte('date', today)

  const metricsByDate: Record<string, { active: number | null; resting: number | null }> = {}
  for (const row of metricsRaw ?? []) {
    metricsByDate[row.date] = { active: row.active_energy_kcal ?? null, resting: row.resting_energy_kcal ?? null }
  }

  interface FoodDay { calories: number; protein: number; carbs: number; fat: number; entries: number }
  const foodByDate: Record<string, FoodDay> = {}
  for (const row of foodRaw ?? []) {
    if (!foodByDate[row.date]) foodByDate[row.date] = { calories: 0, protein: 0, carbs: 0, fat: 0, entries: 0 }
    const d = foodByDate[row.date]
    d.calories += row.estimated_calories ?? 0
    d.protein  += row.protein_g  ?? 0
    d.carbs    += row.carbs_g    ?? 0
    d.fat      += row.fat_g      ?? 0
    d.entries  += 1
  }

  const chartData: DayBalance[] = dates.map(date => {
    const m = metricsByDate[date]
    const f = foodByDate[date]
    const consumed = f?.calories ?? null
    const burned   = m ? ((m.active ?? 0) + (m.resting ?? 0)) || null : null
    return {
      date:    format(new Date(date + 'T12:00:00'), 'MMM d'),
      consumed,
      burned,
      balance: consumed != null && burned != null ? consumed - burned : null,
    }
  })

  const todayMetrics  = metricsByDate[today] ?? null
  const todayFood     = foodByDate[today]    ?? null
  const todayConsumed = todayFood?.calories  ?? null
  const todayActive   = todayMetrics?.active  ?? null
  const todayResting  = todayMetrics?.resting ?? null
  const todayBalance  = computeBalance(todayConsumed, todayActive, todayResting)
  const burnAvailable = todayBalance.burned != null

  const allConsumed = dates.map(d => foodByDate[d]?.calories ?? null)
  const allBurned   = dates.map(d => {
    const m = metricsByDate[d]
    return m ? ((m.active ?? 0) + (m.resting ?? 0)) || null : null
  })
  const allBalances = chartData.map(d => d.balance)
  const allProtein  = dates.map(d => foodByDate[d]?.protein ?? null)

  const avgConsumed = avg(allConsumed)
  const avgBurned   = avg(allBurned)
  const avgBalance  = avg(allBalances)
  const avgProtein  = avg(allProtein)

  const todayProtein = todayFood ? Math.round(todayFood.protein) : null
  const todayCarbs   = todayFood ? Math.round(todayFood.carbs)   : null
  const todayFat     = todayFood ? Math.round(todayFood.fat)     : null

  // Protein progress
  const proteinPct = proteinTarget.grams && todayProtein
    ? Math.min(100, Math.round((todayProtein / proteinTarget.grams) * 100))
    : null
  const proteinReached = proteinPct != null && proteinPct >= 100

  return (
    <div className="space-y-8">
      {/* Page header */}
      <p className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Nutrition</p>

      {/* ── TODAY HERO ──────────────────────────────────────────────────────── */}
      <div className="space-y-5">

        {/* Calorie hero — dominant number */}
        <div>
          <div className="flex items-end gap-3">
            <p className="text-6xl font-black text-gray-900 dark:text-zinc-50 tabular-nums leading-none">
              {todayConsumed != null ? fmtKcal(todayConsumed) : '—'}
            </p>
            <div className="pb-1.5">
              <p className="text-sm text-gray-400 dark:text-zinc-500">kcal today</p>
              {burnAvailable && (
                <p className={cn('text-sm font-semibold', todayBalance.textColor)}>
                  {todayBalance.statusLabel} balance
                </p>
              )}
            </div>
          </div>

          {!burnAvailable && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500">
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
              Burn data pending from Apple Health
            </p>
          )}

          {burnAvailable && (
            <p className="mt-1.5 text-sm text-gray-500 dark:text-zinc-400">
              {fmtKcal(todayBalance.burned)} burned
              {todayActive != null && ` · ${fmtKcal(todayActive)} active`}
            </p>
          )}
        </div>

        {/* Macros — flat, no card */}
        {(todayProtein != null || todayCarbs != null || todayFat != null) && (
          <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-zinc-800">

            {/* Protein — with target */}
            {todayProtein != null && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Protein</span>
                    <MetricInfo slug="protein" />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">{todayProtein}g</span>
                    {proteinTarget.grams && (
                      <span className={cn(
                        'text-sm font-medium',
                        proteinReached ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400 dark:text-zinc-500',
                      )}>/ {proteinTarget.grams}g</span>
                    )}
                  </div>
                </div>
                {proteinPct != null && (
                  <div className="h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', proteinReached ? 'bg-emerald-500' : 'bg-blue-500')}
                      style={{ width: `${proteinPct}%` }}
                    />
                  </div>
                )}
                {proteinTarget.source === 'profile' && (
                  <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-1">
                    {proteinTarget.gPerKg} g/kg · from health profile
                  </p>
                )}
              </div>
            )}

            {/* Carbs + Fat — side by side, no target bar */}
            <div className="grid grid-cols-2 gap-4">
              {todayCarbs != null && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mb-0.5">Carbs</p>
                  <p className="text-2xl font-bold text-amber-500 dark:text-amber-400 tabular-nums">{todayCarbs}<span className="text-sm font-normal ml-0.5">g</span></p>
                </div>
              )}
              {todayFat != null && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mb-0.5">Fat</p>
                  <p className="text-2xl font-bold text-orange-500 dark:text-orange-400 tabular-nums">{todayFat}<span className="text-sm font-normal ml-0.5">g</span></p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 7-DAY CHART ─────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">7-Day history</p>
          <MetricInfo slug="calorie-balance" />
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800">
          <CardContent className="px-2 pb-4 pt-4">
            <CalorieBalanceChart data={chartData} />
          </CardContent>
        </div>

        {/* Averages — inline below chart */}
        {(avgConsumed || avgBurned || avgProtein) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1">
            {avgConsumed != null && (
              <p className="text-xs text-gray-400 dark:text-zinc-500">
                Avg consumed: <span className="font-semibold text-gray-700 dark:text-zinc-300">{fmtKcal(avgConsumed)}</span>
              </p>
            )}
            {avgBurned != null && (
              <p className="text-xs text-gray-400 dark:text-zinc-500">
                Avg burned: <span className="font-semibold text-gray-700 dark:text-zinc-300">{fmtKcal(avgBurned)}</span>
              </p>
            )}
            {avgBalance != null && (
              <p className="text-xs text-gray-400 dark:text-zinc-500">
                Avg balance: <span className={cn(
                  'font-semibold',
                  avgBalance > 150 ? 'text-rose-600 dark:text-rose-400'
                  : avgBalance < -800 ? 'text-orange-600 dark:text-orange-400'
                  : 'text-gray-700 dark:text-zinc-300',
                )}>{avgBalance > 0 ? '+' : ''}{fmtKcal(avgBalance)}</span>
              </p>
            )}
            {avgProtein != null && (
              <p className="text-xs text-gray-400 dark:text-zinc-500">
                Avg protein: <span className="font-semibold text-gray-700 dark:text-zinc-300">{avgProtein}g</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── DAILY BREAKDOWN — compact, de-emphasized ─────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-3">Daily breakdown</p>
        <div className="divide-y divide-gray-100 dark:divide-zinc-800">
          {[...dates].reverse().map(date => {
            const m = metricsByDate[date]
            const f = foodByDate[date]
            const c = f?.calories ?? null
            const b = m ? ((m.active ?? 0) + (m.resting ?? 0)) || null : null
            const bal = c != null && b != null ? c - b : null
            const { textColor } = computeBalance(c, m?.active ?? null, m?.resting ?? null)
            const isToday = date === today
            return (
              <div key={date} className={cn(
                'flex items-center justify-between py-2.5 px-1',
                isToday && 'text-blue-600 dark:text-blue-400',
              )}>
                <p className={cn('text-sm', isToday ? 'font-semibold text-gray-900 dark:text-zinc-100' : 'text-gray-500 dark:text-zinc-400')}>
                  {format(new Date(date + 'T12:00:00'), 'EEE, d MMM')}
                  {isToday && <span className="ml-1.5 text-[10px] font-bold text-blue-500 uppercase tracking-widest">Today</span>}
                </p>
                <div className="flex items-center gap-4 text-xs tabular-nums">
                  <span className="text-gray-600 dark:text-zinc-400">{fmtKcal(c)}</span>
                  <span className="text-gray-400 dark:text-zinc-600 w-14 text-right">{fmtKcal(b)}</span>
                  <span className={cn('w-16 text-right font-medium', bal != null ? textColor : 'text-gray-300 dark:text-zinc-700')}>
                    {bal != null ? `${bal > 0 ? '+' : ''}${bal.toLocaleString()}` : '—'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
