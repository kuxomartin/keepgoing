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
import type { SleepRecord } from '@/types/database'

function avg(vals: (number | null)[]): number | null {
  const v = vals.filter((x): x is number => x != null)
  return v.length ? Math.round((v.reduce((s, n) => s + n, 0) / v.length) * 10) / 10 : null
}

// Trend labels — no green (not in palette). Black=good, gray=stable, red=declining.
function trendLabel(key: string): { text: string; cls: string } {
  return ({
    green: { text: '↑ improving', cls: 'text-[#0D0D0D] dark:text-zinc-100' },
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

  // Cause explorer context
  const [
    { data: coffeePrev }, { data: foodPrev }, { data: actPrev },
    { data: checkinPrev }, { data: hmPrev },
  ] = await Promise.all([
    supabase.from('coffee_logs').select('consumed_at, caffeine_mg').eq('date', yesterday),
    supabase.from('food_logs').select('estimated_calories, eaten_at').eq('date', yesterday),
    supabase.from('activities').select('duration_minutes').gte('start_time', yesterday + 'T00:00:00').lte('start_time', yesterday + 'T23:59:59'),
    supabase.from('daily_checkins').select('digestion, energy').eq('date', yesterday).limit(1),
    supabase.from('health_metrics').select('hrv_ms, active_energy_kcal, resting_energy_kcal').eq('date', yesterday).eq('source', 'google_sheets').limit(1),
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
    const hm               = hmPrev?.[0]
    const estimatedBurn    = hm ? (hm.active_energy_kcal ?? 0) + (hm.resting_energy_kcal ?? 0) || null : null
    const { data: hmHistory } = await supabase.from('health_metrics').select('hrv_ms').gte('date', d14ago).lte('date', yesterday).eq('source', 'google_sheets')
    const baselineHrv = avg((hmHistory ?? []).map(r => r.hrv_ms ? Number(r.hrv_ms) : null))
    // Attach lastCoffeeTime for rich card display
    void lastCoffeeTime
    causeCtx = {
      record: latest, lastCoffeeHour, totalCaffeineMg: totalCaffeine, totalCalories,
      estimatedBurnKcal: estimatedBurn, lateMealAfter20h: lateMeals.length > 0,
      lateMealCalories, activityMinutes, previousDayHrv: hm?.hrv_ms ? Number(hm.hrv_ms) : null,
      baselineHrv, checkinDigestion: checkinPrev?.[0]?.digestion ?? null,
      checkinEnergy: checkinPrev?.[0]?.energy ?? null,
    }
  }

  const cause = causeCtx ? analyzeSleepCauses(causeCtx) : null
  const hasData = sleepRecords.length > 0

  // Patterns — only show if there's an actual insight
  const hasEnoughForPatterns = sleepRecords.length >= 7
  const { data: allCoffee } = hasEnoughForPatterns
    ? await supabase.from('coffee_logs').select('date, consumed_at').gte('date', d30ago).lte('date', today)
    : { data: null }

  let patternText: string | null = null
  if (hasEnoughForPatterns && allCoffee) {
    const lateCoffeeDates = new Set(allCoffee.filter(c => parseInt(c.consumed_at.slice(11, 13), 10) >= 14).map(c => c.date))
    const afterLate  = sleepRecords.filter(r => lateCoffeeDates.has(r.date) && r.asleep_minutes != null)
    const afterEarly = sleepRecords.filter(r => !lateCoffeeDates.has(r.date) && r.asleep_minutes != null)
    if (afterLate.length >= 3 && afterEarly.length >= 3) {
      const avgL = avg(afterLate.map(r => r.asleep_minutes))
      const avgE = avg(afterEarly.map(r => r.asleep_minutes))
      if (avgL != null && avgE != null && Math.abs(avgL - avgE) >= 20) {
        const diff = Math.round(Math.abs(avgL - avgE))
        patternText = avgL < avgE
          ? `Nights following late caffeine (after 14:00) seem associated with ${diff} fewer minutes of sleep on average across ${afterLate.length} recorded nights.`
          : null
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-[#0D0D0D]">

      {/* ══ ZONE 1 — Hero (dark) ═══════════════════════════════════════════════ */}
      <div className="pt-10 pb-10">
        <Container>
          {/* Date label */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em]">Sleep</span>
            {latestDate && (
              <span className="text-[10px] text-white/25 uppercase tracking-[0.12em]">
                — {format(new Date(latestDate + 'T12:00:00'), 'MMMM d')}
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
                        className="font-display font-bold text-white tabular-nums leading-none"
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
                    className="font-display font-bold text-white mb-2"
                    style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.25rem)', letterSpacing: '-0.025em', lineHeight: 1.1 }}
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
                      <div key={i} className="bg-[#181818] border border-white/[0.06]">
                        {/* Card header */}
                        <div className="px-8 pt-8 pb-6 border-b border-white/[0.06]">
                          <div className="flex items-start justify-between gap-4">
                            <h3
                              className="font-display font-bold text-white uppercase leading-tight"
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
                    <div className="mt-8 border-t border-white/[0.06] pt-6">
                      <p className="text-[10px] font-semibold text-white/20 uppercase tracking-[0.18em] mb-4">
                        Stage breakdown · typical adult ranges
                      </p>
                      <div className="space-y-2">
                        {stages.map(s => {
                          const assessment = s.pct != null ? s.assess(s.pct) : null
                          const isNote = assessment && (assessment.includes('below') || assessment.includes('elevated') || assessment.includes('above'))
                          return (
                            <div key={s.label} className="flex items-baseline gap-3 text-sm">
                              <span className="text-white/40 w-12 flex-shrink-0">{s.label}</span>
                              <span className="font-mono text-white/70 w-16 flex-shrink-0">{s.minutes ? formatMinutes(s.minutes) : '—'}</span>
                              <span className="text-white/30 w-8 flex-shrink-0 tabular-nums">{s.pct != null ? `${s.pct}%` : ''}</span>
                              <span className="text-white/20 text-xs w-24 flex-shrink-0">{s.ref}</span>
                              {assessment && (
                                <span className={isNote ? 'text-[#FFB000] text-xs' : 'text-white/25 text-xs'}>
                                  {assessment}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-[10px] text-white/15 mt-4">
                        Apple Watch sleep stage estimates are approximate. Typical ranges vary by age and individual.
                      </p>
                    </div>
                  )
                })()}
              </Container>
            </div>
          )}

          {/* ══ ZONE 4 — Trends (light background) ══════════════════════════════ */}
          <div className="bg-[#F2EDE6] dark:bg-zinc-900">
            <Container className="py-12">
              <p className="text-[10px] font-semibold text-[#888888] uppercase tracking-[0.18em] mb-10">
                14-Day Trends
              </p>

              <div className="space-y-12">
                {/* Duration — full width, most important */}
                <div>
                  <div className="flex items-baseline gap-6 mb-4">
                    <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Sleep Duration</p>
                    <div className="flex gap-5 text-xs text-[#888888]">
                      {latest?.asleep_minutes != null && (
                        <span>Last: <span className="font-semibold text-[#0D0D0D]">{formatMinutes(latest.asleep_minutes)}</span></span>
                      )}
                      {avg14Duration && (
                        <span>14d avg: <span className="font-semibold text-[#0D0D0D]">{avg14Duration}h</span></span>
                      )}
                      {trendLabel(durationTrend).text && (
                        <span className={cn('font-semibold', trendLabel(durationTrend).cls)}>
                          {trendLabel(durationTrend).text}
                        </span>
                      )}
                    </div>
                  </div>
                  <SleepChart data={durationData} chartHeight={200} />
                </div>

                {/* 2-col: Efficiency | Wake Count */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div>
                    <div className="flex items-baseline gap-4 mb-4">
                      <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Efficiency</p>
                      <div className="flex gap-4 text-xs text-[#888888]">
                        {latest?.efficiency_pct != null && (
                          <span>Last: <span className="font-semibold text-[#0D0D0D]">{Math.round(Number(latest.efficiency_pct))}%</span></span>
                        )}
                        {avg14Eff != null && (
                          <span>Avg: <span className="font-semibold text-[#0D0D0D]">{avg14Eff}%</span></span>
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
                          <span>Last: <span className="font-semibold text-[#0D0D0D]">{latest.wake_count}</span></span>
                        )}
                        {avg14Wakes != null && (
                          <span>Avg: <span className="font-semibold text-[#0D0D0D]">{avg14Wakes}</span></span>
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
                              <span>Last: <span className="font-semibold text-[#0D0D0D]">{formatMinutes(latest.deep_minutes)}</span></span>
                            )}
                            {avg14Deep != null && (
                              <span>Avg: <span className="font-semibold text-[#0D0D0D]">{avg14Deep}h</span></span>
                            )}
                          </div>
                        </div>
                        <SleepChart data={deepData} maxHours={2} fixedColor="#0D0D0D" chartHeight={200} />
                      </div>
                    )}

                    {avg14Hrv != null && (
                      <div>
                        <div className="flex items-baseline gap-4 mb-4">
                          <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Avg Sleep HRV</p>
                          <div className="flex gap-4 text-xs text-[#888888]">
                            {latest?.avg_hrv != null && (
                              <span>Last: <span className="font-semibold text-[#0D0D0D]">{Math.round(Number(latest.avg_hrv))} ms</span></span>
                            )}
                            <span>Avg: <span className="font-semibold text-[#0D0D0D]">{Math.round(avg14Hrv)} ms</span></span>
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
          <div className="bg-[#0D0D0D]">
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
                    <div key={exp.title} className="bg-[#141414] border border-white/[0.06] px-5 py-4">
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
