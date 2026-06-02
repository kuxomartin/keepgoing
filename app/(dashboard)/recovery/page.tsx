export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, subDays, startOfDay } from 'date-fns'
import { MetricInfo } from '@/components/ui/metric-info'
import { trendColor } from '@/lib/spark-utils'
import { SleepChart } from '@/components/charts/sleep-chart'
import { HrvChart } from '@/components/charts/hrv-chart'
import { RestingHrChart } from '@/components/charts/resting-hr-chart'
import { RecoveryScoreChart } from '@/components/charts/recovery-score-chart'
import { getRecoveryScore } from '@/lib/calculations/recovery-score'
import { sevenDayAverage } from '@/lib/calculations/weekly-totals'
import {
  buildDailyRecoveryScores,
  getTrainingWindow,
  buildDriverCards,
  correlSleepVsRecovery,
  correlCaffeineVsRecovery,
  correlTrainingVsRecovery,
  correlDeficitVsRecovery,
  buildRecoveryOpportunities,
  buildRecoveryExperiments,
  type RecoveryCorrelation,
} from '@/lib/calculations/recovery-intelligence'
import { mockHealthMetrics } from '@/lib/mock-data/demo-data'
import { computeRecoveryKillers } from '@/lib/insights/recovery-killers'
import { computeRecoveryDebug } from '@/lib/calculations/recovery-debug'
import type { HealthMetrics } from '@/types/database'
import { cn } from '@/lib/utils'

const IS_DEV = process.env.NODE_ENV === 'development'

/**
 * Merges all health_metrics rows for the same date into one record.
 * Different sources hold different fields:
 *   apple_health        → HRV, steps, energy, resting HR, VO₂ max (HAE direct)
 *   apple_health_sleep  → sleep_minutes, deep_sleep_minutes, rem_sleep_minutes (HAE direct)
 *   google_sheets       → HRV, steps, energy, resting HR, VO₂ max (legacy GS)
 *   google_sheets_sleep → sleep_minutes, deep_sleep_minutes, rem_sleep_minutes (legacy GS)
 */
function mergeByDate(metrics: HealthMetrics[]): HealthMetrics[] {
  // apple_health = direct HAE ingest (new). google_sheets = legacy GS import. Both coexist safely.
  const SOURCE_PRIORITY = ['apple_health', 'apple_health_sleep', 'google_sheets', 'google_sheets_sleep', 'apple_health_export', 'manual', 'mock']
  const sorted = [...metrics].sort((a, b) =>
    SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source)
  )

  const byDate = new Map<string, HealthMetrics>()
  for (const m of sorted) {
    const existing = byDate.get(m.date)
    if (!existing) {
      byDate.set(m.date, { ...m })
    } else {
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

const STATUS_CLS = {
  green:  'text-[#16A34A]',
  yellow: 'text-white',
  orange: 'text-[#D97706]',
  red:    'text-[#E5173F]',
} as const

type HeroStatus = 'green' | 'yellow' | 'orange' | 'red'

function getHeroHeadline(status: HeroStatus, isCurrentDay: boolean): string {
  const day = isCurrentDay ? ' today.' : '.'
  return {
    green:  `Well recovered${day}`,
    yellow: `Moderately recovered${day}`,
    orange: `Recovery limited${day}`,
    red:    `Low recovery${day}`,
  }[status]
}

function getRecoveryExplanation(
  status: HeroStatus,
  hrvValue: number | null,
  avgHrv14d: number | null,
  sleepH: number | null,
): string {
  const sleepLow = sleepH != null && sleepH < 7
  const sleepOk  = sleepH != null && sleepH >= 7
  const hrvLow   = hrvValue != null && avgHrv14d != null && hrvValue < avgHrv14d * 0.97
  const hrvOk    = hrvValue != null && avgHrv14d != null && hrvValue >= avgHrv14d * 0.97

  if (status === 'green') {
    if (sleepOk && hrvOk)  return 'Sleep and HRV are both within target range.'
    if (sleepOk)           return 'Sleep is adequate. HRV signals are within range.'
    return 'Key recovery signals are within normal range.'
  }

  if (status === 'yellow') {
    if (sleepLow && hrvLow) return 'Recovery is usable, but sleep and HRV are below target.'
    if (sleepLow)           return 'Recovery is usable. Sleep is below the 7h target.'
    if (hrvLow)             return 'Recovery is usable. HRV is below the 14-day baseline.'
    return 'Recovery is at a moderate level. No single signal is significantly suppressed.'
  }

  if (status === 'orange') {
    if (sleepLow && hrvLow) return 'Sleep and HRV are both below target. Easy work only.'
    if (sleepLow)           return 'Sleep is below target. Keep effort low today.'
    if (hrvLow)             return 'HRV is below the 14-day baseline. Keep effort low today.'
    return 'Recovery signals indicate limited readiness. Easy aerobic work only.'
  }

  // red
  if (sleepLow && hrvLow) return 'Short sleep and suppressed HRV. Rest is the priority.'
  if (sleepLow)           return 'Sleep was short. Prioritize rest and recovery today.'
  if (hrvLow)             return 'HRV is significantly below baseline. Rest today.'
  return 'Multiple recovery signals are suppressed. Prioritize rest.'
}

const TREND_LABEL: Record<string, { text: string; cls: string }> = {
  green: { text: '↑ improving', cls: 'text-[#16A34A]' },
  amber: { text: '↓ declining', cls: 'text-[#D97706]' },
  red:   { text: '↓ declining', cls: 'text-[#E5173F]' },
  blue:  { text: '→ stable',   cls: 'text-white/40'   },
  gray:  { text: '',           cls: ''                 },
}

// Shared container
function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16', className)}>
      {children}
    </div>
  )
}

