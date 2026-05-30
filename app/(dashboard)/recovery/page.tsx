export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricTile } from '@/components/ui/metric-tile'
import { MetricInfo } from '@/components/ui/metric-info'
import { trendColor } from '@/lib/spark-utils'
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

  // 7-day sparkline arrays
  const last7     = metrics.slice(-7)
  const hrvSpark  = last7.map(m => m.hrv_ms ? Number(m.hrv_ms) : null).filter((v): v is number => v != null)
  const sleepSpark= last7.map(m => m.sleep_minutes ? m.sleep_minutes / 60 : null).filter((v): v is number => v != null)
  const rhrSpark  = last7.map(m => m.resting_hr).filter((v): v is number => v != null)
  const stepsSpark= last7.map(m => m.steps).filter((v): v is number => v != null)

  // 7-day averages (for subtitles)
  const avg7dSleep = sevenDayAverage(metrics.map((m) => m.sleep_minutes ? m.sleep_minutes / 60 : null))
  const avg7dHrv   = sevenDayAverage(metrics.map((m) => m.hrv_ms ? Number(m.hrv_ms) : null))
  const avg7dRhr   = sevenDayAverage(metrics.map((m) => m.resting_hr))

  const isUsingMock = !rawMetrics || rawMetrics.length === 0

  const heroStatus = recovery.status as keyof typeof STATUS_HERO
  const heroConfig = STATUS_HERO[heroStatus] ?? STATUS_HERO.yellow

  // Tile statuses
  const sleepH = todayMetrics?.sleep_minutes ? todayMetrics.sleep_minutes / 60 : null
  const sleepStatus: 'green'|'amber'|'red'|'neutral' =
    sleepH == null ? 'neutral' : sleepH >= 7 ? 'green' : sleepH >= 6 ? 'amber' : 'red'
  const hrvStatus: 'green'|'amber'|'red'|'neutral' =
    todayMetrics?.hrv_ms == null ? 'neutral'
    : Number(todayMetrics.hrv_ms) >= 55 ? 'green'
    : Number(todayMetrics.hrv_ms) >= 40 ? 'amber' : 'red'
  const rhrStatus: 'green'|'amber'|'red'|'neutral' =
    todayMetrics?.resting_hr == null ? 'neutral'
    : todayMetrics.resting_hr <= 55 ? 'green'
    : todayMetrics.resting_hr <= 65 ? 'amber' : 'red'
  const stepsStatus: 'green'|'amber'|'neutral' =
    !todayMetrics?.steps ? 'neutral'
    : todayMetrics.steps >= 10000 ? 'green'
    : todayMetrics.steps >= 6000 ? 'amber' : 'neutral'

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Recovery</p>
        {isUsingMock && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-3 py-1.5 inline-block">
            Showing demo data — sync your Google Sheet in Settings to see real data
          </p>
        )}
      </div>

      {/* Hero status — always dark, Oura-style */}
      <div className="relative rounded-2xl overflow-hidden bg-zinc-950">
        <div className={cn('absolute top-0 left-0 right-0 h-0.5', heroConfig.bar)} />
        <div className="px-5 pt-5 pb-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Today</span>
            <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full', heroConfig.badge)}>
              {heroConfig.label}
            </span>
          </div>
          <div>
            <p className="text-4xl font-bold text-white tracking-tight">{recovery.score}</p>
            <p className="text-xs text-white/30 mt-0.5 uppercase tracking-widest">Recovery score</p>
          </div>
          {recovery.issues.length > 0 && (
            <ul className="space-y-0.5 pt-1">
              {recovery.issues.map((issue, i) => (
                <li key={i} className="text-xs text-white/40">· {issue}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Metric tiles with sparklines */}
      <div className="grid grid-cols-4 gap-2">
        <MetricTile
          label="HRV"   unit="ms"  tooltipSlug="hrv"
          value={todayMetrics?.hrv_ms != null ? Math.round(Number(todayMetrics.hrv_ms)) : '—'}
          sparkValues={hrvSpark}   sparkColor={trendColor(hrvSpark, true)}   status={hrvStatus}
        />
        <MetricTile
          label="Sleep" unit="h"   tooltipSlug="sleep"
          value={sleepH != null ? sleepH.toFixed(1) : '—'}
          sparkValues={sleepSpark} sparkColor={trendColor(sleepSpark, true)} status={sleepStatus}
        />
        <MetricTile
          label="RHR"   unit="bpm" tooltipSlug="resting-heart-rate"
          value={todayMetrics?.resting_hr ?? '—'}
          sparkValues={rhrSpark}   sparkColor={trendColor(rhrSpark, false)}  status={rhrStatus}
        />
        <MetricTile
          label="Steps" unit="k"   tooltipSlug="steps"
          value={todayMetrics?.steps ? (todayMetrics.steps / 1000).toFixed(1) : '—'}
          sparkValues={stepsSpark} sparkColor={trendColor(stepsSpark, true)} status={stepsStatus}
        />
      </div>

      {/* 7-day averages — compact inline row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1">
        {avg7dSleep && <p className="text-xs text-gray-400 dark:text-zinc-500">7d avg sleep: <span className="font-medium text-gray-600 dark:text-zinc-300">{avg7dSleep}h</span></p>}
        {avg7dHrv   && <p className="text-xs text-gray-400 dark:text-zinc-500">7d avg HRV: <span className="font-medium text-gray-600 dark:text-zinc-300">{avg7dHrv} ms</span></p>}
        {avg7dRhr   && <p className="text-xs text-gray-400 dark:text-zinc-500">7d avg RHR: <span className="font-medium text-gray-600 dark:text-zinc-300">{avg7dRhr} bpm</span></p>}
      </div>

      {/* Sleep chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CardTitle>Sleep — last 14 days</CardTitle>
              <MetricInfo slug="sleep" />
            </div>
            <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-zinc-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" /> ≥ 7h</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> 6–7h</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" /> &lt;6h</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SleepChart data={sleepData} />
        </CardContent>
      </Card>

      {/* HRV + RHR charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-1.5">
              <CardTitle>HRV trend</CardTitle>
              <MetricInfo slug="hrv" />
            </div>
          </CardHeader>
          <CardContent>
            <HrvChart data={hrvData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-1.5">
              <CardTitle>Resting HR trend</CardTitle>
              <MetricInfo slug="resting-heart-rate" />
            </div>
          </CardHeader>
          <CardContent>
            <RestingHrChart data={rhrData} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
