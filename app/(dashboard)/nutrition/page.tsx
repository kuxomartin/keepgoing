export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, subDays, startOfDay } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalorieBalanceChart, type DayBalance } from '@/components/charts/calorie-balance-chart'
import { computeBalance, fmtKcal } from '@/lib/calculations/calorie-balance'
import { MetricInfo } from '@/components/ui/metric-info'
import { Flame, Beef, Wheat, Droplets, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { loadPersonalContextSummary } from '@/lib/profile/context-loader'
import { computeProteinTarget } from '@/lib/profile/food-context'

function avg(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => v != null)
  if (!nums.length) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

function MacroBar({
  label, value, unit, color, target, icon,
}: {
  label: string; value: number | null; unit: string
  color: string; target?: number | null; icon: React.ReactNode
}) {
  const pct = target && value ? Math.min(100, Math.round((value / target) * 100)) : null
  const reached = pct != null && pct >= 100
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn('text-lg font-bold tabular-nums', color)}>
            {value != null ? `${Math.round(value)}g` : '—'}
          </span>
          {target && (
            <span className={cn(
              'text-xs font-medium',
              reached ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400 dark:text-zinc-500',
            )}>
              / {target}g
            </span>
          )}
        </div>
      </div>
      {pct != null && (
        <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              reached ? 'bg-emerald-500' : color.includes('blue') ? 'bg-blue-500' : 'bg-amber-500',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-50">Nutrition</h1>
        <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">Calorie balance and macro trends</p>
      </div>

      {/* Today balance card */}
      <Card className={cn('border-l-4', burnAvailable ? todayBalance.borderColor : 'border-l-gray-200 dark:border-l-zinc-700')}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
            <CardTitle>Today&apos;s Balance</CardTitle>
            <MetricInfo slug="calorie-balance" />
          </div>
        </CardHeader>
        <CardContent>
          {burnAvailable ? (
            <>
              <div className="grid grid-cols-3 gap-4 text-center mb-4">
                <div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mb-1">Consumed</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-zinc-50 tabular-nums">{fmtKcal(todayConsumed)}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500">kcal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mb-1">Burned</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-zinc-50 tabular-nums">{fmtKcal(todayBalance.burned)}</p>
                  {todayActive != null && (
                    <p className="text-xs text-gray-400 dark:text-zinc-500">{fmtKcal(todayActive)} active</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mb-1">Balance</p>
                  <p className={cn('text-3xl font-bold tabular-nums', todayBalance.textColor)}>
                    {todayBalance.statusLabel}
                  </p>
                </div>
              </div>
              <p className={cn('text-sm font-medium text-center py-2 rounded-xl', {
                'bg-green-50  dark:bg-green-500/10  text-green-700  dark:text-green-400':  todayBalance.color === 'green',
                'bg-blue-50   dark:bg-blue-500/10   text-blue-700   dark:text-blue-400':   todayBalance.color === 'blue',
                'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400': todayBalance.color === 'orange',
                'bg-red-50    dark:bg-red-500/10    text-red-700    dark:text-red-400':    todayBalance.color === 'red',
                'bg-gray-50   dark:bg-zinc-800      text-gray-500   dark:text-zinc-400':   todayBalance.color === 'neutral',
              })}>
                {todayBalance.helpText}
              </p>
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mb-1">Consumed</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-zinc-50 tabular-nums">{fmtKcal(todayConsumed)}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500">kcal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mb-1">Burned</p>
                  <p className="text-3xl font-bold text-gray-300 dark:text-zinc-600">—</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mb-1">Balance</p>
                  <p className="text-3xl font-bold text-gray-300 dark:text-zinc-600">—</p>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-center bg-gray-50 dark:bg-zinc-800 rounded-xl py-2.5 px-4">
                <Clock className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500 flex-shrink-0" />
                <p className="text-sm text-gray-500 dark:text-zinc-400">Waiting for Apple Health energy data</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today macros — progress bars */}
      {(todayProtein != null || todayCarbs != null || todayFat != null) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Today&apos;s Macros</CardTitle>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400">
                  Protein target: {proteinTarget.grams} g
                  <MetricInfo slug="protein-target" />
                </span>
                {proteinTarget.source === 'profile' && (
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                    from health profile · {proteinTarget.gPerKg} g/kg
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <MacroBar
              label="Protein" value={todayProtein} unit="g" target={proteinTarget.grams}
              color="text-blue-600 dark:text-blue-400"
              icon={<Beef className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />}
            />
            <MacroBar
              label="Carbs" value={todayCarbs} unit="g"
              color="text-amber-500 dark:text-amber-400"
              icon={<Wheat className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />}
            />
            <MacroBar
              label="Fat" value={todayFat} unit="g"
              color="text-orange-500 dark:text-orange-400"
              icon={<Droplets className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />}
            />
          </CardContent>
        </Card>
      )}

      {/* 7-day chart */}
      <Card>
        <CardHeader><CardTitle>7-Day Calorie History</CardTitle></CardHeader>
        <CardContent className="px-2 pb-4">
          <CalorieBalanceChart data={chartData} />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 justify-center text-xs text-gray-400 dark:text-zinc-500 px-3">
            <span>🔵 Consumed  🟢 Burned  🟠 Balance (line)</span>
          </div>
        </CardContent>
      </Card>

      {/* 7-day averages — grid of 4 */}
      <Card>
        <CardHeader><CardTitle>7-Day Averages</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Avg consumed', value: fmtKcal(avgConsumed), sub: 'kcal / day', color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Avg burned',   value: fmtKcal(avgBurned),   sub: 'kcal / day', color: 'text-emerald-600 dark:text-emerald-400' },
              {
                label: 'Avg balance',
                value: avgBalance != null ? `${avgBalance > 0 ? '+' : ''}${fmtKcal(avgBalance)}` : '—',
                sub: 'kcal / day',
                color: avgBalance == null ? 'text-gray-400 dark:text-zinc-500'
                  : avgBalance > 150 ? 'text-rose-600 dark:text-rose-400'
                  : avgBalance < -800 ? 'text-orange-600 dark:text-orange-400'
                  : 'text-gray-900 dark:text-zinc-50',
              },
              { label: 'Avg protein', value: avgProtein != null ? `${avgProtein}g` : '—', sub: 'per day', color: 'text-blue-600 dark:text-blue-400' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-gray-50 dark:bg-zinc-800 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 dark:text-zinc-500 mb-1">{label}</p>
                <p className={cn('text-xl font-bold tabular-nums', color)}>{value}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500">{sub}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Daily breakdown table */}
      <Card>
        <CardHeader><CardTitle>Daily Breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide">Date</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide">Consumed</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide">Burned</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                {[...dates].reverse().map(date => {
                  const m = metricsByDate[date]
                  const f = foodByDate[date]
                  const c = f?.calories ?? null
                  const b = m ? ((m.active ?? 0) + (m.resting ?? 0)) || null : null
                  const bal = c != null && b != null ? c - b : null
                  const { textColor } = computeBalance(c, m?.active ?? null, m?.resting ?? null)
                  const isToday = date === today
                  return (
                    <tr key={date} className={isToday ? 'bg-blue-50/50 dark:bg-blue-500/5' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'}>
                      <td className="px-5 py-3 text-gray-700 dark:text-zinc-300 font-medium">
                        {format(new Date(date + 'T12:00:00'), 'EEE, d MMM')}
                        {isToday && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-medium">Today</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600 dark:text-zinc-400 tabular-nums">{fmtKcal(c)}</td>
                      <td className="px-3 py-3 text-right text-gray-600 dark:text-zinc-400 tabular-nums">{fmtKcal(b)}</td>
                      <td className={cn('px-5 py-3 text-right font-semibold tabular-nums', bal != null ? textColor : 'text-gray-300 dark:text-zinc-600')}>
                        {bal != null ? `${bal > 0 ? '+' : ''}${bal.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
