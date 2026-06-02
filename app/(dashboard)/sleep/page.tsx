export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, subDays, startOfDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { trendColor } from '@/lib/spark-utils'
import { SleepChart } from '@/components/charts/sleep-chart'
import { SleepArchitectureChart } from '@/components/charts/sleep-architecture-chart'
import { SleepEfficiencyChart } from '@/components/charts/sleep-efficiency-chart'
import { WakeCountChart } from '@/components/charts/wake-count-chart'
import {
  getSleepVerdict,
  analyzeSleepCauses,
  formatMinutes,
  type CauseExplorerContext,
} from '@/lib/calculations/sleep-verdict'
import {
  computeSleepDebt,
  computeConsistency,
  computeSleepVsHrv,
  computeSleepVsCaffeine,
  computeSleepVsDeficit,
  computeSleepVsTraining,
  computeSleepCoach,
  type SleepInsight,
  type CoachCard,
} from '@/lib/calculations/sleep-intelligence'
import type { SleepRecord } from '@/types/database'

function avg(vals: (number | null)[]): number | null {
  const v = vals.filter((x): x is number => x != null)
  return v.length ? Math.round((v.reduce((s, n) => s + n, 0) / v.length) * 10) / 10 : null
}

// Trend labels — no green (not in palette). Black=good, gray=stable, red=declining.
function trendLabel(key: string): { text: string; cls: string } {
  return ({
    green: { text: '↑ improving', cls: 'text-[#E7EDF2] dark:text-zinc-100' },
    amber: { text: '↓ declining', cls: 'text-[#E5173F]' },
    red:   { text: '↓ declining', cls: 'text-[#E5173F]' },
    blue:  { text: '→ stable',   cls: 'text-[#888888]' },
    gray:  { text: '',           cls: '' },
  } as Record<string, { text: string; cls: string }>)[key] ?? { text: '', cls: '' }
}

// Verdict color: poor=red, mixed=amber, good/neutral=white
function verdictCls(key: string) {
  if (key === 'disrupted' || key === 'short') return 'text-[#E5173F]'
  if (key === 'long_fragmented' || key === 'short_efficient') return 'text-[#FFB000]'
  return 'text-white'
}

const CONF_CLS: Record<string, string> = {
  high:   'text-[#E5173F]',
  medium: 'text-[#FFB000]',
  low:    'text-[#888888]',
}

// Shared padded container (max 1200px, centered)
function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16', className)}>
      {children}
    </div>
  )
}

