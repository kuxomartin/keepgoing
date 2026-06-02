export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, subDays, startOfDay } from 'date-fns'
import { CalorieBalanceChart } from '@/components/charts/calorie-balance-chart'
import type { DayBalance } from '@/components/charts/calorie-balance-chart'
import { computeBalance, fmtKcal } from '@/lib/calculations/calorie-balance'
import { MetricInfo } from '@/components/ui/metric-info'
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

  interface FoodDay { calories: number; protein: number; carbs: number; fat: number }
  const foodByDate: Record<string, FoodDay> = {}
  for (const row of foodRaw ?? []) {
    if (!foodByDate[row.date]) foodByDate[row.date] = { calories: 0, protein: 0, carbs: 0, fat: 0 }
    const d = foodByDate[row.date]
    d.calories += row.estimated_calories ?? 0
    d.protein  += row.protein_g  ?? 0
    d.carbs    += row.carbs_g    ?? 0
    d.fat      += row.fat_g      ?? 0
  }

  const chartData: DayBalance[] = dates.map(date => {
    const m = metricsByDate[date]
    const f = foodByDate[date]
    const consumed = f?.calories ?? null
    const burned   = m ? ((m.active ?? 0) + (m.resting ?? 0)) || null : null
    return {
      date: format(new Date(date + 'T12:00:00'), 'MMM d'),
      consumed, burned,
      balance: consumed != null && burned != null ? consumed - burned : null,
    }
  })

  const todayMetrics  = metricsByDate[today] ?? null
  const todayFood     = foodByDate[today]    ?? null
  const todayConsumed = todayFood?.calories  ?? null
  const todayBalance  = computeBalance(todayConsumed, todayMetrics?.active ?? null, todayMetrics?.resting ?? null)
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

  const proteinPct     = proteinTarget.grams && todayProtein
    ? Math.min(100, Math.round((todayProtein / proteinTarget.grams) * 100)) : null
  const proteinReached = proteinPct != null && proteinPct >= 100

  return (
    <div>

      {/* ── HERO — Today's calories ────────────────────────────────────── */}
      <div className="bg-[#F2EDE6] dark:bg-zinc-900 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-6 pb-8 mb-0">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-6">Nutrition</p>

        <div className="flex items-baseline gap-3 mb-3">
          <span className="font-bold text-[#0D0D0D] dark:text-zinc-50 font-mono tabular-nums leading-none"
                style={{ fontSize: '5rem' }}>
            {todayConsumed != null ? fmtKcal(todayConsumed) : '—'}
          </span>
          <span className="text-lg text-[#888888]">kcal today</span>
        </div>

        {burnAvailable ? (
          <p className="text-sm text-[#888888]">
            <span className={cn('font-semibold', todayBalance.textColor)}>{todayBalance.statusLabel} balance</span>
            {' · '}{fmtKcal(todayBalance.burned)} burned
          </p>
        ) : (
          <p className="text-sm text-[#888888]">Burn data pending from Apple Health</p>
        )}
      </div>

      {/* ── MACROS — today ────────────────────────────────────────────── */}
      {(todayProtein != null || todayCarbs != null || todayFat != null) && (
        <div className="py-8 border-b border-[#D9D9D9] dark:border-zinc-800">

          {/* Protein — with progress */}
          {todayProtein != null && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Protein</span>
                  <MetricInfo slug="protein" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-[#0D0D0D] dark:text-zinc-50 font-mono tabular-nums">{todayProtein}g</span>
                  {proteinTarget.grams && (
                    <span className={cn('text-sm', proteinReached ? 'text-[#16A34A]' : 'text-[#888888]')}>
                      / {proteinTarget.grams}g
                    </span>
                  )}
                </div>
              </div>
              {proteinPct != null && (
                <div className="h-0.5 bg-[#D9D9D9] dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', proteinReached ? 'bg-[#16A34A]' : 'bg-[#20252B] dark:bg-zinc-100')}
                    style={{ width: `${proteinPct}%` }}
                  />
                </div>
              )}
              {proteinTarget.source === 'profile' && (
                <p className="text-[10px] text-[#888888] mt-1.5">{proteinTarget.gPerKg} g/kg · from health profile</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-8">
            {todayCarbs != null && (
              <div>
                <span className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Carbs</span>
                <p className="text-2xl font-bold text-[#0D0D0D] dark:text-zinc-50 font-mono tabular-nums mt-1">{todayCarbs}<span className="text-sm font-normal text-[#888888] ml-1">g</span></p>
              </div>
            )}
            {todayFat != null && (
              <div>
                <span className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Fat</span>
                <p className="text-2xl font-bold text-[#0D0D0D] dark:text-zinc-50 font-mono tabular-nums mt-1">{todayFat}<span className="text-sm font-normal text-[#888888] ml-1">g</span></p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 7-DAY CHART — no container ────────────────────────────────── */}
      <div className="py-8 border-b border-[#D9D9D9] dark:border-zinc-800">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">7-day history</span>
          <MetricInfo slug="calorie-balance" />
        </div>
        <div className="-mx-4 sm:-mx-6">
          <CalorieBalanceChart data={chartData} />
        </div>

        {/* 7-day averages */}
        {(avgConsumed || avgBurned || avgProtein) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-5 pt-5 border-t border-[#D9D9D9] dark:border-zinc-800">
            {avgConsumed != null && <p className="text-xs text-[#888888]">Avg intake: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-300">{fmtKcal(avgConsumed)}</span></p>}
            {avgBurned   != null && <p className="text-xs text-[#888888]">Avg burn: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-300">{fmtKcal(avgBurned)}</span></p>}
            {avgBalance  != null && <p className="text-xs text-[#888888]">Avg balance: <span className={cn('font-semibold', avgBalance > 150 ? 'text-[#D97706]' : avgBalance < -800 ? 'text-[#D97706]' : 'text-[#0D0D0D] dark:text-zinc-300')}>{avgBalance > 0 ? '+' : ''}{fmtKcal(avgBalance)}</span></p>}
            {avgProtein  != null && <p className="text-xs text-[#888888]">Avg protein: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-300">{avgProtein}g</span></p>}
          </div>
        )}
      </div>

      {/* ── DAILY BREAKDOWN — clean rows, no table headers ─────────────── */}
      <div className="py-8">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-5">Daily breakdown</p>
        <div>
          {[...dates].reverse().map((date, i) => {
            const m = metricsByDate[date]
            const f = foodByDate[date]
            const c = f?.calories ?? null
            const b = m ? ((m.active ?? 0) + (m.resting ?? 0)) || null : null
            const bal = c != null && b != null ? c - b : null
            const { textColor } = computeBalance(c, m?.active ?? null, m?.resting ?? null)
            const isToday = date === today
            return (
              <div key={date}>
                {i > 0 && <div className="border-t border-[#D9D9D9] dark:border-zinc-800" />}
                <div className={cn(
                  'flex items-center justify-between py-3',
                  isToday && 'font-semibold',
                )}>
                  <p className={cn('text-sm', isToday ? 'text-[#0D0D0D] dark:text-zinc-50' : 'text-[#888888]')}>
                    {format(new Date(date + 'T12:00:00'), 'EEE, d MMM')}
                    {isToday && <span className="ml-2 text-[10px] font-bold text-[#888888] uppercase tracking-widest">Today</span>}
                  </p>
                  <div className="flex items-center gap-6 text-sm font-mono tabular-nums">
                    <span className="text-[#0D0D0D] dark:text-zinc-200">{fmtKcal(c)}</span>
                    <span className="text-[#888888] w-16 text-right">{fmtKcal(b)}</span>
                    <span className={cn('w-16 text-right', bal != null ? textColor : 'text-[#888888]')}>
                      {bal != null ? `${bal > 0 ? '+' : ''}${bal.toLocaleString()}` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-[#888888] mt-3">Intake · Burn · Balance</p>
      </div>

    </div>
  )
}
