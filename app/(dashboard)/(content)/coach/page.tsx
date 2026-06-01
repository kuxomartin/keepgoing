export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { analyzeWeeklyPatterns } from '@/lib/insights/weekly-patterns'
import { mockActivities, mockHealthMetrics, mockWeightLogs, mockFoodLogs } from '@/lib/mock-data/demo-data'
import type { Activity, HealthMetrics, WeightLog, FoodLog } from '@/types/database'
import { cn } from '@/lib/utils'

export default async function CoachPage() {
  const supabase = await createClient()

  const thisWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const thisWeekEnd   = format(endOfWeek(new Date(),   { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [
    { data: activitiesRaw },
    { data: metricsRaw },
    { data: weightsRaw },
    { data: foodsRaw },
  ] = await Promise.all([
    supabase.from('activities').select('*').gte('start_time', thisWeekStart + 'T00:00:00').lte('start_time', thisWeekEnd + 'T23:59:59'),
    supabase.from('health_metrics').select('*').gte('date', thisWeekStart).lte('date', thisWeekEnd),
    supabase.from('weight_logs').select('*').gte('date', thisWeekStart).lte('date', thisWeekEnd),
    supabase.from('food_logs').select('*').gte('date', thisWeekStart).lte('date', thisWeekEnd),
  ])

  const hasRealData = (activitiesRaw && activitiesRaw.length > 0) || (metricsRaw && metricsRaw.length > 0)

  const activities: Activity[]      = activitiesRaw?.length ? (activitiesRaw as Activity[])     : mockActivities
  const metrics:    HealthMetrics[] = metricsRaw?.length    ? (metricsRaw as HealthMetrics[])   : mockHealthMetrics
  const weights:    WeightLog[]     = weightsRaw?.length    ? (weightsRaw as WeightLog[])       : mockWeightLogs.slice(0, 7)
  const foods:      FoodLog[]       = foodsRaw?.length      ? (foodsRaw as FoodLog[])           : mockFoodLogs

  const patterns  = analyzeWeeklyPatterns(activities, metrics, weights, foods)
  const weekLabel = `${format(new Date(thisWeekStart), 'd MMM')} – ${format(new Date(thisWeekEnd), 'd MMM yyyy')}`

  return (
    <div>

      {/* ── BRIEFING HEADER ───────────────────────────────────────────── */}
      <div className="bg-[#0D0D0D] dark:bg-zinc-950 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-6 pb-10">
        <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.15em] mb-8">
          Coach · {weekLabel}
          {!hasRealData && <span className="ml-3 text-[#D97706]/60">demo data</span>}
        </p>

        <h1 className="font-display font-bold text-white leading-tight mb-6" style={{ fontSize: '2.5rem' }}>
          {patterns.totalActivities > 0
            ? `${patterns.totalActivities} session${patterns.totalActivities !== 1 ? 's' : ''} this week.`
            : 'No training logged this week.'}
        </h1>

        <div className="space-y-2 max-w-xl">
          <p className="text-base text-white/55 leading-relaxed">
            {patterns.totalActivities > 0
              ? `${Math.round(patterns.totalTrainingMinutes / 60 * 10) / 10}h total training time.`
              : 'Log your first session to see weekly analysis.'}
            {patterns.avgSleepHours ? ` Average sleep: ${patterns.avgSleepHours}h.` : ''}
            {patterns.avgHrv ? ` Average HRV: ${patterns.avgHrv} ms.` : ''}
          </p>
          {patterns.weightChange !== null && (
            <p className="text-base text-white/55">
              Weight {patterns.weightChange > 0 ? 'up' : 'down'} {Math.abs(patterns.weightChange)} kg this week.
            </p>
          )}
        </div>
      </div>

      {/* ── WEEK SIGNALS ──────────────────────────────────────────────── */}
      <div className="py-8 border-b border-[#D9D9D9] dark:border-zinc-800">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-2">This week</p>

        <div>
          <div className="flex items-baseline justify-between py-4 border-b border-[#D9D9D9] dark:border-zinc-800">
            <span className="text-sm text-[#888888]">Training volume</span>
            <span className="text-base font-semibold text-[#0D0D0D] dark:text-zinc-50">
              {patterns.totalActivities} session{patterns.totalActivities !== 1 ? 's' : ''} · {Math.round(patterns.totalTrainingMinutes)}m
            </span>
          </div>

          {patterns.hardestActivity && (
            <div className="flex items-start justify-between py-4 border-b border-[#D9D9D9] dark:border-zinc-800">
              <span className="text-sm text-[#888888]">Hardest session</span>
              <div className="text-right ml-4">
                <p className="text-base font-semibold text-[#0D0D0D] dark:text-zinc-50 max-w-[280px] truncate">{patterns.hardestActivity.title}</p>
                <p className="text-xs text-[#888888]">Effort {patterns.hardestActivity.perceived_effort}/10</p>
              </div>
            </div>
          )}

          {patterns.bestSleepDay && (
            <div className="flex items-baseline justify-between py-4 border-b border-[#D9D9D9] dark:border-zinc-800">
              <span className="text-sm text-[#888888]">Best sleep</span>
              <div className="text-right">
                <p className="text-base font-semibold text-[#0D0D0D] dark:text-zinc-50">{patterns.bestSleepHours}h</p>
                <p className="text-xs text-[#888888]">{format(new Date(patterns.bestSleepDay), 'EEE d MMM')}</p>
              </div>
            </div>
          )}

          <div className="flex items-baseline justify-between py-4 border-b border-[#D9D9D9] dark:border-zinc-800">
            <span className="text-sm text-[#888888]">Weight change</span>
            <span className={cn('text-base font-semibold',
              patterns.weightChange == null ? 'text-[#888888]' :
              patterns.weightChange < 0 ? 'text-[#16A34A]' :
              patterns.weightChange > 0.2 ? 'text-[#D97706]' : 'text-[#0D0D0D] dark:text-zinc-50'
            )}>
              {patterns.weightChange != null
                ? `${patterns.weightChange > 0 ? '+' : ''}${patterns.weightChange} kg`
                : '—'}
            </span>
          </div>

          <div className="flex items-baseline justify-between py-4">
            <span className="text-sm text-[#888888]">Food consistency</span>
            <div className="text-right">
              <span className="text-base font-semibold text-[#0D0D0D] dark:text-zinc-50">{patterns.foodLogDays}/7 days</span>
              <p className="text-xs text-[#888888]">
                {patterns.foodLogDays >= 5 ? 'Great consistency' : patterns.foodLogDays >= 3 ? 'Room to improve' : 'Log more meals'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI COMING SOON ────────────────────────────────────────────── */}
      <div className="bg-[#EDEDEB] dark:bg-zinc-900 -mx-4 sm:-mx-6 px-4 sm:px-6 py-8">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-3">AI weekly report</p>
        <p className="text-base text-[#888888] leading-relaxed max-w-xl">
          Personalised coaching insights generated from your patterns across training, nutrition, sleep, and HRV.
        </p>
        <p className="text-sm text-[#888888] mt-3 font-medium">Coming soon.</p>
      </div>

    </div>
  )
}
