export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { WeightChart } from '@/components/charts/weight-chart'
import { movingAverage } from '@/lib/calculations/moving-average'
import { mockWeightLogs } from '@/lib/mock-data/demo-data'
import type { WeightLog } from '@/types/database'
import type { WeightChartPoint } from '@/components/charts/weight-chart'
import { MetricInfo } from '@/components/ui/metric-info'
import { loadPersonalContextSummary } from '@/lib/profile/context-loader'
import { cn } from '@/lib/utils'

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

  const weights = logs.map(l => l.weight_kg)
  const ma7 = movingAverage(weights, 7)

  const chartData: WeightChartPoint[] = logs.map((l, i) => ({
    date: l.date, weight: l.weight_kg, ma7: ma7[i],
  }))

  const latest       = logs[logs.length - 1]
  const sevenAgo     = logs.length >= 8  ? logs[logs.length - 8]  : logs[0]
  const thirtyAgo    = logs.length >= 31 ? logs[logs.length - 31] : logs[0]
  const change7d     = latest && sevenAgo  ? Math.round((latest.weight_kg - sevenAgo.weight_kg)  * 10) / 10 : null
  const change30d    = latest && thirtyAgo ? Math.round((latest.weight_kg - thirtyAgo.weight_kg) * 10) / 10 : null

  const goalKg    = personalContext.weightGoalKg
  const currentKg = latest?.weight_kg ?? null
  const deltaKg   = goalKg != null && currentKg != null
    ? Math.round((currentKg - goalKg) * 10) / 10 : null
  const goalReached   = deltaKg != null && deltaKg <= 0
  const trendToGoal   = goalKg != null && change30d != null
    ? (goalKg < (currentKg ?? 999) ? change30d < 0 : change30d > 0) : null

  function fmtChange(v: number | null) {
    if (v == null) return '—'
    return (v > 0 ? '+' : '') + v.toFixed(1) + ' kg'
  }

  return (
    <div>

      {/* ── HERO — current weight ─────────────────────────────────────── */}
      <div className="bg-[#F2EDE6] dark:bg-zinc-900 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-6 pb-8">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-6">
          Weight
          {isUsingMock && <span className="ml-3 text-[#D97706]">demo data</span>}
        </p>

        <div className="flex items-baseline gap-3 mb-2">
          <span className="font-display font-bold text-[#0D0D0D] dark:text-zinc-50 tabular-nums leading-none"
                style={{ fontSize: '5rem' }}>
            {currentKg != null ? currentKg.toFixed(1) : '—'}
          </span>
          <span className="text-lg text-[#888888]">kg</span>
          <MetricInfo slug="weight" />
        </div>

        {latest && <p className="text-sm text-[#888888]">Last logged {format(new Date(latest.date), 'd MMM yyyy')}</p>}

        {/* Goal distance */}
        {goalKg != null && currentKg != null && (
          <div className="mt-4 pt-4 border-t border-[#D9D9D9]/50">
            {goalReached ? (
              <p className="text-sm font-semibold text-[#16A34A]">Goal reached — {goalKg} kg</p>
            ) : (
              <p className="text-sm text-[#888888]">
                <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{Math.abs(deltaKg!)} kg</span>
                {' '}to goal ({goalKg} kg)
                {trendToGoal != null && (
                  <span className={cn('ml-2', trendToGoal ? 'text-[#16A34A]' : 'text-[#D97706]')}>
                    · {trendToGoal ? 'trending toward goal' : 'trending away from goal'}
                  </span>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── CHANGES ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-0 border-b border-[#D9D9D9] dark:border-zinc-800">
        <div className="py-6 border-r border-[#D9D9D9] dark:border-zinc-800">
          <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-2">7-day change</p>
          <p className={cn('text-2xl font-bold tabular-nums', change7d == null ? 'text-[#888888]' : change7d < 0 ? 'text-[#16A34A]' : change7d > 0.5 ? 'text-[#E5173F]' : 'text-[#0D0D0D] dark:text-zinc-50')}>
            {fmtChange(change7d)}
          </p>
        </div>
        <div className="py-6 pl-6">
          <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-2">30-day change</p>
          <p className={cn('text-2xl font-bold tabular-nums', change30d == null ? 'text-[#888888]' : change30d < 0 ? 'text-[#16A34A]' : change30d > 1 ? 'text-[#E5173F]' : 'text-[#0D0D0D] dark:text-zinc-50')}>
            {fmtChange(change30d)}
          </p>
        </div>
      </div>

      {/* ── CHART — no container ──────────────────────────────────────── */}
      <div className="py-8 border-b border-[#D9D9D9] dark:border-zinc-800">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Trend · 90 days</span>
          <MetricInfo slug="weight-trend" />
          <div className="ml-auto flex items-center gap-4 text-[10px] text-[#888888]">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#D9D9D9] inline-block" /> Daily</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#0D0D0D] dark:bg-zinc-100 inline-block" /> 7-day avg</span>
          </div>
        </div>
        <div className="-mx-4 sm:-mx-6">
          <WeightChart data={chartData} />
        </div>
      </div>

      {/* ── LOG — clean rows, no table ──────────────────────────────── */}
      <div className="py-8">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-5">Log</p>
        <div>
          {[...logs].reverse().slice(0, 30).map((log, i) => (
            <div key={log.id}>
              {i > 0 && <div className="border-t border-[#D9D9D9] dark:border-zinc-800" />}
              <div className="flex items-center justify-between py-3">
                <p className="text-sm text-[#888888]">
                  {format(new Date(log.date), 'EEE, d MMM yyyy')}
                </p>
                <div className="flex items-center gap-6 text-sm tabular-nums">
                  <span className="text-base font-semibold text-[#0D0D0D] dark:text-zinc-50">{log.weight_kg.toFixed(1)} kg</span>
                  {log.waist_cm && <span className="text-[#888888] hidden sm:inline">{log.waist_cm} cm waist</span>}
                  {log.body_fat_percent && <span className="text-[#888888] hidden md:inline">{log.body_fat_percent}% fat</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
