export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, subDays, startOfDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { trendColor } from '@/lib/spark-utils'
import { SleepTimeRange } from '@/components/sleep/sleep-time-range'
import { SleepChart } from '@/components/charts/sleep-chart'
import { SleepArchitectureChart } from '@/components/charts/sleep-architecture-chart'
import { SleepStageHistoryChart } from '@/components/charts/sleep-stage-history-chart'
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

  const durationData  = records14.map(r => ({ date: r.date, hours: r.asleep_minutes ? Math.round((r.asleep_minutes / 60) * 10) / 10 : null }))

  const durationSpark = records14.map(r => r.asleep_minutes ? r.asleep_minutes / 60 : null).filter((v): v is number => v != null)
  const effSpark      = records14.map(r => r.efficiency_pct ? Number(r.efficiency_pct) : null).filter((v): v is number => v != null)
  const durationTrend = durationSpark.length >= 4 ? trendColor(durationSpark, true) : 'gray'

  const avg14Duration = avg(records14.map(r => r.asleep_minutes ? r.asleep_minutes / 60 : null))
  const avg14Eff      = avg(effSpark)
  const avg14Wakes    = avg(records14.map(r => r.wake_count))

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

  // ── Section 3 — HRV observation bullets (pre-computed before JSX) ─────────
  // Build HRV lookup: sleep_record.date = wake-up morning = same date as morning HRV
  const s3HrvByDate: Record<string, number> = {}
  for (const m of hmAll30d ?? []) {
    const r = m as { date: string; hrv_ms: number | string | null }
    if (r.hrv_ms != null && !s3HrvByDate[r.date]) s3HrvByDate[r.date] = Number(r.hrv_ms)
  }
  const s3Pairs = sleepRecords
    .filter(r => r.asleep_minutes != null && s3HrvByDate[r.date] != null)
    .map(r => ({ sh: r.asleep_minutes! / 60, hrv: s3HrvByDate[r.date] }))

  const s3Observations: string[] = (() => {
    const obs: string[] = []
    const mHrv = (ps: { hrv: number }[]) =>
      ps.length >= 3 ? Math.round(ps.reduce((s, p) => s + p.hrv, 0) / ps.length) : null
    const g7    = s3Pairs.filter(p => p.sh >= 7)
    const g6    = s3Pairs.filter(p => p.sh >= 6 && p.sh < 7)
    const gSub6 = s3Pairs.filter(p => p.sh < 6)
    const h7    = mHrv(g7)
    const h6    = mHrv(g6)
    const hSub6 = mHrv(gSub6)
    if (h7    != null) obs.push(`When sleep was ≥7h (n=${g7.length}), avg morning HRV was ${h7} ms.`)
    if (h6    != null) obs.push(`When sleep was 6–7h (n=${g6.length}), avg morning HRV was ${h6} ms.`)
    if (hSub6 != null) obs.push(`When sleep was <6h (n=${gSub6.length}), avg morning HRV was ${hSub6} ms.`)
    if (h7 != null && hSub6 != null) {
      const diff = h7 - hSub6
      if (Math.abs(diff) >= 3) obs.push(
        diff > 0
          ? `Longer sleep (≥7h) is associated with ${diff} ms higher morning HRV on average.`
          : `Shorter sleep (<6h) is associated with ${Math.abs(diff)} ms higher HRV — quality or other factors may dominate.`
      )
    }
    return obs
  })()

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-[#151A20]">

      {/* ══ ZONE 1 — Hero ════════════════════════════════════════════════════ */}
      <div className="pt-10 pb-10">
        <Container>
          {/* Header row: source label + date + verdict */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-8">
            <span className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em]">Sleep</span>
            {latestDate && (
              <span className="text-[10px] text-white/25 uppercase tracking-[0.12em]">
                — Night ending {format(new Date(latestDate + 'T12:00:00'), 'd MMM yyyy')}
              </span>
            )}
            {hasData && verdict.key !== 'no_data' && (
              <span className={cn('text-[10px] font-bold uppercase tracking-[0.14em]', verdictCls(verdict.key))}>
                · {verdict.text}
              </span>
            )}
          </div>

          {!hasData ? (
            <div>
              <p className="font-display font-bold text-white/20" style={{ fontSize: '5rem', lineHeight: 0.9, letterSpacing: '-0.03em' }}>
                No data yet.
              </p>
              <p className="text-white/30 text-base mt-6 max-w-md">Import your Sleep sheet from Health Auto Export in Settings.</p>
            </div>
          ) : (
            <>
              {verdict.facts.length > 0 && (() => {
                const [first, ...rest] = verdict.facts
                const validTimes = latest?.start_time && latest?.end_time &&
                  new Date(latest.start_time).getFullYear() >= 2000 &&
                  new Date(latest.end_time).getFullYear() >= 2000

                // Label overrides for hero display
                function humanLabel(label: string): string {
                  if (label === 'Wake count')    return 'Wake Events'
                  if (label === 'Avg sleep HRV') return 'Morning HRV'
                  if (label === 'Efficiency')    return 'Efficiency'
                  return label
                }

                return (
                  <div>
                    {/* Metrics row — balanced visual weight across all stats */}
                    <div className="flex flex-wrap gap-x-10 gap-y-6">
                      {/* Duration — anchor metric, one step larger */}
                      <div>
                        <div
                          className="font-mono font-bold text-white tabular-nums leading-none"
                          style={{ fontSize: '2.75rem', letterSpacing: '-0.025em' }}
                        >
                          {first.value}
                        </div>
                        <div className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.14em] mt-2.5">
                          {first.label}
                        </div>
                      </div>

                      {/* Secondary metrics — similar weight to duration */}
                      {rest.map(fact => (
                        <div key={fact.label}>
                          <div
                            className="font-mono font-bold text-white/80 tabular-nums leading-none"
                            style={{ fontSize: '2.25rem', letterSpacing: '-0.02em' }}
                          >
                            {fact.value}
                          </div>
                          <div className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.14em] mt-2.5">
                            {humanLabel(fact.label)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Sleep window — beneath the metrics block */}
                    {validTimes && (
                      <div className="mt-5">
                        <SleepTimeRange startIso={latest!.start_time!} endIso={latest!.end_time!} />
                      </div>
                    )}
                  </div>
                )
              })()}
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

          {/* ══ SECTION 1 — Sleep Duration & Timing ═════════════════════════════ */}
          <div className="border-t border-white/[0.06] bg-[#20252B]">
            <Container className="py-12">
              <div className="mb-8">
                <p className="text-[10px] font-semibold text-[#888888] uppercase tracking-[0.18em] mb-1">
                  Sleep Duration &amp; Timing
                </p>
                {records14.filter(r => r.asleep_minutes != null).length < 7 && (
                  <p className="text-xs text-[#888888] mt-1">
                    {records14.filter(r => r.asleep_minutes != null).length} nights recorded.
                  </p>
                )}
              </div>

              <div className="space-y-10">
                {/* Duration trend */}
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

                {/* Sleep debt + Timing variability side by side */}
                {(sleepDebt != null || consistency != null) && (
                  <div className={cn(
                    'grid gap-4',
                    sleepDebt && consistency ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-2xl'
                  )}>
                    {sleepDebt && (
                      <div className="bg-[#272D35] border border-white/[0.06]">
                        <div className="px-7 pt-7 pb-5 border-b border-white/[0.06]">
                          <h3 className="font-bold text-white uppercase leading-tight" style={{ fontSize: '1.125rem', letterSpacing: '-0.01em' }}>
                            Sleep Debt
                          </h3>
                        </div>
                        <div className="px-7 py-5 grid grid-cols-2 gap-x-8 gap-y-4 border-b border-white/[0.06]">
                          <div>
                            <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1">Avg / Target</p>
                            <p className="font-mono text-xl font-bold text-white">
                              {sleepDebt.avgHours}h
                              <span className="text-white/30 text-sm font-normal"> / {sleepDebt.targetHours}h</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1">Accumulated</p>
                            <p className={cn('font-mono text-xl font-bold',
                              sleepDebt.accumulatedDebtHours > 5 ? 'text-[#E5173F]'
                                : sleepDebt.accumulatedDebtHours > 2 ? 'text-[#FFB000]' : 'text-white'
                            )}>
                              {sleepDebt.accumulatedDebtHours > 0 ? `~${sleepDebt.accumulatedDebtHours}h` : 'None'}
                            </p>
                          </div>
                        </div>
                        <div className="px-7 py-5">
                          <p className="text-sm text-white/50 leading-relaxed">{sleepDebt.interpretation}</p>
                          <p className="text-[10px] text-white/20 mt-2">{sleepDebt.nightsAnalyzed} nights · last 14 days</p>
                        </div>
                      </div>
                    )}

                    {consistency && (
                      <div className="bg-[#272D35] border border-white/[0.06]">
                        <div className="px-7 pt-7 pb-5 border-b border-white/[0.06]">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-bold text-white uppercase leading-tight" style={{ fontSize: '1.125rem', letterSpacing: '-0.01em' }}>
                              Timing Variability
                            </h3>
                            <span className={cn('text-[10px] font-black uppercase tracking-[0.18em] flex-shrink-0 mt-0.5',
                              consistency.rating === 'highly consistent' ? 'text-white/50'
                                : consistency.rating === 'moderately consistent' ? 'text-[#FFB000]'
                                : 'text-[#E5173F]'
                            )}>
                              {consistency.rating}
                            </span>
                          </div>
                        </div>
                        <div className="px-7 py-5 grid grid-cols-2 gap-x-8 gap-y-4 border-b border-white/[0.06]">
                          <div>
                            <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1">Bedtime spread</p>
                            <p className={cn('font-mono text-xl font-bold',
                              consistency.bedtimeSpreadMin > 60 ? 'text-[#E5173F]'
                                : consistency.bedtimeSpreadMin > 30 ? 'text-[#FFB000]' : 'text-white'
                            )}>
                              {consistency.bedtimeSpread}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1">Wake time spread</p>
                            <p className={cn('font-mono text-xl font-bold',
                              consistency.wakeSpreadMin > 60 ? 'text-[#E5173F]'
                                : consistency.wakeSpreadMin > 30 ? 'text-[#FFB000]' : 'text-white'
                            )}>
                              {consistency.wakeSpread}
                            </p>
                          </div>
                        </div>
                        <div className="px-7 py-5">
                          <p className="text-sm text-white/50 leading-relaxed">{consistency.interpretation}</p>
                          <p className="text-[10px] text-white/20 mt-2">
                            High variability disrupts circadian rhythm and reduces sleep quality.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Efficiency & wake count — shown as compact stat row, not charts */}
                {(latest?.efficiency_pct != null || latest?.wake_count != null || avg14Eff != null) && (
                  <div className="flex flex-wrap gap-x-10 gap-y-3 pt-2">
                    {avg14Eff != null && (
                      <div>
                        <p className="text-[10px] text-[#888888] uppercase tracking-[0.12em] mb-1">Avg efficiency</p>
                        <p className="font-mono text-lg font-bold text-[#E7EDF2]">{avg14Eff}%</p>
                      </div>
                    )}
                    {latest?.efficiency_pct != null && (
                      <div>
                        <p className="text-[10px] text-[#888888] uppercase tracking-[0.12em] mb-1">Last night</p>
                        <p className="font-mono text-lg font-bold text-[#E7EDF2]">{Math.round(Number(latest.efficiency_pct))}%</p>
                      </div>
                    )}
                    {avg14Wakes != null && (
                      <div>
                        <p className="text-[10px] text-[#888888] uppercase tracking-[0.12em] mb-1">Avg wake events</p>
                        <p className="font-mono text-lg font-bold text-[#E7EDF2]">{avg14Wakes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Container>
          </div>

          {/* ══ SECTION 2 — Sleep Architecture ══════════════════════════════════ */}
          {(() => {
            const archRecords = records14.filter(r => r.deep_minutes || r.rem_minutes || r.core_minutes)
            const hasArch = archRecords.length > 0
            const hasSingleNight = latest && (latest.deep_minutes || latest.core_minutes || latest.rem_minutes || latest.awake_minutes)
            if (!hasArch && !hasSingleNight) return null

            const stageHistory: import('@/components/charts/sleep-stage-history-chart').SleepStageNight[] =
              records14.map(r => ({
                date:  r.date,
                deep:  r.deep_minutes,
                rem:   r.rem_minutes,
                core:  r.core_minutes,
                awake: r.awake_minutes,
              }))

            return (
              <div className="border-t border-white/[0.06] pt-10 pb-12">
                <Container>
                  <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-8">
                    Sleep Architecture
                  </p>

                  {/* Multi-night stacked chart */}
                  {hasArch && (
                    <div className="mb-10">
                      <p className="text-xs text-white/30 mb-5">
                        14-night stage breakdown — each bar is one night.
                      </p>
                      <SleepStageHistoryChart data={stageHistory} chartHeight={220} />
                    </div>
                  )}

                  {/* Last night detail */}
                  {hasSingleNight && (
                    <div className="border-t border-white/[0.06] pt-8 mt-2">
                      <p className="text-[10px] font-semibold text-white/20 uppercase tracking-[0.14em] mb-6">
                        Last night — stage detail
                      </p>
                      <SleepArchitectureChart
                        deep={latest!.deep_minutes}
                        core={latest!.core_minutes}
                        rem={latest!.rem_minutes}
                        awake={latest!.awake_minutes}
                        inBed={latest!.in_bed_minutes}
                        asleep={latest!.asleep_minutes}
                      />
                      {(() => {
                        const archTotal = (latest!.deep_minutes ?? 0) + (latest!.core_minutes ?? 0) +
                          (latest!.rem_minutes ?? 0) + (latest!.awake_minutes ?? 0)
                        if (!archTotal) return null
                        const pct = (m: number | null) => m ? Math.round((m / archTotal) * 100) : null
                        const stages = [
                          { label: 'Deep', minutes: latest!.deep_minutes, pct: pct(latest!.deep_minutes), ref: '~10–20%',
                            assess: (p: number) => p < 10 ? 'low-normal' : p <= 20 ? 'typical' : 'above typical' },
                          { label: 'REM', minutes: latest!.rem_minutes, pct: pct(latest!.rem_minutes), ref: '~20–25%',
                            assess: (p: number) => p < 15 ? 'below typical' : p < 20 ? 'slightly below' : p <= 25 ? 'typical' : 'slightly above' },
                          { label: 'Core', minutes: latest!.core_minutes, pct: pct(latest!.core_minutes), ref: 'majority',
                            assess: (p: number) => p >= 40 ? 'typical' : 'lower than typical' },
                          { label: 'Awake', minutes: latest!.awake_minutes, pct: pct(latest!.awake_minutes), ref: 'lower is better',
                            assess: (p: number) => p < 5 ? 'low — good' : p < 10 ? 'typical' : 'elevated' },
                        ].filter(s => s.minutes != null && s.minutes > 0)
                        return (
                          <div className="mt-8 space-y-3">
                            {stages.map(s => {
                              const assessment = s.pct != null ? s.assess(s.pct) : null
                              const isNote = assessment && (assessment.includes('below') || assessment.includes('elevated'))
                              return (
                                <div key={s.label} className="flex items-baseline gap-4">
                                  <span className="text-white/50 w-14 flex-shrink-0 text-sm">{s.label}</span>
                                  <span className="font-mono text-white/70 w-16 flex-shrink-0 text-sm">{s.minutes ? formatMinutes(s.minutes) : '—'}</span>
                                  <span className="text-white/40 w-10 flex-shrink-0 font-mono text-sm">{s.pct != null ? `${s.pct}%` : ''}</span>
                                  <span className="text-white/25 text-xs w-20 flex-shrink-0">{s.ref}</span>
                                  {assessment && (
                                    <span className={isNote ? 'text-[#FFB000] text-sm' : 'text-white/35 text-sm'}>
                                      {assessment}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                            <p className="text-xs text-white/20 mt-4">
                              Apple Watch estimates are approximate. Ranges vary by age and individual.
                            </p>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </Container>
              </div>
            )
          })()}

          {/* ══ SECTION 3 — Next-Day Recovery Effect ═════════════════════════════ */}
          {(() => {
            const hrvInsight    = intelligenceInsights.find(i => i.id === 'sleep-hrv')
            const otherInsights = intelligenceInsights.filter(i => i.id !== 'sleep-hrv')
            const MIN_PAIRS     = 7
            // s3Pairs pre-computed above: (sleepHours, morningHRV) using same wake-up date
            const hasSufficientData = s3Pairs.length >= MIN_PAIRS

            return (
              <div className="border-t border-white/[0.06] pt-10 pb-12">
                <Container>
                  <div className="mb-8">
                    <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em] mb-1">
                      Sleep &amp; Recovery
                    </p>
                    <p className="text-xs text-white/25 mt-1">
                      How sleep duration relates to morning HRV in your data. Association only — not causal.
                    </p>
                  </div>

                  {!hasSufficientData ? (
                    <div className="bg-[#272D35] border border-white/[0.06] px-7 py-6 max-w-xl">
                      <p className="text-sm text-white/40">
                        More nights needed for reliable pattern detection.
                      </p>
                      <p className="text-xs text-white/20 mt-2">
                        {s3Pairs.length} night{s3Pairs.length !== 1 ? 's' : ''} with HRV data so far. Need {MIN_PAIRS} to detect a pattern.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">

                      {/* Data observations — always shown when sufficient data */}
                      {s3Observations.length > 0 && (
                        <div className="bg-[#272D35] border border-white/[0.06] max-w-2xl">
                          <div className="px-7 pt-7 pb-4 border-b border-white/[0.06]">
                            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.14em]">
                              From your data — last 30 days
                            </p>
                          </div>
                          <ul className="px-7 py-5 space-y-3">
                            {s3Observations.map((obs, i) => (
                              <li key={i} className="flex items-start gap-3">
                                <span className="text-white/20 flex-shrink-0 mt-0.5 text-sm">—</span>
                                <span className="text-sm text-white/70 leading-relaxed font-mono">{obs}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="px-7 pb-5">
                            <p className="text-[10px] text-white/20">
                              Morning HRV from Apple Health. Pairs: {s3Pairs.length} nights.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Statistical insight card (≥7h vs <7h, if generated) */}
                      {hrvInsight && (
                        <div className="bg-[#272D35] border border-white/[0.06] max-w-2xl">
                          <div className="px-7 pt-7 pb-5 border-b border-white/[0.06]">
                            <h3 className="font-bold text-white leading-tight" style={{ fontSize: '1.0rem', letterSpacing: '-0.01em' }}>
                              {hrvInsight.title}
                            </h3>
                            <p className="font-mono text-[10px] text-white/30 mt-1.5">{hrvInsight.comparison}</p>
                          </div>
                          <div className="px-7 py-5 border-b border-white/[0.06]">
                            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-1.5">Observed</p>
                            <p className="font-bold text-white text-sm">{hrvInsight.difference}</p>
                          </div>
                          <div className="px-7 py-5">
                            <p className="text-sm text-white/55 leading-relaxed">{hrvInsight.interpretation}</p>
                          </div>
                        </div>
                      )}

                      {/* Other correlations (caffeine, deficit, training) */}
                      {otherInsights.length > 0 && (
                        <div className={cn(
                          'grid gap-4',
                          otherInsights.length === 1 ? 'grid-cols-1 max-w-2xl' : 'grid-cols-1 lg:grid-cols-2'
                        )}>
                          {otherInsights.map(insight => (
                            <div key={insight.id} className="bg-[#272D35] border border-white/[0.06]">
                              <div className="px-7 pt-7 pb-5 border-b border-white/[0.06]">
                                <h3 className="font-bold text-white leading-tight" style={{ fontSize: '1.0rem', letterSpacing: '-0.01em' }}>
                                  {insight.title}
                                </h3>
                              </div>
                              <div className="px-7 py-5 border-b border-white/[0.06]">
                                <p className="font-bold text-white text-sm">{insight.difference}</p>
                              </div>
                              <div className="px-7 py-5">
                                <p className="text-sm text-white/50 leading-relaxed">{insight.interpretation}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Container>
              </div>
            )
          })()}

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