export default async function RecoveryPage() {
  const supabase = await createClient()

  const today     = format(new Date(), 'yyyy-MM-dd')
  const d30ago    = format(subDays(startOfDay(new Date()), 29), 'yyyy-MM-dd')
  const d14ago    = format(subDays(startOfDay(new Date()), 13), 'yyyy-MM-dd')

  // Primary data + correlation inputs — all parallel
  const [
    { data: rawMetrics30 },
    { data: coffeeAll30d },
    { data: foodAll30d },
    { data: activitiesAll30d },
  ] = await Promise.all([
    supabase
      .from('health_metrics')
      .select('*')
      .gte('date', d30ago)
      .lte('date', today)
      .order('date', { ascending: true }),
    supabase.from('coffee_logs').select('date, consumed_at').gte('date', d30ago).lte('date', today),
    supabase.from('food_logs').select('date, estimated_calories').gte('date', d30ago).lte('date', today),
    supabase.from('activities').select('start_time, duration_minutes, avg_hr, activity_type')
      .gte('start_time', d30ago + 'T00:00:00')
      .lte('start_time', today + 'T23:59:59'),
  ])

  const metrics30: HealthMetrics[] =
    rawMetrics30 && rawMetrics30.length > 0
      ? mergeByDate(rawMetrics30 as HealthMetrics[])
      : mockHealthMetrics.slice().sort((a, b) => a.date.localeCompare(b.date))

  const isUsingMock = !rawMetrics30 || rawMetrics30.length === 0

  // 14-day slice (for charts and today's view)
  const metrics14 = metrics30.filter(m => m.date >= d14ago)

  // Today's or most recent metrics
  const todayMetrics = metrics30.find((m) => m.date === today) ?? metrics30[metrics30.length - 1] ?? null
  const recovery     = getRecoveryScore(todayMetrics)

  // ── Trend data ─────────────────────────────────────────────────────────────
  const sleepData = metrics14.map((m) => ({
    date:  m.date,
    hours: m.sleep_minutes && m.sleep_minutes > 0
      ? Math.round((m.sleep_minutes / 60) * 10) / 10
      : null,
  }))
  const hrvData = metrics14.map((m) => ({
    date: m.date,
    hrv:  m.hrv_ms ? Math.round(Number(m.hrv_ms)) : null,
  }))
  const rhrData = metrics14.map((m) => ({ date: m.date, rhr: m.resting_hr }))

  // ── Spark arrays ───────────────────────────────────────────────────────────
  const last7      = metrics14.slice(-7)
  const hrvSpark   = last7.map(m => m.hrv_ms ? Number(m.hrv_ms) : null).filter((v): v is number => v != null)
  const sleepSpark = last7.map(m => m.sleep_minutes && m.sleep_minutes > 0 ? m.sleep_minutes / 60 : null).filter((v): v is number => v != null)
  const rhrSpark   = last7.map(m => m.resting_hr).filter((v): v is number => v != null)

  const hrvTrendKey   = hrvSpark.length >= 4   ? trendColor(hrvSpark,   true)  : 'gray'
  const sleepTrendKey = sleepSpark.length >= 4 ? trendColor(sleepSpark, true)  : 'gray'
  const rhrTrendKey   = rhrSpark.length >= 4   ? trendColor(rhrSpark,   false) : 'gray'

  // ── 14-day averages ────────────────────────────────────────────────────────
  const avg14dSleep = sevenDayAverage(metrics14.map(m => m.sleep_minutes && m.sleep_minutes > 0 ? m.sleep_minutes / 60 : null))
  const avg14dHrv   = sevenDayAverage(metrics14.map(m => m.hrv_ms ? Number(m.hrv_ms) : null))
  const avg14dRhr   = sevenDayAverage(metrics14.map(m => m.resting_hr))

  // ── Data date — Apple Health rows may lag behind today ────────────────────
  const dataDate      = todayMetrics?.date ?? null
  const isCurrentDay  = dataDate === today
  const dataDateLabel = dataDate && !isCurrentDay
    ? format(new Date(dataDate + 'T12:00:00'), 'd MMM yyyy')
    : null

  // ── Hero values ────────────────────────────────────────────────────────────
  const heroStatus    = recovery.status as HeroStatus
  const heroHeadline  = getHeroHeadline(heroStatus, isCurrentDay)
  const heroHeadlineCls = STATUS_CLS[heroStatus] ?? STATUS_CLS.orange
  const recentWithSleep = [...metrics14].reverse().find(m => m.sleep_minutes && m.sleep_minutes > 0)
  const sleepH = recentWithSleep?.sleep_minutes
    ? Math.round((recentWithSleep.sleep_minutes / 60) * 10) / 10
    : null
  const hrvValue = todayMetrics?.hrv_ms != null ? Math.round(Number(todayMetrics.hrv_ms)) : null
  const rhrValue = todayMetrics?.resting_hr ?? null

  const recoveryExplanation = getRecoveryExplanation(heroStatus, hrvValue, avg14dHrv, sleepH)

  // ── Intelligence ───────────────────────────────────────────────────────────
  const dailyScores = buildDailyRecoveryScores(metrics30)
  const avgScore30d = dailyScores.length >= 5
    ? Math.round(dailyScores.reduce((s, d) => s + d.score, 0) / dailyScores.length)
    : null

  // Training window
  const trainingWindow = getTrainingWindow(recovery.score, hrvTrendKey)

  // Driver cards
  const driverCards = buildDriverCards({
    hrvValue,
    avgHrv14d: avg14dHrv,
    sleepH,
    recoveryScore: recovery.score,
    avgScore30d,
  })

  // Recovery score chart data
  const scoreChartData = dailyScores.map(d => ({ date: d.date, score: d.score }))

  // Trend stats
  const trendSpark = dailyScores.map(d => d.score)
  const recoveryTrendKey = trendSpark.length >= 4 ? trendColor(trendSpark, true) : 'gray'

  // Correlations
  const intakeByDate: Record<string, number> = {}
  for (const f of foodAll30d ?? []) {
    const row = f as { date: string; estimated_calories?: number }
    intakeByDate[row.date] = (intakeByDate[row.date] ?? 0) + (row.estimated_calories ?? 0)
  }
  const burnByDate: Record<string, number> = {}
  for (const m of metrics30) {
    const burn = (m.active_energy_kcal ?? 0) + (m.resting_energy_kcal ?? 0)
    if (burn > 0) burnByDate[m.date] = burn
  }

  const correlations: RecoveryCorrelation[] = []
  const c1 = correlSleepVsRecovery(dailyScores, metrics30)
  if (c1) correlations.push(c1)
  const c2 = correlCaffeineVsRecovery(
    dailyScores,
    (coffeeAll30d ?? []) as Array<{ date: string; consumed_at: string }>
  )
  if (c2) correlations.push(c2)
  const c3 = correlTrainingVsRecovery(
    dailyScores,
    (activitiesAll30d ?? []) as Array<{ start_time: string; duration_minutes: number | null; avg_hr: number | null; activity_type: string }>
  )
  if (c3) correlations.push(c3)
  const c4 = correlDeficitVsRecovery(dailyScores, intakeByDate, burnByDate)
  if (c4) correlations.push(c4)

  // Recovery Killers — correlate day-prior factors with next-day score
  const coffeeDaysForKillers = (() => {
    const byDate: Record<string, { caffeineMg: number; lastHour: number | null }> = {}
    for (const c of coffeeAll30d ?? []) {
      const row = c as { date: string; consumed_at: string }
      const hour = parseInt(row.consumed_at.slice(11, 13), 10)
      if (!byDate[row.date]) byDate[row.date] = { caffeineMg: 0, lastHour: null }
      byDate[row.date].caffeineMg += 0  // caffeine not selected in this query — hour only
      if (byDate[row.date].lastHour == null || hour > (byDate[row.date].lastHour ?? 0)) {
        byDate[row.date].lastHour = hour
      }
    }
    return Object.entries(byDate).map(([date, v]) => ({ date, ...v }))
  })()

  const foodDaysForKillers = (() => {
    const intake: Record<string, number> = {}
    for (const f of foodAll30d ?? []) {
      const row = f as { date: string; estimated_calories?: number }
      intake[row.date] = (intake[row.date] ?? 0) + (row.estimated_calories ?? 0)
    }
    return Object.entries(intake).map(([date, calories]) => ({
      date,
      calories: calories > 0 ? calories : null,
      burn: burnByDate[date] ?? null,
    }))
  })()

  const activityDaysForKillers = (activitiesAll30d ?? []).map(a => {
    const row = a as { start_time: string; duration_minutes: number | null }
    return { date: row.start_time.slice(0, 10), durationMinutes: row.duration_minutes ?? 0 }
  })

  const recoveryKillers = isUsingMock ? [] : computeRecoveryKillers(
    metrics30,
    coffeeDaysForKillers,
    foodDaysForKillers,
    activityDaysForKillers,
  )

  // Opportunities + experiments
  const opportunities = buildRecoveryOpportunities({
    avgSleepH: avg14dSleep,
    avgRhr: avg14dRhr,
    correlations,
  })
  const experiments = buildRecoveryExperiments({
    correlations,
    avgSleepH: avg14dSleep,
    avgRhr: avg14dRhr,
  })

  // ── Debug breakdown (dev only) ────────────────────────────────────────────
  const weeklyLoadMinsRecovery = (() => {
    const d7 = format(subDays(startOfDay(new Date()), 6), 'yyyy-MM-dd')
    let total = 0
    for (const a of activitiesAll30d ?? []) {
      const row = a as { start_time: string; duration_minutes: number | null }
      if (row.start_time.slice(0, 10) >= d7) total += row.duration_minutes ?? 0
    }
    return total
  })()

  const hardSessionDatesRecovery = (activitiesAll30d ?? [])
    .filter((a) => ((a as { duration_minutes: number | null }).duration_minutes ?? 0) >= 45)
    .map((a) => (a as { start_time: string }).start_time.slice(0, 10))
    .sort()
    .reverse()

  const daysSinceHardRecovery = hardSessionDatesRecovery.length > 0
    ? Math.round((new Date().getTime() - new Date(hardSessionDatesRecovery[0] + 'T12:00:00').getTime()) / 86400000)
    : null

  const debugBreakdown = IS_DEV
    ? computeRecoveryDebug(
        todayMetrics,
        avg14dHrv,
        weeklyLoadMinsRecovery,
        daysSinceHardRecovery,
        isCurrentDay,
      )
    : null

  return (
    <div className="flex flex-col bg-[#151A20]">

      {/* ══════════════════════════════════════════════════════════════════
          ZONE 1 — Hero
      ══════════════════════════════════════════════════════════════════ */}
      <div className="pt-10 pb-12">
        <Container>
          {/* Page label + data date */}
          <div className="flex items-center gap-3 mb-8">
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.15em]">Recovery</p>
            {dataDateLabel && (
              <span className="text-[10px] text-white/25 uppercase tracking-[0.12em]">
                · {dataDateLabel}
              </span>
            )}
            {isUsingMock && (
              <span className="text-[10px] text-amber-400/60 uppercase tracking-widest">demo data</span>
            )}
          </div>

          {/* Verdict */}
          <h1
            className={cn('font-display font-bold leading-none mb-4', heroHeadlineCls)}
            style={{ fontSize: 'clamp(3.5rem, 7vw, 6rem)', letterSpacing: '-0.03em', maxWidth: '900px' }}
          >
            {heroHeadline}
          </h1>

          {/* Explanation */}
          <p className="text-base text-white/50 leading-relaxed max-w-xl mb-5">
            {recoveryExplanation}
          </p>

          {/* Training recommendation — most important output */}
          <p className="text-base font-semibold text-white/80 leading-relaxed max-w-xl mb-12">
            {trainingWindow.recommendation}
          </p>

          {/* HRV — large hero number */}
          {hrvValue != null ? (
            <div>
              <div className="flex items-baseline gap-3">
                <span
                  className="font-bold text-white font-mono tabular-nums leading-none"
                  style={{ fontSize: '7rem' }}
                >
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
            <p className="text-white/25 text-sm">No HRV data — connect Apple Health in Settings.</p>
          )}
        </Container>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          ZONE 2 — What Drives Today's Recovery
      ══════════════════════════════════════════════════════════════════ */}
      <div className="border-t border-white/[0.06] pt-10 pb-12">
        <Container>
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-8">
            What Drives Today's Recovery
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {driverCards.map((card) => (
              <div key={card.label} className="bg-[#1E2530] border border-white/[0.06]">
                <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] mb-3">
                    {card.label}
                  </p>
                  <p className="font-mono font-bold text-white tabular-nums leading-none mb-2"
                     style={{ fontSize: '1.75rem' }}>
                    {card.value}
                  </p>
                  <p className="font-mono text-xs text-white/40">{card.subvalue}</p>
                </div>
                <div className="px-6 py-4">
                  <p className={cn(
                    'text-sm font-medium leading-snug',
                    card.signalType === 'positive' ? 'text-white/70'
                    : card.signalType === 'negative' ? 'text-[#E5173F]/80'
                    : 'text-white/40'
                  )}>
                    {card.signal}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          ZONE 3 — Today's Training Window
      ══════════════════════════════════════════════════════════════════ */}
      <div className="border-t border-white/[0.06] pt-10 pb-12">
        <Container>
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-6">
            Today's Training Window
          </p>

          <h2
            className="font-black text-white mb-8"
            style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', lineHeight: 1.05, letterSpacing: '-0.02em', maxWidth: '700px' }}
          >
            {trainingWindow.recommendation}
          </h2>

          <div className="flex flex-col sm:flex-row gap-8 max-w-2xl">
            {trainingWindow.recommended.length > 0 && (
              <div className="flex-1">
                <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-3">Recommended</p>
                <ul className="space-y-2">
                  {trainingWindow.recommended.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-white/30 text-xs mt-0.5 flex-shrink-0">—</span>
                      <span className="text-sm text-white/70 leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {trainingWindow.avoid.length > 0 && (
              <div className="flex-1">
                <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-3">Avoid</p>
                <ul className="space-y-2">
                  {trainingWindow.avoid.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[#E5173F]/40 text-xs mt-0.5 flex-shrink-0">—</span>
                      <span className="text-sm text-white/40 leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Container>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          ZONE 4 — Recovery Trend (30 days)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="border-t border-white/[0.06] pt-10 pb-12">
        <Container>
          <div className="mb-5">
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.18em] mb-1">
              Readiness Score · 30 Days
            </p>
            <div className="flex flex-wrap gap-5 text-xs text-white/30">
              <span>Current: <span className="font-semibold text-white/60 font-mono">{recovery.score}</span></span>
              {avgScore30d && (
                <span>30d avg: <span className="font-semibold text-white/60 font-mono">{avgScore30d}</span></span>
              )}
              {TREND_LABEL[recoveryTrendKey].text && (
                <span className={cn('font-semibold', TREND_LABEL[recoveryTrendKey].cls)}>
                  {TREND_LABEL[recoveryTrendKey].text}
                </span>
              )}
            </div>
          </div>
          <RecoveryScoreChart data={scoreChartData} chartHeight={180} />
          <div className="flex gap-5 mt-4 text-[10px] text-white/25">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm inline-block bg-[#55606C]" /> ≥70 — good
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#FFB000' }} /> 45–70 — moderate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#E5173F' }} /> &lt;45 — low
            </span>
          </div>
        </Container>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          ZONE 5 — Recovery Drivers (correlations)
      ══════════════════════════════════════════════════════════════════ */}
      {correlations.length > 0 && (
        <div className="border-t border-white/[0.06] pt-10 pb-12">
          <Container>
            <div className="mb-8">
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-3">
                Recovery Drivers
              </p>
              <h2 className="font-black text-white text-2xl sm:text-3xl" style={{ lineHeight: 1.0 }}>
                What shapes your recovery.
              </h2>
              <p className="text-sm text-white/35 mt-2">
                Association from 30 days of data — not causal. Requires sufficient records.
              </p>
            </div>

            <div className={cn(
              'grid gap-4',
              correlations.length === 1 ? 'grid-cols-1 max-w-2xl' : 'grid-cols-1 lg:grid-cols-2'
            )}>
              {correlations.map(corr => (
                <div key={corr.id} className="bg-[#1E2530] border border-white/[0.06]">
                  <div className="px-7 pt-7 pb-5 border-b border-white/[0.06]">
                    <h3
                      className="font-bold text-white leading-tight"
                      style={{ fontSize: '1.125rem', letterSpacing: '-0.01em' }}
                    >
                      {corr.title}
                    </h3>
                  </div>
                  <div className="px-7 py-5 border-b border-white/[0.06]">
                    <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1.5">Observed</p>
                    <p className="font-bold text-white text-sm leading-relaxed">{corr.finding}</p>
                  </div>
                  <div className="px-7 py-5">
                    <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1.5">Interpretation</p>
                    <p className="text-sm text-white/55 leading-relaxed">{corr.interpretation}</p>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ZONE 5b — What Hurts Your Recovery
      ══════════════════════════════════════════════════════════════════ */}
      {recoveryKillers.length > 0 && (
        <div className="border-t border-white/[0.06] pt-10 pb-12">
          <Container>
            <div className="mb-8">
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-3">
                What Hurts Your Recovery
              </p>
              <h2 className="font-black text-white text-2xl sm:text-3xl" style={{ lineHeight: 1.0 }}>
                Patterns from your history.
              </h2>
              <p className="text-sm text-white/35 mt-2">
                Factors that are statistically associated with lower recovery in your data.
              </p>
            </div>

            <div className={cn(
              'grid gap-4',
              recoveryKillers.length === 1 ? 'grid-cols-1 max-w-lg' : 'grid-cols-1 sm:grid-cols-2'
            )}>
              {recoveryKillers.map(killer => (
                <div key={killer.key} className="bg-[#1E2530] border border-white/[0.06]">
                  <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
                    <h3 className="font-bold text-white leading-tight mb-3"
                        style={{ fontSize: '1.0rem', letterSpacing: '-0.01em' }}>
                      {killer.label}
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-2xl font-bold text-[#E5173F] tabular-nums leading-none">
                        −{killer.avgImpact}
                      </span>
                      <span className="text-sm text-white/30 font-mono">pts avg recovery</span>
                    </div>
                  </div>
                  <div className="px-6 py-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1">
                        Without
                      </p>
                      <p className="font-mono text-lg font-bold text-white/70 tabular-nums">
                        {killer.baselineAvg}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1">
                        With
                      </p>
                      <p className="font-mono text-lg font-bold text-[#E5173F]/70 tabular-nums">
                        {killer.affectedAvg}
                      </p>
                    </div>
                  </div>
                  <div className="px-6 pb-4">
                    <p className="text-[10px] text-white/20">
                      Based on {killer.sampleSize} affected day{killer.sampleSize !== 1 ? 's' : ''} in this window
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ZONE 6 — Top Recovery Opportunities
      ══════════════════════════════════════════════════════════════════ */}
      {opportunities.length > 0 && (
        <div className="border-t border-white/[0.06] pt-10 pb-12">
          <Container>
            <div className="mb-8">
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-3">
                Top Recovery Opportunities
              </p>
              <h2 className="font-black text-white text-2xl sm:text-3xl" style={{ lineHeight: 1.0 }}>
                Where to focus.
              </h2>
            </div>

            <div className={cn(
              'grid gap-4',
              opportunities.length === 1 ? 'grid-cols-1 max-w-2xl' : 'grid-cols-1 sm:grid-cols-2'
            )}>
              {opportunities.map((opp, i) => (
                <div key={i} className="bg-[#1E2530] border border-white/[0.06]">
                  <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
                    <h3 className="font-bold text-white leading-tight"
                        style={{ fontSize: '1.0rem', letterSpacing: '-0.01em' }}>
                      {opp.action}
                    </h3>
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1">Potential impact</p>
                      <p className="text-sm font-semibold text-white/80">{opp.impact}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1">Reason</p>
                      <p className="text-sm text-white/50 leading-relaxed">{opp.reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ZONE 7 — Experiments to Try
      ══════════════════════════════════════════════════════════════════ */}
      {experiments.length > 0 && (
        <div className="border-t border-white/[0.06] pt-10 pb-12">
          <Container>
            <div className="mb-8">
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-3">
                Experiments to Try
              </p>
              <h2 className="font-black text-white text-2xl sm:text-3xl" style={{ lineHeight: 1.0 }}>
                Test a hypothesis.
              </h2>
              <p className="text-sm text-white/35 mt-2">
                Only shown when supported by observed patterns.
              </p>
            </div>

            <div className={cn(
              'grid gap-4',
              experiments.length <= 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl' : 'grid-cols-1 sm:grid-cols-2'
            )}>
              {experiments.map((exp, i) => (
                <div key={i} className="bg-[#1E2530] border border-white/[0.06]">
                  <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
                    <h3 className="font-bold text-white leading-tight mb-1"
                        style={{ fontSize: '1.0rem', letterSpacing: '-0.01em' }}>
                      {exp.title}
                    </h3>
                    <p className="font-mono text-[10px] text-white/30 uppercase tracking-[0.12em]">
                      {exp.duration}
                    </p>
                  </div>
                  <div className="px-6 py-5">
                    <p className="text-sm text-white/50 leading-relaxed">{exp.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ZONE 8 — Recovery Signals (supporting charts)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="border-t border-white/[0.06] pt-10 pb-12">
        <Container>
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-10">
            Recovery Signals · 14 Days
          </p>

          <div className="space-y-12">

            {/* Sleep */}
            <div>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.12em]">Sleep</span>
                    <MetricInfo slug="sleep" />
                  </div>
                  <div className="flex gap-4 text-xs text-white/30">
                    {sleepH != null && (
                      <span>Recent: <span className="font-semibold text-white/60">{sleepH}h</span></span>
                    )}
                    {avg14dSleep && (
                      <span>14d avg: <span className="font-semibold text-white/60">{avg14dSleep}h</span></span>
                    )}
                    {TREND_LABEL[sleepTrendKey].text && (
                      <span className={cn('font-semibold', TREND_LABEL[sleepTrendKey].cls)}>
                        {TREND_LABEL[sleepTrendKey].text}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-white/30 flex-shrink-0 ml-4">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm inline-block bg-[#55606C]" /> ≥7h
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#FFB000' }} /> 6–7h
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#E5173F' }} /> &lt;6h
                  </span>
                </div>
              </div>
              <SleepChart data={sleepData} onDark />
            </div>

            {/* HRV + RHR side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

              {/* HRV */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.12em]">HRV</span>
                  <MetricInfo slug="hrv" />
                </div>
                <div className="flex gap-4 text-xs text-white/30 mb-5">
                  {hrvValue != null && (
                    <span>Current: <span className="font-semibold text-white/60">{hrvValue} ms</span></span>
                  )}
                  {avg14dHrv && (
                    <span>14d avg: <span className="font-semibold text-white/60">{avg14dHrv} ms</span></span>
                  )}
                  {TREND_LABEL[hrvTrendKey].text && (
                    <span className={cn('font-semibold', TREND_LABEL[hrvTrendKey].cls)}>
                      {TREND_LABEL[hrvTrendKey].text}
                    </span>
                  )}
                </div>
                {hrvData.some(d => d.hrv != null) ? (
                  <HrvChart data={hrvData} onDark />
                ) : (
                  <p className="text-sm text-white/25 py-8">No recent HRV data</p>
                )}
              </div>

              {/* Resting HR */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.12em]">Resting HR</span>
                  <MetricInfo slug="resting-heart-rate" />
                </div>
                <div className="flex gap-4 text-xs text-white/30 mb-5">
                  {rhrValue != null && (
                    <span>Current: <span className="font-semibold text-white/60">{rhrValue} bpm</span></span>
                  )}
                  {avg14dRhr && (
                    <span>14d avg: <span className="font-semibold text-white/60">{avg14dRhr} bpm</span></span>
                  )}
                  {TREND_LABEL[rhrTrendKey].text && (
                    <span className={cn('font-semibold', TREND_LABEL[rhrTrendKey].cls)}>
                      {TREND_LABEL[rhrTrendKey].text}
                    </span>
                  )}
                </div>
                {rhrData.some(d => d.rhr != null) ? (
                  <RestingHrChart data={rhrData} onDark />
                ) : (
                  <p className="text-sm text-white/25 py-8">No recent resting HR data</p>
                )}
              </div>
            </div>

          </div>
        </Container>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DEBUG — developer-only score breakdown (NODE_ENV=development)
      ══════════════════════════════════════════════════════════════════ */}
      {IS_DEV && debugBreakdown && (
        <div className="border-t-2 border-dashed border-yellow-500/30 pt-10 pb-12 bg-[#0D1117]">
          <Container>
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
              <span className="px-2 py-0.5 bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold uppercase tracking-widest">
                DEV
              </span>
              <p className="text-[10px] font-bold text-yellow-400/60 uppercase tracking-[0.18em]">
                Recovery Score Debug
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* Left: scoring steps */}
              <div className="space-y-0 border border-white/[0.08] divide-y divide-white/[0.06]">

                {/* Base */}
                <div className="px-5 py-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-white/25">base score</span>
                  <span className="font-mono text-sm font-bold text-white tabular-nums">100</span>
                </div>

                {/* Per-signal rows */}
                {debugBreakdown.steps.map(step => (
                  <div key={step.label} className="px-5 py-4">
                    {/* Signal label + deduction chip */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.12em]">
                        {step.label}
                      </span>
                      <span className={cn(
                        'font-mono text-xs font-bold tabular-nums px-1.5 py-0.5',
                        step.deduction === 0
                          ? 'text-[#16A34A] bg-[#16A34A]/10'
                          : 'text-[#E5173F] bg-[#E5173F]/10'
                      )}>
                        {step.deduction === 0 ? '+0' : `−${step.deduction}`}
                      </span>
                    </div>

                    {/* Values */}
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-mono text-lg font-bold text-white tabular-nums leading-none">
                        {step.rawValue}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-white/25 mb-1">{step.target}</p>
                    <p className="font-mono text-[10px] text-yellow-400/60">{step.rule}</p>

                    {/* Running score */}
                    <div className="mt-2 pt-2 border-t border-white/[0.04] flex justify-between items-center">
                      <span className="font-mono text-[10px] text-white/15">score after this step</span>
                      <span className="font-mono text-xs text-white/50 tabular-nums">{step.scoreAfter}</span>
                    </div>
                  </div>
                ))}

                {/* Final score */}
                <div className="px-5 py-4 bg-white/[0.02] flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-white/50 uppercase tracking-[0.1em]">Final Score</span>
                  <span className="font-mono text-2xl font-bold text-white tabular-nums">
                    {debugBreakdown.finalScore}
                  </span>
                </div>

                {/* Deductions summary */}
                <div className="px-5 py-3 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-white/20">total deductions</span>
                  <span className="font-mono text-xs text-[#E5173F]/70 tabular-nums">
                    {debugBreakdown.totalDeductions > 0 ? `−${debugBreakdown.totalDeductions}` : '0'}
                  </span>
                </div>
              </div>

              {/* Right: status + context */}
              <div className="space-y-6">

                {/* Status rule */}
                <div className="border border-white/[0.08] px-5 py-5">
                  <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-3">Hero Status</p>
                  <p className={cn(
                    'font-display font-bold text-2xl leading-tight mb-2',
                    debugBreakdown.status === 'green'  ? 'text-[#16A34A]'
                    : debugBreakdown.status === 'yellow' ? 'text-white'
                    : debugBreakdown.status === 'orange' ? 'text-[#D97706]'
                    : 'text-[#E5173F]'
                  )}>
                    {debugBreakdown.heroLabel}
                  </p>
                  <p className="font-mono text-xs text-yellow-400/60">{debugBreakdown.statusRule}</p>
                </div>

                {/* HRV vs baseline */}
                <div className="border border-white/[0.08] px-5 py-5">
                  <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-3">HRV vs Baseline</p>
                  <p className="font-mono text-xs text-white/50 leading-relaxed">{debugBreakdown.hrvRatioDisplay}</p>
                  {debugBreakdown.hrvRatio != null && (
                    <p className="font-mono text-xs text-yellow-400/60 mt-1">
                      ratio: {debugBreakdown.hrvRatio.toFixed(3)}
                      {' · '}{debugBreakdown.hrvRatio >= 1.10 ? 'PUSH territory'
                        : debugBreakdown.hrvRatio >= 0.95 ? 'TRAIN territory'
                        : debugBreakdown.hrvRatio >= 0.82 ? 'EASY territory'
                        : 'RECOVER territory'}
                    </p>
                  )}
                  <p className="font-mono text-[10px] text-white/15 mt-1">
                    (HRV ratio used by readiness engine, not score formula)
                  </p>
                </div>

                {/* Training load context */}
                <div className="border border-white/[0.08] px-5 py-5">
                  <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-3">Training Load Context</p>
                  <p className="font-mono text-xs text-white/50 leading-relaxed">{debugBreakdown.loadContext}</p>
                  {debugBreakdown.daysSinceHard != null && (
                    <p className="font-mono text-xs text-white/30 mt-1">
                      last hard session: {debugBreakdown.daysSinceHard}d ago
                    </p>
                  )}
                  <p className="font-mono text-[10px] text-white/15 mt-1">
                    (training load not in score formula — affects readiness recommendation only)
                  </p>
                </div>

                {/* Data source note */}
                <p className="font-mono text-[10px] text-white/15 leading-relaxed">
                  Data from: {isCurrentDay ? 'today' : dataDateLabel ?? 'most recent available'}.
                  {isUsingMock ? ' Using mock data.' : ' Real Supabase data.'}
                </p>
              </div>
            </div>
          </Container>
        </div>
      )}

    </div>
  )
}
