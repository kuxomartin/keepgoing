export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { WeightChart } from '@/components/charts/weight-chart'
import { QuickAddWeight } from '@/components/dashboard/quick-add-weight'
import { movingAverage } from '@/lib/calculations/moving-average'
import { mockWeightLogs } from '@/lib/mock-data/demo-data'
import type { WeightLog } from '@/types/database'
import type { WeightChartPoint } from '@/components/charts/weight-chart'
import { Scale, Target } from 'lucide-react'
import { MetricInfo } from '@/components/ui/metric-info'
import { loadPersonalContextSummary } from '@/lib/profile/context-loader'

export default async function WeightPage() {
  const supabase = await createClient()

  const [{ data: rawLogs }, personalContext] = await Promise.all([
    supabase.from('weight_logs').select('*').order('date', { ascending: true }).limit(90),
    loadPersonalContextSummary(supabase),
  ])

  const logs: WeightLog[] =
    rawLogs && rawLogs.length > 0
      ? (rawLogs as WeightLog[])
      : [...mockWeightLogs].sort((a, b) => a.date.localeCompare(b.date))

  const isUsingMock = !rawLogs || rawLogs.length === 0

  // Moving average
  const weights = logs.map((l) => l.weight_kg)
  const ma7 = movingAverage(weights, 7)

  const chartData: WeightChartPoint[] = logs.map((l, i) => ({
    date: l.date,
    weight: l.weight_kg,
    ma7: ma7[i],
  }))

  // Stats
  const latest = logs[logs.length - 1]
  const sevenDaysAgo   = logs.length >= 8  ? logs[logs.length - 8]  : logs[0]
  const thirtyDaysAgo  = logs.length >= 31 ? logs[logs.length - 31] : logs[0]

  const change7d  = latest && sevenDaysAgo  ? Math.round((latest.weight_kg - sevenDaysAgo.weight_kg)  * 10) / 10 : null
  const change30d = latest && thirtyDaysAgo ? Math.round((latest.weight_kg - thirtyDaysAgo.weight_kg) * 10) / 10 : null

  function formatChange(v: number | null) {
    if (v === null) return '—'
    return (v > 0 ? '+' : '') + v.toFixed(1) + ' kg'
  }

  // Weight goal context (#1)
  const goalKg    = personalContext.weightGoalKg
  const currentKg = latest?.weight_kg ?? null
  const deltaKg   = goalKg != null && currentKg != null
    ? Math.round((currentKg - goalKg) * 10) / 10
    : null
  const trendTowardGoal = goalKg != null && change30d != null
    ? (goalKg < (currentKg ?? 999) ? change30d < 0 : change30d > 0)
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Weight</h1>
        <p className="mt-1 text-sm text-gray-500">Track your weight trend with a 7-day moving average.</p>
        {isUsingMock && (
          <p className="mt-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-block">
            Showing demo data
          </p>
        )}
      </div>

      {/* Goal delta banner (#1) */}
      {goalKg != null && currentKg != null && (
        <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-5 py-3.5 shadow-sm">
          <Target className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              {currentKg.toFixed(1)} kg current · Goal: {goalKg} kg
              {deltaKg != null && deltaKg > 0 && (
                <span className="ml-2 text-blue-600 font-semibold">{deltaKg} kg to go</span>
              )}
              {deltaKg != null && deltaKg <= 0 && (
                <span className="ml-2 text-green-600 font-semibold">Goal reached</span>
              )}
            </p>
            {trendTowardGoal != null && (
              <p className="text-xs text-gray-400 mt-0.5">
                {trendTowardGoal
                  ? '30-day trend is moving toward your goal.'
                  : '30-day trend is moving away from your goal.'}
              </p>
            )}
          </div>
          <span className="text-[10px] text-gray-400 flex-shrink-0">health profile</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Current"
          tooltipSlug="weight"
          value={latest ? latest.weight_kg.toFixed(1) : '—'}
          unit={latest ? 'kg' : ''}
          subtitle={latest ? format(new Date(latest.date), 'd MMM') : undefined}
          icon={<Scale className="h-5 w-5" />}
        />
        <StatCard
          label="7-day change"
          value={formatChange(change7d)}
          status={change7d !== null ? (change7d < 0 ? 'green' : change7d > 0.5 ? 'red' : 'neutral') : 'neutral'}
        />
        <StatCard
          label="30-day change"
          value={formatChange(change30d)}
          status={change30d !== null ? (change30d < 0 ? 'green' : change30d > 1 ? 'red' : 'neutral') : 'neutral'}
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CardTitle>Weight trend</CardTitle>
              <MetricInfo slug="weight-trend" />
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-gray-300 inline-block" /> Daily
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-blue-500 inline-block" /> 7-day avg
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WeightChart data={chartData} />
        </CardContent>
      </Card>

      {/* Log table */}
      <Card>
        <CardHeader>
          <CardTitle>Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Weight</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Waist</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Body fat</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...logs].reverse().slice(0, 30).map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5 text-gray-700">{format(new Date(log.date), 'EEE, d MMM yyyy')}</td>
                    <td className="px-5 py-2.5 text-right font-medium text-gray-900">{log.weight_kg.toFixed(1)} kg</td>
                    <td className="px-5 py-2.5 text-right text-gray-500 hidden sm:table-cell">{log.waist_cm ? `${log.waist_cm} cm` : '—'}</td>
                    <td className="px-5 py-2.5 text-right text-gray-500 hidden sm:table-cell">{log.body_fat_percent ? `${log.body_fat_percent}%` : '—'}</td>
                    <td className="px-5 py-2.5 text-gray-400 text-xs hidden md:table-cell">{log.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <QuickAddWeight />
    </div>
  )
}
