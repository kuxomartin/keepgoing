export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, subDays, startOfDay } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalorieBalanceChart, type DayBalance } from '@/components/charts/calorie-balance-chart'
import { computeBalance, fmtKcal } from '@/lib/calculations/calorie-balance'
import { Flame, Beef, Wheat, Droplets, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── helpers ───────────────────────────────────────────────────────────────

function avg(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => v != null)
  if (!nums.length) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

// ── page ──────────────────────────────────────────────────────────────────

export default async function NutritionPage() {
  const supabase = await createClient()

  const today = format(new Date(), 'yyyy-MM-dd')
  const dates = Array.from({ length: 7 }, (_, i) =>
    format(subDays(startOfDay(new Date()), 6 - i), 'yyyy-MM-dd')
  )
  const oldest = dates[0]

  // Fetch health_metrics for past 7 days only — no cross-date fallback
  const { data: metricsRaw } = await supabase
    .from('health_metrics')
    .select('date, active_energy_kcal, resting_energy_kcal')
    .gte('date', oldest)
    .lte('date', today)
    .order('date', { ascending: true })

  // Fetch food_logs for past 7 days (calories + macros)
  const { data: foodRaw } = await supabase
    .from('food_logs')
    .select('date, estimated_calories, protein_g, carbs_g, fat_g')
    .gte('date', oldest)
    .lte('date', today)

  // Index health metrics by date
  const metricsByDate: Record<string, { active: number | null; resting: number | null }> = {}
  for (const row of metricsRaw ?? []) {
    metricsByDate[row.date] = {
      active:  row.active_energy_kcal  ?? null,
      resting: row.resting_energy_kcal ?? null,
    }
  }

  // Aggregate food by date
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

  // 7-day chart data — balance only shown when same-date burn data exists
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

  // Today — same-date energy only, no fallback
  const todayMetrics    = metricsByDate[today] ?? null
  const todayFood       = foodByDate[today]    ?? null
  const todayConsumed   = todayFood?.calories  ?? null
  const todayActive     = todayMetrics?.active  ?? null
  const todayResting    = todayMetrics?.resting ?? null
  const todayBalance    = computeBalance(todayConsumed, todayActive, todayResting)
  const burnAvailable   = todayBalance.burned != null

  // 7-day averages
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

  // Today macro totals
  const todayProtein = todayFood ? Math.round(todayFood.protein) : null
  const todayCarbs   = todayFood ? Math.round(todayFood.carbs)   : null
  const todayFat     = todayFood ? Math.round(todayFood.fat)     : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nutrition</h1>
        <p className="text-sm text-gray-400 mt-0.5">Calorie balance and macro trends</p>
      </div>

      {/* Today balance */}
      <Card className={cn('border-l-4', burnAvailable ? todayBalance.borderColor : 'border-l-gray-200')}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-gray-400" />
            <CardTitle>Today&apos;s Balance</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {burnAvailable ? (
            /* Full balance — same-date data available */
            <>
              <div className="grid grid-cols-3 gap-4 text-center mb-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Consumed</p>
                  <p className="text-2xl font-bold text-gray-900">{fmtKcal(todayConsumed)}</p>
                  <p className="text-xs text-gray-400">kcal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Burned</p>
                  <p className="text-2xl font-bold text-gray-900">{fmtKcal(todayBalance.burned)}</p>
                  {todayActive != null && (
                    <p className="text-xs text-gray-400">{fmtKcal(todayActive)} active</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Balance</p>
                  <p className={cn('text-2xl font-bold', todayBalance.textColor)}>
                    {todayBalance.statusLabel}
                  </p>
                </div>
              </div>
              <p className={cn('text-sm font-medium text-center py-2 rounded-lg', {
                'bg-green-50  text-green-700':  todayBalance.color === 'green',
                'bg-blue-50   text-blue-700':   todayBalance.color === 'blue',
                'bg-orange-50 text-orange-700': todayBalance.color === 'orange',
                'bg-red-50    text-red-700':    todayBalance.color === 'red',
                'bg-gray-50   text-gray-500':   todayBalance.color === 'neutral',
              })}>
                {todayBalance.helpText}
              </p>
            </>
          ) : (
            /* Burn data not yet available — show consumed only */
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Consumed</p>
                  <p className="text-2xl font-bold text-gray-900">{fmtKcal(todayConsumed)}</p>
                  <p className="text-xs text-gray-400">kcal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Burned</p>
                  <p className="text-2xl font-bold text-gray-300">—</p>
                  <p className="text-xs text-gray-300">kcal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Balance</p>
                  <p className="text-2xl font-bold text-gray-300">—</p>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-center bg-gray-50 rounded-lg py-2.5 px-4">
                <Clock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <p className="text-sm text-gray-500">
                  Waiting for Apple Health energy data
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today macros */}
      {(todayProtein != null || todayCarbs != null || todayFat != null) && (
        <Card>
          <CardHeader><CardTitle>Today&apos;s Macros</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="flex justify-center"><Beef className="h-4 w-4 text-blue-500" /></div>
                <p className="text-2xl font-bold text-blue-600">{todayProtein ?? '—'}g</p>
                <p className="text-xs text-gray-400">Protein</p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-center"><Wheat className="h-4 w-4 text-yellow-500" /></div>
                <p className="text-2xl font-bold text-yellow-600">{todayCarbs ?? '—'}g</p>
                <p className="text-xs text-gray-400">Carbs</p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-center"><Droplets className="h-4 w-4 text-orange-500" /></div>
                <p className="text-2xl font-bold text-orange-600">{todayFat ?? '—'}g</p>
                <p className="text-xs text-gray-400">Fat</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 7-day chart */}
      <Card>
        <CardHeader><CardTitle>7-Day Calorie History</CardTitle></CardHeader>
        <CardContent className="px-2 pb-4">
          <CalorieBalanceChart data={chartData} />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 justify-center text-xs text-gray-400 px-3">
            <span>🔵 Consumed  🟢 Burned  🟠 Balance (line)</span>
          </div>
        </CardContent>
      </Card>

      {/* 7-day averages */}
      <Card>
        <CardHeader><CardTitle>7-Day Averages</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Avg consumed', value: fmtKcal(avgConsumed), sub: 'kcal / day', color: 'text-blue-600' },
              { label: 'Avg burned',   value: fmtKcal(avgBurned),   sub: 'kcal / day', color: 'text-green-600' },
              {
                label: 'Avg balance',
                value: avgBalance != null
                  ? `${avgBalance > 0 ? '+' : ''}${fmtKcal(avgBalance)}`
                  : '—',
                sub: 'kcal / day',
                color: avgBalance == null ? 'text-gray-400' :
                  avgBalance > 150 ? 'text-red-600' :
                  avgBalance < -800 ? 'text-orange-600' : 'text-gray-900',
              },
              { label: 'Avg protein', value: avgProtein != null ? `${avgProtein}g` : '—', sub: 'per day', color: 'text-blue-600' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className={cn('text-xl font-bold', color)}>{value}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Daily breakdown */}
      <Card>
        <CardHeader><CardTitle>Daily Breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Consumed</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Burned</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...dates].reverse().map(date => {
                  const m = metricsByDate[date]
                  const f = foodByDate[date]
                  const c = f?.calories ?? null
                  const b = m ? ((m.active ?? 0) + (m.resting ?? 0)) || null : null
                  const bal = c != null && b != null ? c - b : null
                  const { textColor } = computeBalance(c, m?.active ?? null, m?.resting ?? null)
                  const isToday = date === today
                  return (
                    <tr key={date} className={isToday ? 'bg-blue-50/50' : 'hover:bg-gray-50'}>
                      <td className="px-5 py-3 text-gray-700 font-medium">
                        {format(new Date(date + 'T12:00:00'), 'EEE, d MMM')}
                        {isToday && (
                          <span className="ml-2 text-xs text-blue-600 font-medium">Today</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">{fmtKcal(c)}</td>
                      <td className="px-3 py-3 text-right text-gray-600">{fmtKcal(b)}</td>
                      <td className={cn(
                        'px-5 py-3 text-right font-semibold',
                        bal != null ? textColor : 'text-gray-300',
                      )}>
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
