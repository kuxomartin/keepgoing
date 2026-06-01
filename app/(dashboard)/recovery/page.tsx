export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
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

/**
 * Merges all health_metrics rows for the same date into one record.
 * Different sources hold different fields:
 *   google_sheets       → HRV, steps, energy, resting HR, VO₂ max
 *   google_sheets_sleep → sleep_minutes, deep_sleep_minutes, rem_sleep_minutes
 *
 * Strategy: for each field, use the first non-null value found across all rows
 * for that date, preferring google_sheets over google_sheets_sleep for fields
 * they both might provide.
 */
function mergeByDate(metrics: HealthMetrics[]): HealthMetrics[] {
  const SOURCE_PRIORITY = ['google_sheets', 'google_sheets_sleep', 'apple_health_export', 'manual', 'mock']
  // Sort by source priority so higher-priority sources are merged first
  const sorted = [...metrics].sort((a, b) =>
    SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source)
  )

  const byDate = new Map<string, HealthMetrics>()
  for (const m of sorted) {
    const existing = byDate.get(m.date)
    if (!existing) {
      byDate.set(m.date, { ...m })
    } else {
      // Merge: fill in any null fields from this row
      const merged = { ...existing }
      if (merged.sleep_minutes      == null && m.sleep_minutes      != null) merged.sleep_minutes      = m.sleep_minutes
      if (merged.deep_sleep_minutes == null && m.deep_sleep_minutes != null) merged.deep_sleep_minutes = m.deep_sleep_minutes
      if (merged.rem_sleep_minutes  == null && m.rem_sleep_minutes  != null) merged.rem_sleep_minutes  = m.rem_sleep_minutes
      if (merged.hrv_ms             == null && m.hrv_ms             != null) merged.hrv_ms             = m.hrv_ms
      if (merged.resting_hr         == null && m.resting_hr         != null) merged.resting_hr         = m.resting_hr
      if (merged.steps              == null && m.steps              != null) merged.steps              = m.steps
      if (merged.active_energy_kcal == null && m.active_energy_kcal!= null) merged.active_energy_kcal = m.active_energy_kcal
      if (merged.resting_energy_kcal== null && m.resting_energy_kcal!=null) merged.resting_energy_kcal= m.resting_energy_kcal
      if (merged.vo2max             == null && m.vo2max             != null) merged.vo2max             = m.vo2max
      byDate.set(m.date, merged)
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

const STATUS_CONFIG = {
  green:  { headlineText: 'Well recovered today.',     headlineCls: 'text-[#16A34A]' },
  yellow: { headlineText: 'Moderate recovery today.',  headlineCls: 'text-[#D97706]' },
  red:    { headlineText: 'Low recovery today.',       headlineCls: 'text-[#E5173F]' },
} as const

const TREND_LABEL: Record<string, { text: string; cls: string }> = {
  green: { text: '↑ improving', cls: 'text-[#16A34A]' },
  amber: { text: '↓ declining', cls: 'text-[#D97706]' },
  red:   { text: '↓ declining', cls: 'text-[#E5173F]' },
  blue:  { text: '→ stable',   cls: 'text-white/40'   },
  gray:  { text: '',           cls: ''                 },
}

const TREND_LABEL_LIGHT: Record<string, string> = {
  green: 'text-[#16A34A]', amber: 'text-[#D97706]', red: 'text-[#D97706]',
  blue:  'text-[#888888]', gray: 'text-[#888888]',
}

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
      ? mergeByDate(rawMetrics as HealthMetrics[])
      : mockHealthMetrics.slice().sort((a, b) => a.date.localeCompare(b.date))

  const isUsingMock = !rawMetrics || rawMetrics.length === 0

  // Today's or most recent metrics
  const todayMetrics = metrics.find((m) => m.date === today) ?? metrics[metrics.length - 1] ?? null
  const recovery     = getRecoveryScore(todayMetrics)

  // ── Chart data ─────────────────────────────────────────────────────────────
  // Sleep: use null for missing/zero values so chart skips them
  const sleepData = metrics.map((m) => ({
    date:  m.date,
    hours: m.sleep_minutes && m.sleep_minutes > 0
      ? Math.round((m.sleep_minutes / 60) * 10) / 10
      : null,
  }))
  const hrvData = metrics.map((m) => ({
    date: m.date,
    hrv:  m.hrv_ms ? Math.round(Number(m.hrv_ms)) : null,
  }))
  const rhrData = metrics.map((m) => ({ date: m.date, rhr: m.resting_hr }))

  // ── Spark arrays for trend ─────────────────────────────────────────────────
  const last7      = metrics.slice(-7)
  const hrvSpark   = last7.map(m => m.hrv_ms ? Number(m.hrv_ms) : null).filter((v): v is number => v != null)
  const sleepSpark = last7.map(m => m.sleep_minutes && m.sleep_minutes > 0 ? m.sleep_minutes / 60 : null).filter((v): v is number => v != null)
  const rhrSpark   = last7.map(m => m.resting_hr).filter((v): v is number => v != null)

  const hrvTrendKey   = hrvSpark.length >= 4   ? trendColor(hrvSpark,   true)  : 'gray'
  const sleepTrendKey = sleepSpark.length >= 4 ? trendColor(sleepSpark, true)  : 'gray'
  const rhrTrendKey   = rhrSpark.length >= 4   ? trendColor(rhrSpark,   false) : 'gray'

  // ── 14-day averages ────────────────────────────────────────────────────────
  const avg14dSleep = sevenDayAverage(metrics.map(m => m.sleep_minutes && m.sleep_minutes > 0 ? m.sleep_minutes / 60 : null))
  const avg14dHrv   = sevenDayAverage(metrics.map(m => m.hrv_ms ? Number(m.hrv_ms) : null))
  const avg14dRhr   = sevenDayAverage(metrics.map(m => m.resting_hr))

  const heroStatus = recovery.status as keyof typeof STATUS_CONFIG
  const hero       = STATUS_CONFIG[heroStatus] ?? STATUS_CONFIG.yellow

  // Sleep: use the most recent day with actual sleep data (not just today)
  const recentWithSleep = [...metrics].reverse().find(m => m.sleep_minutes && m.sleep_minutes > 0)
  const sleepH = recentWithSleep?.sleep_minutes
    ? Math.round((recentWithSleep.sleep_minutes / 60) * 10) / 10
    : null

  // HRV and RHR from todayMetrics (fallback to most recent)
  const hrvValue = todayMetrics?.hrv_ms != null ? Math.round(Number(todayMetrics.hrv_ms)) : null
  const rhrValue = todayMetrics?.resting_hr ?? null

  return (
    <div className="flex flex-col">

      {/* ═══════════════════════════════════════════════════════════════════
          ZONE 1 — Dark Control Room
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#0D0D0D] flex flex-col px-6 sm:px-10 lg:px-14 py-12 lg:py-16" style={{ minHeight: '500px' }}>

        <div className="flex items-center justify-between mb-10">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.15em]">Recovery</p>
          {isUsingMock && <span className="text-[10px] text-amber-400/60 uppercase tracking-widest">demo data</span>}
        </div>

        {/* Status headline */}
        <h1 className={cn('font-display font-bold leading-tight mb-4', 'text-[2.5rem] sm:text-[3rem]', hero.headlineCls)}>
          {hero.headlineText}
        </h1>

        {/* Issues — filtered: never show "0.0h" */}
        {recovery.issues.filter(i => !i.includes('0.0h')).length > 0 && (
          <div className="space-y-2 mb-10 max-w-xl">
            {recovery.issues.filter(i => !i.includes('0.0h')).map((issue, i) => (
              <p key={i} className="text-base text-white/55 leading-relaxed">{issue}</p>
            ))}
          </div>
        )}

        {/* HRV — 120px hero number */}
        {hrvValue != null ? (
          <div className="mt-auto">
            <div className="flex items-baseline gap-3">
              <span className="font-display font-bold text-white tabular-nums leading-none" style={{ fontSize: '7.5rem' }}>
                {hrvValue}
              </span>
              <span className="text-xl text-white/25">ms</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em]">HRV</span>
              <MetricInfo slug="hrv" />
              {TREND_LABEL[hrvTrendKey].text && (
                <span className={cn('text-[10px] font-bold uppercase tracking-[0.15em]', TREND_LABEL[hrvTrendKey].cls)}>
                  {TREND_LABEL[hrvTrendKey].text}
                </span>
              )}
              {avg14dHrv && (
                <span className="text-[10px] text-white/25">14d avg: {avg14dHrv} ms</span>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-auto">
            <p className="text-white/25 text-sm">No HRV data</p>
          </div>
        )}

        {/* Atmospheric HRV curve */}
        {hrvData.some(d => d.hrv != null) && (
          <div className="mt-8 -mx-6 sm:-mx-10 lg:-mx-14">
            <div className="opacity-20 h-[120px]">
              <HrvChart data={hrvData} minimal />
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ZONE 2 — Warm Stone / Vitals
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#F2EDE6] dark:bg-zinc-900 px-6 sm:px-10 lg:px-14 py-10">

        <div className="flex gap-12 flex-wrap">

          {/* Sleep — use most recent real data */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-[#0D0D0D] dark:text-zinc-50 tabular-nums leading-none" style={{ fontSize: '3rem' }}>
                {sleepH != null ? `${sleepH}` : '—'}
              </span>
              {sleepH != null && <span className="text-sm text-[#888888]">h</span>}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Sleep</span>
              <MetricInfo slug="sleep" />
              {TREND_LABEL[sleepTrendKey].text && (
                <span className={cn('text-[10px] font-bold uppercase tracking-[0.12em]', TREND_LABEL_LIGHT[sleepTrendKey])}>
                  {TREND_LABEL[sleepTrendKey].text}
                </span>
              )}
            </div>
            {sleepH == null && <p className="text-xs text-[#888888] mt-1">No recent sleep data</p>}
          </div>

          {/* Resting HR */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-[#0D0D0D] dark:text-zinc-50 tabular-nums leading-none" style={{ fontSize: '3rem' }}>
                {rhrValue != null ? rhrValue : '—'}
              </span>
              {rhrValue != null && <span className="text-sm text-[#888888]">bpm</span>}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Resting HR</span>
              <MetricInfo slug="resting-heart-rate" />
              {TREND_LABEL[rhrTrendKey].text && (
                <span className={cn('text-[10px] font-bold uppercase tracking-[0.12em]', TREND_LABEL_LIGHT[rhrTrendKey])}>
                  {TREND_LABEL[rhrTrendKey].text}
                </span>
              )}
            </div>
          </div>

          {/* Recovery score */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-[#0D0D0D] dark:text-zinc-50 tabular-nums leading-none" style={{ fontSize: '3rem' }}>
                {recovery.score}
              </span>
              <span className="text-sm text-[#888888]">/ 100</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Recovery score</span>
              <MetricInfo slug="recovery-score" />
            </div>
          </div>
        </div>

        {/* 14-day averages */}
        {(avg14dSleep || avg14dHrv || avg14dRhr) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-6 pt-5 border-t border-[#D9D9D9]">
            {avg14dSleep && <p className="text-xs text-[#888888]">14d sleep: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-300">{avg14dSleep}h</span></p>}
            {avg14dHrv   && <p className="text-xs text-[#888888]">14d HRV: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-300">{avg14dHrv} ms</span></p>}
            {avg14dRhr   && <p className="text-xs text-[#888888]">14d RHR: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-300">{avg14dRhr} bpm</span></p>}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ZONE 3 — Light Graphite / Charts with summaries
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#EDEDEB] dark:bg-zinc-900/80 px-6 sm:px-10 lg:px-14 py-10 space-y-12">

        {/* Sleep chart */}
        <div>
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Sleep · 14 days</span>
                <MetricInfo slug="sleep" />
              </div>
              {/* Summary */}
              <div className="flex gap-4 text-xs text-[#888888]">
                {sleepH != null && (
                  <span>Current: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{sleepH}h</span></span>
                )}
                {avg14dSleep && (
                  <span>14d avg: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{avg14dSleep}h</span></span>
                )}
                {TREND_LABEL[sleepTrendKey].text && (
                  <span className={cn('font-semibold', TREND_LABEL_LIGHT[sleepTrendKey])}>
                    {TREND_LABEL[sleepTrendKey].text}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-[#888888] flex-shrink-0 ml-4">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400 inline-block" /> ≥7h</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" /> 6–7h</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-400 inline-block" /> &lt;6h</span>
            </div>
          </div>
          <SleepChart data={sleepData} />
        </div>

        {/* HRV + RHR */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* HRV */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">HRV · 14 days</span>
              <MetricInfo slug="hrv" />
            </div>
            <div className="flex gap-4 text-xs text-[#888888] mb-5">
              {hrvValue != null && (
                <span>Current: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{hrvValue} ms</span></span>
              )}
              {avg14dHrv && (
                <span>14d avg: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{avg14dHrv} ms</span></span>
              )}
              {TREND_LABEL[hrvTrendKey].text && (
                <span className={cn('font-semibold', TREND_LABEL_LIGHT[hrvTrendKey])}>
                  {TREND_LABEL[hrvTrendKey].text}
                </span>
              )}
            </div>
            {hrvData.some(d => d.hrv != null) ? (
              <HrvChart data={hrvData} />
            ) : (
              <p className="text-sm text-[#888888] py-8">No recent HRV data</p>
            )}
          </div>

          {/* Resting HR */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Resting HR · 14 days</span>
              <MetricInfo slug="resting-heart-rate" />
            </div>
            <div className="flex gap-4 text-xs text-[#888888] mb-5">
              {rhrValue != null && (
                <span>Current: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{rhrValue} bpm</span></span>
              )}
              {avg14dRhr && (
                <span>14d avg: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{avg14dRhr} bpm</span></span>
              )}
              {TREND_LABEL[rhrTrendKey].text && (
                <span className={cn('font-semibold', TREND_LABEL_LIGHT[rhrTrendKey])}>
                  {TREND_LABEL[rhrTrendKey].text}
                </span>
              )}
            </div>
            {rhrData.some(d => d.rhr != null) ? (
              <RestingHrChart data={rhrData} />
            ) : (
              <p className="text-sm text-[#888888] py-8">No recent resting HR data</p>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
