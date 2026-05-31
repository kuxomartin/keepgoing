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

// ── Status config ─────────────────────────────────────────────────────────────
// Recovery card = diagnostics only. No actions — Today owns actions.
// Red accent is reserved for low recovery: the one intentional signal on this page.

const STATUS_CONFIG = {
  green:  {
    bar:          'bg-emerald-500',
    headlineText: 'Well recovered today.',
    headlineCls:  'text-emerald-300',
  },
  yellow: {
    bar:          'bg-amber-400',
    headlineText: 'Moderate recovery today.',
    headlineCls:  'text-amber-300',
  },
  red:    {
    bar:          'bg-[#E5173F]',
    headlineText: 'Low recovery today.',
    headlineCls:  'text-[#E5173F]',   // brand red — intentional accent
  },
} as const

// ── Trend labels for outside-card vitals (light background) ──────────────────

const TREND_LABEL: Record<string, { text: string; cls: string }> = {
  green: { text: '↑ improving', cls: 'text-emerald-500 dark:text-emerald-400'  },
  amber: { text: '↓ declining', cls: 'text-amber-500 dark:text-amber-400'      },
  red:   { text: '↓ declining', cls: 'text-[#E5173F]'                          },
  blue:  { text: '→ stable',    cls: 'text-gray-400 dark:text-zinc-500'        },
  gray:  { text: '',            cls: ''                                         },
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
      ? deduplicateByDate(rawMetrics as HealthMetrics[])
      : mockHealthMetrics.slice().sort((a, b) => a.date.localeCompare(b.date))

  const todayMetrics = metrics.find((m) => m.date === today) ?? metrics[metrics.length - 1] ?? null
  const recovery     = getRecoveryScore(todayMetrics)

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

  // 7-day spark arrays for trend direction
  const last7      = metrics.slice(-7)
  const hrvSpark   = last7.map(m => m.hrv_ms ? Number(m.hrv_ms) : null).filter((v): v is number => v != null)
  const sleepSpark = last7.map(m => m.sleep_minutes ? m.sleep_minutes / 60 : null).filter((v): v is number => v != null)
  const rhrSpark   = last7.map(m => m.resting_hr).filter((v): v is number => v != null)

  // Pre-compute trend keys
  const hrvTrendKey   = hrvSpark.length >= 4   ? trendColor(hrvSpark,   true)  : 'gray'
  const sleepTrendKey = sleepSpark.length >= 4 ? trendColor(sleepSpark, true)  : 'gray'
  const rhrTrendKey   = rhrSpark.length >= 4   ? trendColor(rhrSpark,   false) : 'gray'

  // 7-day averages
  const avg7dSleep = sevenDayAverage(metrics.map((m) => m.sleep_minutes ? m.sleep_minutes / 60 : null))
  const avg7dHrv   = sevenDayAverage(metrics.map((m) => m.hrv_ms ? Number(m.hrv_ms) : null))
  const avg7dRhr   = sevenDayAverage(metrics.map((m) => m.resting_hr))

  const isUsingMock = !rawMetrics || rawMetrics.length === 0

  const heroStatus = recovery.status as keyof typeof STATUS_CONFIG
  const hero       = STATUS_CONFIG[heroStatus] ?? STATUS_CONFIG.yellow

  // Today's raw values for outside-card metrics
  const sleepH   = todayMetrics?.sleep_minutes ? todayMetrics.sleep_minutes / 60 : null
  const hrvValue = todayMetrics?.hrv_ms != null ? Math.round(Number(todayMetrics.hrv_ms)) : null
  const rhrValue = todayMetrics?.resting_hr ?? null

  const hasVitals = sleepH != null || hrvValue != null || rhrValue != null

  return (
    <div className="space-y-10">

      {/* Page label */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Recovery</p>
        {isUsingMock && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-3 py-1.5 inline-block">
            Showing demo data — sync your Google Sheet in Settings to see real data
          </p>
        )}
      </div>

      {/* ── DIAGNOSTIC CARD ──────────────────────────────────────────────────
          Briefing-style. Answers: what is happening and why.
          No score. No actions. Recovery = diagnostics. Today = decisions.
      ─────────────────────────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-zinc-950">
        {/* Status accent — thin top bar */}
        <div className={cn('absolute top-0 left-0 right-0 h-0.5', hero.bar)} />

        <div className="px-6 pt-6 pb-8 space-y-4">

          {/* Eyebrow */}
          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest block">
            Today
          </span>

          {/* Status headline — the hero of this card */}
          <p className={cn('text-3xl font-bold leading-snug', hero.headlineCls)}>
            {hero.headlineText}
          </p>

          {/* Interpretation — what the data says (diagnostic only) */}
          {recovery.issues.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {recovery.issues.map((issue, i) => (
                <p key={i} className="text-sm text-white/55 leading-relaxed">
                  {issue}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RAW VITALS — outside the card, large, diagnostic evidence ────────
          These are the actual measurements that produced the status above.
          Three equal columns — all are relevant on Recovery.
      ─────────────────────────────────────────────────────────────────────── */}
      {hasVitals && (
        <div className={cn(
          'grid gap-8',
          [hrvValue != null, sleepH != null, rhrValue != null].filter(Boolean).length === 3
            ? 'grid-cols-3'
            : [hrvValue != null, sleepH != null, rhrValue != null].filter(Boolean).length === 2
              ? 'grid-cols-2'
              : 'grid-cols-1'
        )}>
          {hrvValue != null && (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-gray-900 dark:text-zinc-50 tabular-nums leading-none">
                  {hrvValue}
                </span>
                <span className="text-sm text-gray-400 dark:text-zinc-500">ms</span>
              </div>
              {TREND_LABEL[hrvTrendKey].text && (
                <p className={cn('text-xs mt-1', TREND_LABEL[hrvTrendKey].cls)}>
                  {TREND_LABEL[hrvTrendKey].text}
                </p>
              )}
              <div className="flex items-center gap-0.5 mt-1.5">
                <span className="text-xs text-gray-400 dark:text-zinc-500">HRV</span>
                <MetricInfo slug="hrv" />
              </div>
            </div>
          )}
          {sleepH != null && (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-gray-900 dark:text-zinc-50 tabular-nums leading-none">
                  {sleepH.toFixed(1)}
                </span>
                <span className="text-sm text-gray-400 dark:text-zinc-500">h</span>
              </div>
              {TREND_LABEL[sleepTrendKey].text && (
                <p className={cn('text-xs mt-1', TREND_LABEL[sleepTrendKey].cls)}>
                  {TREND_LABEL[sleepTrendKey].text}
                </p>
              )}
              <div className="flex items-center gap-0.5 mt-1.5">
                <span className="text-xs text-gray-400 dark:text-zinc-500">Sleep</span>
                <MetricInfo slug="sleep" />
              </div>
            </div>
          )}
          {rhrValue != null && (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-gray-900 dark:text-zinc-50 tabular-nums leading-none">
                  {rhrValue}
                </span>
                <span className="text-sm text-gray-400 dark:text-zinc-500">bpm</span>
              </div>
              {TREND_LABEL[rhrTrendKey].text && (
                <p className={cn('text-xs mt-1', TREND_LABEL[rhrTrendKey].cls)}>
                  {TREND_LABEL[rhrTrendKey].text}
                </p>
              )}
              <div className="flex items-center gap-0.5 mt-1.5">
                <span className="text-xs text-gray-400 dark:text-zinc-500">Resting HR</span>
                <MetricInfo slug="resting-heart-rate" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RECOVERY SCORE — footnote, exists but does not dominate ──────────
          The score supports interpretation. It is not the lead.
      ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-t border-gray-200 dark:border-zinc-800 pt-4">
        <span className="text-sm text-gray-400 dark:text-zinc-500">Recovery score</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300 tabular-nums">
          {recovery.score} / 100
        </span>
        <MetricInfo slug="recovery-score" />
      </div>

      {/* ── 7-day averages ───────────────────────────────────────────────────── */}
      {(avg7dSleep || avg7dHrv || avg7dRhr) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 -mt-4">
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

      {/* ── TREND CHARTS — 14-day context ───────────────────────────────────── */}
      <div className="space-y-10">
        <div>
          <div className="flex items-center justify-between mb-4">
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
          <SleepChart data={sleepData} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div>
            <div className="flex items-center gap-1.5 mb-4">
              <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">HRV</span>
              <span className="text-xs text-gray-400 dark:text-zinc-500">14 days</span>
              <MetricInfo slug="hrv" />
            </div>
            <HrvChart data={hrvData} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-4">
              <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Resting HR</span>
              <span className="text-xs text-gray-400 dark:text-zinc-500">14 days</span>
              <MetricInfo slug="resting-heart-rate" />
            </div>
            <RestingHrChart data={rhrData} />
          </div>
        </div>
      </div>

    </div>
  )
}
