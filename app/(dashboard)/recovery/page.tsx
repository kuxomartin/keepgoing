export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { CardContent } from '@/components/ui/card'
import { MetricInfo } from '@/components/ui/metric-info'
import { trendColor } from '@/lib/spark-utils'
import { Sparkline } from '@/components/ui/sparkline'
import { SleepChart } from '@/components/charts/sleep-chart'
import { HrvChart } from '@/components/charts/hrv-chart'
import { RestingHrChart } from '@/components/charts/resting-hr-chart'
import { getRecoveryScore } from '@/lib/calculations/recovery-score'
import { sevenDayAverage } from '@/lib/calculations/weekly-totals'
import { mockHealthMetrics } from '@/lib/mock-data/demo-data'
import type { HealthMetrics } from '@/types/database'
import { cn } from '@/lib/utils'

const SOURCE_PRIORITY = ['google_sheets', 'apple_health_export', 'manual', 'mock']

function deduplicateByDate(metrics: HealthMetrics[]): HealthMetrics[] {
  const byDate = new Map<string, HealthMetrics>()
  for (const m of metrics) {
    const existing = byDate.get(m.date)
    if (!existing) {
      byDate.set(m.date, m)
    } else {
      const existingPrio = SOURCE_PRIORITY.indexOf(existing.source)
      const newPrio = SOURCE_PRIORITY.indexOf(m.source)
      if (newPrio < existingPrio) byDate.set(m.date, m)
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

const STATUS_HERO = {
  green:  { bar: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30', label: 'Well recovered' },
  yellow: { bar: 'bg-amber-400',   badge: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30',       label: 'Moderate recovery' },
  red:    { bar: 'bg-rose-500',    badge: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30',           label: 'Low recovery' },
} as const

export default async function RecoveryPage() {
  const supabase = await createClient()

  const today = format(new Date(), 'yyyy-MM-dd')
  const fourteenDaysAgo = format(new Date(Date.now() - 14 * 86400000), 'yyyy-MM-dd')

  const { data: rawMetrics } = await supabase
    .from('health_metrics')
    .select('*')
    .gte('date', fourteenDaysAgo)
    .lte('date', today)
    .order('date', { ascending: true })

  const metrics: HealthMetrics[] =
    rawMetrics && rawMetrics.length > 0
      ? deduplicateByDate(rawMetrics as HealthMetrics[])
      : mockHealthMetrics.slice().sort((a, b) => a.date.localeCompare(b.date))

  const todayMetrics = metrics.find((m) => m.date === today) ?? metrics[metrics.length - 1] ?? null
  const recovery = getRecoveryScore(todayMetrics)

  // Chart data
  const sleepData = metrics.map((m) => ({
    date:  m.date,
    hours: Math.round(((m.sleep_minutes ?? 0) / 60) * 10) / 10,
  }))
  const hrvData = metrics.map((m) => ({
    date: m.date,
    hrv:  m.hrv_ms ? Math.round(Number(m.hrv_ms)) : null,
  }))
  const rhrData = metrics.map((m) => ({ date: m.date, rhr: m.resting_hr }))

  // 7-day sparkline arrays (for mini sparklines in vitals)
  const last7      = metrics.slice(-7)
  const hrvSpark   = last7.map(m => m.hrv_ms ? Number(m.hrv_ms) : null).filter((v): v is number => v != null)
  const sleepSpark = last7.map(m => m.sleep_minutes ? m.sleep_minutes / 60 : null).filter((v): v is number => v != null)
  const rhrSpark   = last7.map(m => m.resting_hr).filter((v): v is number => v != null)

  // 7-day averages
  const avg7dSleep = sevenDayAverage(metrics.map((m) => m.sleep_minutes ? m.sleep_minutes / 60 : null))
  const avg7dHrv   = sevenDayAverage(metrics.map((m) => m.hrv_ms ? Number(m.hrv_ms) : null))
  const avg7dRhr   = sevenDayAverage(metrics.map((m) => m.resting_hr))

  const isUsingMock = !rawMetrics || rawMetrics.length === 0

  const heroStatus = recovery.status as keyof typeof STATUS_HERO
  const heroConfig = STATUS_HERO[heroStatus] ?? STATUS_HERO.yellow

  // Today's values for vitals
  const sleepH    = todayMetrics?.sleep_minutes ? todayMetrics.sleep_minutes / 60 : null
  const hrvValue  = todayMetrics?.hrv_ms != null ? Math.round(Number(todayMetrics.hrv_ms)) : null
  const rhrValue  = todayMetrics?.resting_hr ?? null

  // Vitals for the hero grid
  const vitals = [
    sleepH   != null ? { label: 'Sleep',  value: sleepH.toFixed(1),  unit: 'h',   slug: 'sleep',              spark: sleepSpark, higherIsBetter: true  } : null,
    hrvValue != null ? { label: 'HRV',    value: String(hrvValue),    unit: 'ms',  slug: 'hrv',                spark: hrvSpark,   higherIsBetter: true  } : null,
    rhrValue != null ? { label: 'RHR',    value: String(rhrValue),    unit: 'bpm', slug: 'resting-heart-rate', spark: rhrSpark,   higherIsBetter: false } : null,
  ].filter((v): v is NonNullable<typeof v> => v !== null)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Recovery</p>
        {isUsingMock && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-3 py-1.5 inline-block">
            Showing demo data — sync your Google Sheet in Settings to see real data
          </p>
        )}
      </div>

      {/* Hero — always dark, Oura-style, score dominant */}
      <div className="relative rounded-2xl overflow-hidden bg-zinc-950">
        <div className={cn('absolute top-0 left-0 right-0 h-0.5', heroConfig.bar)} />
        <div className="px-6 pt-6 pb-6 space-y-5">

          {/* Eyebrow + badge */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Today</span>
            <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full', heroConfig.badge)}>
              {heroConfig.label}
            </span>
          </div>

          {/* Score — dominant number */}
          <div>
            <p className="text-7xl font-black text-white tabular-nums leading-none tracking-tight">{recovery.score}</p>
            <p className="text-xs text-white/30 mt-2 uppercase tracking-widest">Recovery score</p>
          </div>

          {/* Issues */}
          {recovery.issues.length > 0 && (
            <ul className="space-y-0.5">
              {recovery.issues.map((issue, i) => (
                <li key={i} className="text-sm text-white/40">· {issue}</li>
              ))}
            </ul>
          )}

          {/* Vitals — integrated into the hero */}
          {vitals.length > 0 && (
            <div className={cn(
              'grid gap-5 border-t border-white/8 pt-5',
              vitals.length === 3 ? 'grid-cols-3' : vitals.length === 2 ? 'grid-cols-2' : 'grid-cols-1',
            )}>
              {vitals.map(v => (
                <div key={v.label}>
                  <p className="text-2xl font-bold text-white tabular-nums leading-none">{v.value}</p>
                  {v.spark.length >= 2 && (
                    <div className="my-1.5">
                      <Sparkline values={v.spark} color={trendColor(v.spark, v.higherIsBetter)} width={56} height={14} />
                    </div>
                  )}
                  <div className="flex items-center gap-0.5">
                    <span className="text-[10px] text-white/35 uppercase tracking-widest">{v.label} {v.unit}</span>
                    <MetricInfo slug={v.slug} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 7-day averages — compact inline row */}
      {(avg7dSleep || avg7dHrv || avg7dRhr) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-1">
          {avg7dSleep && (
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              7d sleep: <span className="font-semibold text-gray-700 dark:text-zinc-300">{avg7dSleep}h</span>
            </p>
          )}
          {avg7dHrv && (
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              7d HRV: <span className="font-semibold text-gray-700 dark:text-zinc-300">{avg7dHrv} ms</span>
            </p>
          )}
          {avg7dRhr && (
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              7d RHR: <span className="font-semibold text-gray-700 dark:text-zinc-300">{avg7dRhr} bpm</span>
            </p>
          )}
        </div>
      )}

      {/* Charts — lighter styling, no heavy card chrome */}
      <div className="space-y-4">
        {/* Sleep chart */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Sleep</span>
              <span className="text-xs text-gray-400 dark:text-zinc-500">14 days</span>
              <MetricInfo slug="sleep" />
            </div>
            <div className="flex items-center gap-2.5 text-[10px] text-gray-400 dark:text-zinc-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400 inline-block" /> ≥7h</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" /> 6–7h</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-400 inline-block" /> &lt;6h</span>
            </div>
          </div>
          <CardContent className="pt-0">
            <SleepChart data={sleepData} />
          </CardContent>
        </div>

        {/* HRV + RHR side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800">
            <div className="px-5 pt-4 pb-2 flex items-center gap-1.5">
              <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">HRV</span>
              <span className="text-xs text-gray-400 dark:text-zinc-500">14 days</span>
              <MetricInfo slug="hrv" />
            </div>
            <CardContent className="pt-0">
              <HrvChart data={hrvData} />
            </CardContent>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800">
            <div className="px-5 pt-4 pb-2 flex items-center gap-1.5">
              <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Resting HR</span>
              <span className="text-xs text-gray-400 dark:text-zinc-500">14 days</span>
              <MetricInfo slug="resting-heart-rate" />
            </div>
            <CardContent className="pt-0">
              <RestingHrChart data={rhrData} />
            </CardContent>
          </div>
        </div>
      </div>
    </div>
  )
}