export default async function SleepPage() {
  const supabase  = await createClient()
  const today     = format(new Date(), 'yyyy-MM-dd')
  const d30ago    = format(subDays(startOfDay(new Date()), 29), 'yyyy-MM-dd')
  const d14ago    = format(subDays(startOfDay(new Date()), 13), 'yyyy-MM-dd')
  const yesterday = format(subDays(startOfDay(new Date()), 1), 'yyyy-MM-dd')

  const { data: sleepRaw } = await supabase
    .from('sleep_records').select('*').gte('date', d30ago).lte('date', today).order('date', { ascending: true })

  const sleepRecords = (sleepRaw ?? []) as SleepRecord[]
  const latest       = [...sleepRecords].reverse().find(r => r.asleep_minutes != null) ?? null
  const latestDate   = latest?.date ?? null
  const records14    = sleepRecords.filter(r => r.date >= d14ago)

  const durationData   = records14.map(r => ({ date: r.date, hours: r.asleep_minutes ? Math.round((r.asleep_minutes / 60) * 10) / 10 : null }))
  const efficiencyData = records14.map(r => ({ date: r.date, value: r.efficiency_pct ? Math.round(Number(r.efficiency_pct)) : null }))
  const wakeCountData  = records14.map(r => ({ date: r.date, value: r.wake_count }))
  const deepData       = records14.map(r => ({ date: r.date, hours: r.deep_minutes ? Math.round((r.deep_minutes / 60) * 10) / 10 : null }))

  const durationSpark = records14.map(r => r.asleep_minutes ? r.asleep_minutes / 60 : null).filter((v): v is number => v != null)
  const effSpark      = records14.map(r => r.efficiency_pct ? Number(r.efficiency_pct) : null).filter((v): v is number => v != null)
  const durationTrend = durationSpark.length >= 4 ? trendColor(durationSpark, true) : 'gray'
  const effTrend      = effSpark.length >= 4 ? trendColor(effSpark, true) : 'gray'

  const avg14Duration  = avg(records14.map(r => r.asleep_minutes ? r.asleep_minutes / 60 : null))
  const avg14Eff       = avg(effSpark)
  const avg14Wakes     = avg(records14.map(r => r.wake_count))
  const avg14Deep      = avg(records14.map(r => r.deep_minutes ? r.deep_minutes / 60 : null))
  const avg14Hrv       = avg(records14.map(r => r.avg_hrv ? Number(r.avg_hrv) : null))

  const verdict = getSleepVerdict(latest)

  // Cause explorer + intelligence data (all parallel)
  const [
    { data: coffeePrev }, { data: foodPrev }, { data: actPrev },
    { data: checkinPrev }, { data: hmPrev },
    { data: hmAll30d }, { data: coffeeAll30d }, { data: foodAll30d },
    { data: activitiesAll30d },
  ] = await Promise.all([
    supabase.from('coffee_logs').select('consumed_at, caffeine_mg').eq('date', yesterday),
    supabase.from('food_logs').select('estimated_calories, eaten_at').eq('date', yesterday),
    supabase.from('activities').select('duration_minutes').gte('start_time', yesterday + 'T00:00:00').lte('start_time', yesterday + 'T23:59:59'),
    supabase.from('daily_checkins').select('digestion, energy').eq('date', yesterday).limit(1),
    // Accept any source — apple_health rows (new) and google_sheets rows (legacy).
    // When multiple rows exist for the same date, take first non-null value per field.
    supabase.from('health_metrics').select('hrv_ms, active_energy_kcal, resting_energy_kcal').eq('date', yesterday).order('source', { ascending: true }).limit(5),
    // Intelligence queries — source-agnostic
    supabase.from('health_metrics').select('date, hrv_ms, active_energy_kcal, resting_energy_kcal').gte('date', d30ago).lte('date', today).order('date', { ascending: true }).order('source', { ascending: true }),
    supabase.from('coffee_logs').select('date, consumed_at').gte('date', d30ago).lte('date', today),
    supabase.from('food_logs').select('date, estimated_calories').gte('date', d30ago).lte('date', today),
    supabase.from('activities').select('start_time, duration_minutes, avg_hr, activity_type').gte('start_time', d30ago + 'T00:00:00').lte('start_time', today + 'T23:59:59'),
  ])

  let causeCtx: CauseExplorerContext | null = null
  if (latest) {
    const coffeeList     = coffeePrev ?? []
    const lastCoffee     = coffeeList.length ? coffeeList.reduce((a, b) => a.consumed_at > b.consumed_at ? a : b) : null
    const lastCoffeeHour = lastCoffee ? parseInt(lastCoffee.consumed_at.slice(11, 13), 10) : null
    const lastCoffeeTime = lastCoffee ? lastCoffee.consumed_at.slice(11, 16) : null
    const totalCaffeine  = coffeeList.reduce((s, c) => s + (c.caffeine_mg ?? 0), 0) || null
    const foodList       = foodPrev ?? []
    const totalCalories  = foodList.reduce((s, f) => s + (f.estimated_calories ?? 0), 0) || null
    const lateMeals      = foodList.filter(f => f.eaten_at && f.eaten_at.slice(11, 13) >= '20')
    const lateMealCalories = lateMeals.reduce((s, f) => s + (f.estimated_calories ?? 0), 0) || null
    const activityMinutes  = (actPrev ?? []).reduce((s, a) => s + (a.duration_minutes ?? 0), 0) || null
    // Merge multiple source rows for yesterday into one record (first non-null wins)
    const hmYday = (hmPrev ?? []).reduce(
      (acc, r) => {
        type HmRow = { hrv_ms?: number | string | null; active_energy_kcal?: number | null; resting_energy_kcal?: number | null }
        const row = r as HmRow
        if (acc.hrv_ms              == null && row.hrv_ms              != null) acc.hrv_ms              = row.hrv_ms
        if (acc.active_energy_kcal  == null && row.active_energy_kcal  != null) acc.active_energy_kcal  = row.active_energy_kcal
        if (acc.resting_energy_kcal == null && row.resting_energy_kcal != null) acc.resting_energy_kcal = row.resting_energy_kcal
        return acc
      },
      {} as { hrv_ms?: number | string | null; active_energy_kcal?: number | null; resting_energy_kcal?: number | null }
    )
    const estimatedBurn = hmYday.active_energy_kcal != null || hmYday.resting_energy_kcal != null
      ? ((hmYday.active_energy_kcal ?? 0) + (hmYday.resting_energy_kcal ?? 0)) || null
      : null
    const { data: hmHistory } = await supabase.from('health_metrics').select('hrv_ms, date').gte('date', d14ago).lte('date', yesterday)
    // Deduplicate hmHistory by date (first non-null HRV per date)
    const hrvByDateHist: Record<string, number> = {}
    for (const r of hmHistory ?? []) {
      const row = r as { date: string; hrv_ms?: number | string | null }
      if (!hrvByDateHist[row.date] && row.hrv_ms != null) hrvByDateHist[row.date] = Number(row.hrv_ms)
    }
    const baselineHrv = avg(Object.values(hrvByDateHist).map(v => v))
    void lastCoffeeTime
    causeCtx = {
      record: latest, lastCoffeeHour, totalCaffeineMg: totalCaffeine, totalCalories,
      estimatedBurnKcal: estimatedBurn, lateMealAfter20h: lateMeals.length > 0,
      lateMealCalories, activityMinutes, previousDayHrv: hmYday.hrv_ms ? Number(hmYday.hrv_ms) : null,
      baselineHrv, checkinDigestion: checkinPrev?.[0]?.digestion ?? null,
      checkinEnergy: checkinPrev?.[0]?.energy ?? null,
    }
  }

  const cause   = causeCtx ? analyzeSleepCauses(causeCtx) : null
  const hasData = sleepRecords.length > 0

  // ── Intelligence analyses (new sections) ───────────────────────────────────
  const sleepDebt   = computeSleepDebt(records14)
  const consistency = computeConsistency(records14)

  const intakeByDate: Record<string, number> = {}
  for (const f of foodAll30d ?? []) {
    const row = f as { date: string; estimated_calories?: number }
    intakeByDate[row.date] = (intakeByDate[row.date] ?? 0) + (row.estimated_calories ?? 0)
  }
  // Multiple sources may exist per date — take first non-zero burn (ordered by source ASC,
  // so 'apple_health' arrives before 'google_sheets')
  const burnByDate: Record<string, number> = {}
  for (const m of hmAll30d ?? []) {
    const row = m as { date: string; active_energy_kcal?: number; resting_energy_kcal?: number }
    if (burnByDate[row.date]) continue  // first non-zero wins
    const burn = (row.active_energy_kcal ?? 0) + (row.resting_energy_kcal ?? 0)
    if (burn > 0) burnByDate[row.date] = burn
  }

  const intelligenceInsights: SleepInsight[] = []
  const i1 = computeSleepVsHrv(sleepRecords, (hmAll30d ?? []) as Array<{ date: string; hrv_ms: number | string | null }>)
  if (i1) intelligenceInsights.push(i1)
  const i2 = computeSleepVsCaffeine(sleepRecords, (coffeeAll30d ?? []) as Array<{ date: string; consumed_at: string }>)
  if (i2) intelligenceInsights.push(i2)
  const i3 = computeSleepVsDeficit(sleepRecords, intakeByDate, burnByDate)
  if (i3) intelligenceInsights.push(i3)
  const i4 = computeSleepVsTraining(sleepRecords, (activitiesAll30d ?? []) as Array<{ start_time: string; duration_minutes: number | null; avg_hr: number | null; activity_type: string }>)
  if (i4) intelligenceInsights.push(i4)

  const coachCards = computeSleepCoach({
    debt:          sleepDebt,
    consistency,
    insights:      intelligenceInsights,
    avgEfficiency: avg14Eff,
  })

  // Patterns (legacy, kept for Zone 5)
  const patternCaffeineInsight = intelligenceInsights.find(i => i.id === 'sleep-caffeine')
  const patternText = patternCaffeineInsight?.difference.includes('fewer')
    ? `Nights following late caffeine (after 14:00) are associated with ${patternCaffeineInsight.difference.match(/(\d+) fewer/)?.[1] ?? '?'} fewer minutes of sleep on average.`
    : null

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-[#151A20]">

      {/* ══ ZONE 1 — Hero (dark) ═══════════════════════════════════════════════ */}
      <div className="pt-10 pb-10">
        <Container>
          {/* Date label */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em]">Sleep</span>
            {latestDate && (
              <span className="text-[10px] text-white/25 uppercase tracking-[0.12em]">
                — Night ending {format(new Date(latestDate + 'T12:00:00'), 'd MMM yyyy')}
              </span>
            )}
          </div>

          {!hasData ? (
            <div>
              <h1 className="font-display font-bold text-white/20" style={{ fontSize: '7rem', lineHeight: 0.9, letterSpacing: '-0.03em' }}>
                No data yet.
              </h1>
              <p className="text-white/30 text-base mt-6 max-w-md">Import your Sleep sheet from Health Auto Export in Settings.</p>
            </div>
          ) : (
            <>
              {/* Verdict — 100px */}
              <h1
                className={cn('font-display font-bold mb-10', verdictCls(verdict.key))}
                style={{ fontSize: 'clamp(3.5rem, 7vw, 7rem)', lineHeight: 0.9, letterSpacing: '-0.03em', maxWidth: '900px' }}
              >
                {verdict.text}
              </h1>

              {/* Key facts — large, tight, horizontal */}
              {verdict.facts.length > 0 && (
                <div className="flex flex-wrap gap-x-12 gap-y-6">
                  {verdict.facts.map(fact => (
                    <div key={fact.label}>
                      <div
                        className="font-bold text-white font-mono tabular-nums leading-none"
                        style={{ fontSize: '2.25rem' }}
                      >
                        {fact.value}
                      </div>
                      <div className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.14em] mt-2">
                        {fact.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Container>
      </div>

      {hasData && (
        <>
          {/* ══ ZONE 2 — Cause Explorer (dark, directly below hero) ══════════════ */}
          {cause && latest && (
            <div className="border-t border-white/[0.06] pb-12 pt-10">
              <Container>
                {/* Section header — second most important element after hero */}
                <div className="mb-10">
                  <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-3">
                    Sleep Cause Explorer
                  </p>
                  <h2
                    className="font-black text-white mb-2 text-2xl sm:text-3xl"
                    style={{ lineHeight: 1.0 }}
                  >
                    What may have affected your sleep.
                  </h2>
                  <p className="text-sm text-white/35 mt-2">
                    {cause.contributors.length > 0
                      ? 'Patterns from yesterday\'s logs. Not a diagnosis.'
                      : 'Not enough prior-day data. Log coffee, food, and activities for better analysis.'}
                  </p>
                </div>

                {/* 2-column card grid */}
                {cause.contributors.length > 0 && (
                  <div className={cn(
                    'grid gap-4',
                    cause.contributors.length === 1 ? 'grid-cols-1 max-w-xl' : 'grid-cols-1 lg:grid-cols-2'
                  )}>
                    {cause.contributors.map((c, i) => (
                      <div key={i} className="bg-[#272D35] border border-white/[0.06]">
                        {/* Card header */}
                        <div className="px-8 pt-8 pb-6 border-b border-white/[0.06]">
                          <div className="flex items-start justify-between gap-4">
                            <h3
                              className="font-bold text-white uppercase leading-tight"
                              style={{ fontSize: '1.375rem', letterSpacing: '-0.01em' }}
                            >
                              {c.factor}
                            </h3>
                            <span className={cn('text-[10px] font-black uppercase tracking-[0.2em] flex-shrink-0 mt-1', CONF_CLS[c.confidence])}>
                              {c.confidence}
                            </span>
                          </div>
                        </div>

                        {/* Evidence grid */}
                        <div className="px-8 py-6 border-b border-white/[0.06]">
                          <p className="text-[9px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-3">Evidence</p>
                          <p className="font-mono text-sm text-white/60 leading-relaxed">{c.evidence}</p>
                        </div>

                        {/* Explanation */}
                        <div className="px-8 py-6 border-b border-white/[0.06]">
                          <p className="text-[9px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-3">Possible effect</p>
                          <p className="text-sm text-white/55 leading-relaxed">{c.explanation}</p>
                        </div>

                        {/* Experiment */}
                        <div className="px-8 py-6">
                          <p className="text-[9px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-3">Try</p>
                          <p className="text-sm font-semibold text-white leading-relaxed">{c.recommendation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Container>
            </div>
          )}

          {/* ══ ZONE 3 — Sleep Architecture (dark, flagship visualization) ════════ */}
          {latest && (latest.deep_minutes || latest.core_minutes || latest.rem_minutes || latest.awake_minutes) && (
            <div className="border-t border-white/[0.06] pt-10 pb-12">
              <Container>
                <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-8">
                  Sleep Architecture — Last Night
                </p>
                <SleepArchitectureChart
                  deep={latest.deep_minutes}
                  core={latest.core_minutes}
                  rem={latest.rem_minutes}
                  awake={latest.awake_minutes}
                  inBed={latest.in_bed_minutes}
                  asleep={latest.asleep_minutes}
                />

                {/* Reference ranges — compact, cautious language */}
                {(() => {
                  const archTotal = (latest.deep_minutes ?? 0) + (latest.core_minutes ?? 0) +
                    (latest.rem_minutes ?? 0) + (latest.awake_minutes ?? 0)
                  if (!archTotal) return null

                  const pct = (m: number | null) => m ? Math.round((m / archTotal) * 100) : null

                  const stages = [
                    {
                      label: 'Deep',
                      minutes: latest.deep_minutes,
                      pct: pct(latest.deep_minutes),
                      ref: '~10–20%',
                      assess: (p: number) => p < 10 ? 'low-normal' : p <= 20 ? 'typical' : 'above typical',
                    },
                    {
                      label: 'REM',
                      minutes: latest.rem_minutes,
                      pct: pct(latest.rem_minutes),
                      ref: '~20–25%',
                      assess: (p: number) => p < 15 ? 'below typical' : p < 20 ? 'slightly below' : p <= 25 ? 'typical' : p <= 30 ? 'slightly above' : 'above typical',
                    },
                    {
                      label: 'Core',
                      minutes: latest.core_minutes,
                      pct: pct(latest.core_minutes),
                      ref: 'majority',
                      assess: (p: number) => p >= 40 ? 'typical (largest stage)' : 'lower than typical',
                    },
                    {
                      label: 'Awake',
                      minutes: latest.awake_minutes,
                      pct: pct(latest.awake_minutes),
                      ref: 'lower is better',
                      assess: (p: number) => p < 5 ? 'low — good' : p < 10 ? 'typical' : 'elevated',
                    },
                  ].filter(s => s.minutes != null && s.minutes > 0)

                  return (
                    <div className="mt-10 border-t border-white/[0.08] pt-8">
                      <p className="text-xs font-bold text-white/50 uppercase tracking-[0.15em] mb-6">
                        Stage breakdown · typical adult ranges
                      </p>
                      <div className="space-y-4">
                        {stages.map(s => {
                          const assessment = s.pct != null ? s.assess(s.pct) : null
                          const isNote = assessment && (assessment.includes('below') || assessment.includes('elevated') || assessment.includes('above'))
                          return (
                            <div key={s.label} className="flex items-baseline gap-4">
                              <span className="text-white/60 w-14 flex-shrink-0 text-sm font-medium">{s.label}</span>
                              <span className="font-mono text-white/80 w-16 flex-shrink-0 text-sm">{s.minutes ? formatMinutes(s.minutes) : '—'}</span>
                              <span className="text-white/50 w-10 flex-shrink-0 font-mono tabular-nums text-sm">{s.pct != null ? `${s.pct}%` : ''}</span>
                              <span className="text-white/35 text-xs w-28 flex-shrink-0">{s.ref}</span>
                              {assessment && (
                                <span className={isNote ? 'text-[#FFB000] text-sm font-medium' : 'text-white/40 text-sm'}>
                                  {assessment}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-xs text-white/30 mt-5">
                        Apple Watch sleep stage estimates are approximate. Typical ranges vary by age and individual.
                      </p>
                    </div>
                  )
                })()}
              </Container>
            </div>
          )}

          {/* ══ ZONE 3b — Sleep Debt + Consistency ═══════════════════════════════ */}
          {(sleepDebt != null || consistency != null) && (
            <div className="border-t border-white/[0.06] pt-10 pb-12">
              <Container>
                <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-8">
                  Sleep Analysis
                </p>
                <div className={cn(
                  'grid gap-4',
                  sleepDebt && consistency ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-2xl'
                )}>

                  {/* Sleep Debt card */}
                  {sleepDebt && (
                    <div className="bg-[#272D35] border border-white/[0.06]">
                      <div className="px-7 pt-7 pb-5 border-b border-white/[0.06]">
                        <h3 className="font-bold text-white uppercase leading-tight"
                            style={{ fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
                          Sleep Debt
                        </h3>
                      </div>
                      <div className="px-7 py-6 grid grid-cols-2 gap-x-8 gap-y-5 border-b border-white/[0.06]">
                        <div>
                          <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1">Average sleep</p>
                          <p className="font-mono text-2xl font-bold text-white font-mono tabular-nums">{sleepDebt.avgHours}h</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1">Target</p>
                          <p className="font-mono text-2xl font-bold text-white font-mono tabular-nums">{sleepDebt.targetHours}h</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1">Daily deficit</p>
                          <p className={cn(
                            'font-mono text-2xl font-bold font-mono tabular-nums',
                            sleepDebt.dailyDeficitHours > 0.5 ? 'text-[#E5173F]'
                              : sleepDebt.dailyDeficitHours > 0.1 ? 'text-[#FFB000]'
                              : 'text-white'
                          )}>
                            {sleepDebt.dailyDeficitHours > 0 ? `-${sleepDebt.dailyDeficitHours}h` : 'None'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1">Est. accumulated</p>
                          <p className={cn(
                            'font-mono text-2xl font-bold font-mono tabular-nums',
                            sleepDebt.accumulatedDebtHours > 5 ? 'text-[#E5173F]'
                              : sleepDebt.accumulatedDebtHours > 2 ? 'text-[#FFB000]'
                              : 'text-white'
                          )}>
                            {sleepDebt.accumulatedDebtHours > 0 ? `~${sleepDebt.accumulatedDebtHours}h` : 'None'}
                          </p>
                        </div>
                      </div>
                      <div className="px-7 py-5">
                        <p className="text-sm text-white/50 leading-relaxed">{sleepDebt.interpretation}</p>
                        <p className="text-[10px] text-white/20 mt-3">{sleepDebt.nightsAnalyzed} nights analysed · last 14 days</p>
                      </div>
                    </div>
                  )}

                  {/* Consistency card */}
                  {consistency && (
                    <div className="bg-[#272D35] border border-white/[0.06]">
                      <div className="px-7 pt-7 pb-5 border-b border-white/[0.06]">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="font-bold text-white uppercase leading-tight"
                              style={{ fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
                            Consistency
                          </h3>
                          <span className={cn(
                            'text-[10px] font-black uppercase tracking-[0.2em] flex-shrink-0 mt-0.5',
                            consistency.rating === 'highly consistent' ? 'text-white/60'
                              : consistency.rating === 'moderately consistent' ? 'text-[#FFB000]'
                              : 'text-[#E5173F]'
                          )}>
                            {consistency.rating}
                          </span>
                        </div>
                      </div>
                      <div className="px-7 py-6 grid grid-cols-2 gap-x-8 gap-y-5 border-b border-white/[0.06]">
                        <div>
                          <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1">Bedtime spread</p>
                          <p className={cn(
                            'font-mono text-2xl font-bold font-mono tabular-nums',
                            consistency.bedtimeSpreadMin > 60 ? 'text-[#E5173F]'
                              : consistency.bedtimeSpreadMin > 30 ? 'text-[#FFB000]'
                              : 'text-white'
                          )}>
                            {consistency.bedtimeSpread}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1">Wake time spread</p>
                          <p className={cn(
                            'font-mono text-2xl font-bold font-mono tabular-nums',
                            consistency.wakeSpreadMin > 60 ? 'text-[#E5173F]'
                              : consistency.wakeSpreadMin > 30 ? 'text-[#FFB000]'
                              : 'text-white'
                          )}>
                            {consistency.wakeSpread}
                          </p>
                        </div>
                      </div>
                      <div className="px-7 py-5">
                        <p className="text-sm text-white/50 leading-relaxed">{consistency.interpretation}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Container>
            </div>
          )}

          {/* ══ ZONE 3c — Sleep Intelligence ══════════════════════════════════════ */}
          {intelligenceInsights.length > 0 && (
            <div className="border-t border-white/[0.06] pt-10 pb-12">
              <Container>
                <div className="mb-8">
                  <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-3">
                    Sleep Intelligence
                  </p>
                  <h2 className="font-black text-white text-2xl sm:text-3xl" style={{ lineHeight: 1.0 }}>
                    Correlations from your data.
                  </h2>
                  <p className="text-sm text-white/35 mt-2">Association only — not causal. Requires sufficient nights recorded.</p>
                </div>

                <div className={cn(
                  'grid gap-4',
                  intelligenceInsights.length === 1 ? 'grid-cols-1 max-w-2xl' : 'grid-cols-1 lg:grid-cols-2'
                )}>
                  {intelligenceInsights.map(insight => (
                    <div key={insight.id} className="bg-[#272D35] border border-white/[0.06]">
                      <div className="px-7 pt-7 pb-5 border-b border-white/[0.06]">
                        <h3 className="font-bold text-white leading-tight"
                            style={{ fontSize: '1.125rem', letterSpacing: '-0.01em' }}>
                          {insight.title}
                        </h3>
                        <p className="font-mono text-[10px] text-white/30 mt-2">{insight.comparison}</p>
                      </div>
                      <div className="px-7 py-5 border-b border-white/[0.06]">
                        <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1.5">Observed difference</p>
                        <p className="font-bold text-white text-sm">{insight.difference}</p>
                      </div>
                      <div className="px-7 py-5">
                        <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1.5">Interpretation</p>
                        <p className="text-sm text-white/55 leading-relaxed">{insight.interpretation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Container>
            </div>
          )}

          {/* ══ ZONE 3d — Sleep Coach ═════════════════════════════════════════════ */}
          {coachCards.length > 0 && (
            <div className="border-t border-white/[0.06] pt-10 pb-12">
              <Container>
                <div className="mb-8">
                  <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-3">
                    Sleep Coach
                  </p>
                  <h2 className="font-black text-white text-2xl sm:text-3xl" style={{ lineHeight: 1.0 }}>
                    Top opportunities.
                  </h2>
                  <p className="text-sm text-white/35 mt-2">Ranked by strongest observed signal.</p>
                </div>

                <div className={cn(
                  'grid gap-4',
                  coachCards.length === 1 ? 'grid-cols-1 max-w-2xl' : 'grid-cols-1 lg:grid-cols-3'
                )}>
                  {coachCards.map((card, i) => {
                    const priorityLabel = card.priority === 'top' ? 'Top Opportunity'
                      : card.priority === 'secondary' ? 'Secondary Opportunity'
                      : 'Maintain'
                    const priorityCls = card.priority === 'top' ? 'text-[#E5173F]'
                      : card.priority === 'secondary' ? 'text-[#FFB000]'
                      : 'text-white/40'
                    return (
                      <div key={i} className="bg-[#272D35] border border-white/[0.06]">
                        <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
                          <p className={cn('text-[10px] font-black uppercase tracking-[0.18em] mb-2', priorityCls)}>
                            {priorityLabel}
                          </p>
                          <h3 className="font-bold text-white leading-tight"
                              style={{ fontSize: '1.0rem', letterSpacing: '-0.01em' }}>
                            {card.label}
                          </h3>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                          <div>
                            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1">Observation</p>
                            <p className="text-sm text-white/60 leading-relaxed">{card.observation}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1">Recommendation</p>
                            <p className="text-sm text-white/80 leading-relaxed font-medium">{card.recommendation}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1">Expected benefit</p>
                            <p className="text-sm text-white/50 leading-relaxed">{card.benefit}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Container>
            </div>
          )}

          {/* ══ ZONE 4 — Trends (light background) ══════════════════════════════ */}
          <div className="bg-[#20252B]">
            <Container className="py-12">
              <div className="mb-10">
                <p className="text-[10px] font-semibold text-[#888888] uppercase tracking-[0.18em]">
                  {records14.filter(r => r.asleep_minutes != null).length >= 12
                    ? '14-Day Trends'
                    : 'Recent Sleep Trends'}
                </p>
                {records14.filter(r => r.asleep_minutes != null).length < 14 && (
                  <p className="text-xs text-[#888888] mt-1">
                    {records14.filter(r => r.asleep_minutes != null).length} nights recorded in the selected period.
                  </p>
                )}
              </div>

              <div className="space-y-12">
                {/* Duration — full width, most important */}
                <div>
                  <div className="flex items-baseline gap-6 mb-4">
                    <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Sleep Duration</p>
                    <div className="flex gap-5 text-xs text-[#888888]">
                      {latest?.asleep_minutes != null && (
                        <span>Last: <span className="font-semibold text-[#E7EDF2]">{formatMinutes(latest.asleep_minutes)}</span></span>
                      )}
                      {avg14Duration && (
                        <span>14d avg: <span className="font-semibold text-[#E7EDF2]">{avg14Duration}h</span></span>
                      )}
                      {trendLabel(durationTrend).text && (
                        <span className={cn('font-semibold', trendLabel(durationTrend).cls)}>
                          {trendLabel(durationTrend).text}
                        </span>
                      )}
                    </div>
                  </div>
                  <SleepChart data={durationData} chartHeight={200} onDark />
                </div>

                {/* 2-col: Efficiency | Wake Count */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div>
                    <div className="flex items-baseline gap-4 mb-4">
                      <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Efficiency</p>
                      <div className="flex gap-4 text-xs text-[#888888]">
                        {latest?.efficiency_pct != null && (
                          <span>Last: <span className="font-semibold text-[#E7EDF2]">{Math.round(Number(latest.efficiency_pct))}%</span></span>
                        )}
                        {avg14Eff != null && (
                          <span>Avg: <span className="font-semibold text-[#E7EDF2]">{avg14Eff}%</span></span>
                        )}
                        {trendLabel(effTrend).text && (
                          <span className={cn('font-semibold', trendLabel(effTrend).cls)}>{trendLabel(effTrend).text}</span>
                        )}
                      </div>
                    </div>
                    <SleepEfficiencyChart data={efficiencyData} unit="%" goodThreshold={85} higherIsBetter chartHeight={200} />
                  </div>

                  <div>
                    <div className="flex items-baseline gap-4 mb-4">
                      <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Wake Count</p>
                      <div className="flex gap-4 text-xs text-[#888888]">
                        {latest?.wake_count != null && (
                          <span>Last: <span className="font-semibold text-[#E7EDF2]">{latest.wake_count}</span></span>
                        )}
                        {avg14Wakes != null && (
                          <span>Avg: <span className="font-semibold text-[#E7EDF2]">{avg14Wakes}</span></span>
                        )}
                      </div>
                    </div>
                    <WakeCountChart data={wakeCountData} chartHeight={200} />
                  </div>
                </div>

                {/* 2-col: Deep Sleep | Sleep HRV */}
                {(deepData.some(d => d.hours != null) || avg14Hrv != null) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {deepData.some(d => d.hours != null) && (
                      <div>
                        <div className="flex items-baseline gap-4 mb-4">
                          <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Deep Sleep</p>
                          <div className="flex gap-4 text-xs text-[#888888]">
                            {latest?.deep_minutes != null && (
                              <span>Last: <span className="font-semibold text-[#E7EDF2]">{formatMinutes(latest.deep_minutes)}</span></span>
                            )}
                            {avg14Deep != null && (
                              <span>Avg: <span className="font-semibold text-[#E7EDF2]">{avg14Deep}h</span></span>
                            )}
                          </div>
                        </div>
                        <SleepChart data={deepData} maxHours={2} fixedColor="#55606C" chartHeight={200} onDark />
                      </div>
                    )}

                    {avg14Hrv != null && (
                      <div>
                        <div className="flex items-baseline gap-4 mb-4">
                          <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Avg Sleep HRV</p>
                          <div className="flex gap-4 text-xs text-[#888888]">
                            {latest?.avg_hrv != null && (
                              <span>Last: <span className="font-semibold text-[#E7EDF2]">{Math.round(Number(latest.avg_hrv))} ms</span></span>
                            )}
                            <span>Avg: <span className="font-semibold text-[#E7EDF2]">{Math.round(avg14Hrv)} ms</span></span>
                          </div>
                        </div>
                        <SleepEfficiencyChart
                          data={records14.map(r => ({ date: r.date, value: r.avg_hrv ? Math.round(Number(r.avg_hrv)) : null }))}
                          unit=" ms"
                          goodThreshold={40}
                          higherIsBetter
                          chartHeight={200}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Container>
          </div>

          {/* ══ ZONE 5 — Patterns (only show real findings) + Experiments ════════ */}
          <div className="bg-[#151A20]">
            <Container className="py-12 space-y-12">

              {/* Patterns — only shown when a real finding exists */}
              {patternText && (
                <div>
                  <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-4">
                    Pattern Detected
                  </p>
                  <div className="border-l-2 border-[#E5173F] pl-5">
                    <p className="text-sm text-white/70 leading-relaxed">{patternText}</p>
                    <p className="text-xs text-white/25 mt-2">Association only — not causal.</p>
                  </div>
                </div>
              )}

              {/* Experiments */}
              <div>
                <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-2">
                  Experiments to Try
                </p>
                <p className="text-xs text-white/25 mb-6">One at a time. 7–10 days each for a clean signal.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {[
                    { title: 'Caffeine cutoff 13:00',          d: '10 days', desc: 'No caffeine after 13:00. Compare sleep duration and efficiency.' },
                    { title: 'Dinner before 19:30',             d: '7 days',  desc: 'Finish eating earlier. Observe effect on efficiency and wake count.' },
                    { title: 'Fixed bedtime ±30 min',           d: '7 days',  desc: 'Same bedtime every night. Circadian consistency reduces fragmentation.' },
                    { title: 'Zone 2 after hard days',          d: '2 weeks', desc: 'Light 30–40 min activity instead of full rest. Observe next-day HRV.' },
                    { title: 'Reduce deficit on training days', d: '10 days', desc: 'Keep calorie deficit under 400–500 kcal on heavy training days.' },
                  ].map(exp => (
                    <div key={exp.title} className="bg-[#272D35] border border-white/[0.06] px-5 py-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="text-sm font-semibold text-white leading-tight">{exp.title}</h4>
                        <span className="text-[10px] text-white/25 uppercase tracking-widest flex-shrink-0 mt-0.5">{exp.d}</span>
                      </div>
                      <p className="text-xs text-white/40 leading-relaxed">{exp.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Container>
          </div>
        </>
      )}
    </div>
  )
}
