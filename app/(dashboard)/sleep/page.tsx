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

// ── helpers ───────────────────────────────────────────────────────────────────
function avg(vals: (number | null)[]): number | null {
  const v = vals.filter((x): x is number => x != null)
  return v.length ? Math.round((v.reduce((s, n) => s + n, 0) / v.length) * 10) / 10 : null
}

function trendLabel(key: string): { text: string; cls: string } {
  const map: Record<string, { text: string; cls: string }> = {
    green: { text: '↑ improving', cls: 'text-[#16A34A]' },
    amber: { text: '↓ declining', cls: 'text-[#D97706]' },
    red:   { text: '↓ declining', cls: 'text-[#E5173F]' },
    blue:  { text: '→ stable',   cls: 'text-[#888888]' },
    gray:  { text: '',           cls: '' },
  }
  return map[key] ?? map.gray
}

const CONFIDENCE_CLS: Record<string, string> = {
  high:   'text-[#E5173F]',
  medium: 'text-[#D97706]',
  low:    'text-[#888888]',
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function SleepPage() {
  const supabase = await createClient()
  const today    = format(new Date(), 'yyyy-MM-dd')
  const d30ago   = format(subDays(startOfDay(new Date()), 29), 'yyyy-MM-dd')
  const d14ago   = format(subDays(startOfDay(new Date()), 13), 'yyyy-MM-dd')
  const yesterday = format(subDays(startOfDay(new Date()), 1), 'yyyy-MM-dd')

  // Fetch sleep records (30 days for patterns, use 14 for charts)
  const { data: sleepRaw } = await supabase
    .from('sleep_records')
    .select('*')
    .gte('date', d30ago)
    .lte('date', today)
    .order('date', { ascending: true })

  const sleepRecords = (sleepRaw ?? []) as SleepRecord[]

  // Most recent record with actual asleep data
  const latest = [...sleepRecords].reverse().find(r => r.asleep_minutes != null) ?? null
  const latestDate = latest?.date ?? null

  // 14-day slice for charts
  const records14 = sleepRecords.filter(r => r.date >= d14ago)

  // Chart data arrays
  const durationData = records14.map(r => ({
    date:  r.date,
    hours: r.asleep_minutes ? Math.round((r.asleep_minutes / 60) * 10) / 10 : null,
  }))
  const efficiencyData = records14.map(r => ({
    date:  r.date,
    value: r.efficiency_pct ? Math.round(r.efficiency_pct) : null,
  }))
  const wakeCountData = records14.map(r => ({
    date:  r.date,
    value: r.wake_count,
  }))
  const deepData = records14.map(r => ({
    date:  r.date,
    hours: r.deep_minutes ? Math.round((r.deep_minutes / 60) * 10) / 10 : null,
  }))

  // Trend computations
  const durationSpark = records14.map(r => r.asleep_minutes ? r.asleep_minutes / 60 : null).filter((v): v is number => v != null)
  const effSpark      = records14.map(r => r.efficiency_pct).filter((v): v is number => v != null)
  const durationTrend = durationSpark.length >= 4 ? trendColor(durationSpark, true)  : 'gray'
  const effTrend      = effSpark.length >= 4      ? trendColor(effSpark, true)        : 'gray'

  const avg14Duration   = avg(records14.map(r => r.asleep_minutes ? r.asleep_minutes / 60 : null))
  const avg14Efficiency = avg(effSpark.map(v => v))
  const avg14WakeCount  = avg(records14.map(r => r.wake_count))
  const avg14Deep       = avg(records14.map(r => r.deep_minutes ? r.deep_minutes / 60 : null))
  const avg14AvgHrv     = avg(records14.map(r => r.avg_hrv))

  // Verdict
  const verdict = getSleepVerdict(latest)

  // Previous day context for Cause Explorer
  const [
    { data: coffeePrev },
    { data: foodPrev },
    { data: actPrev },
    { data: checkinPrev },
    { data: hmPrev },
  ] = await Promise.all([
    supabase.from('coffee_logs').select('consumed_at, caffeine_mg').eq('date', yesterday),
    supabase.from('food_logs').select('estimated_calories, eaten_at').eq('date', yesterday),
    supabase.from('activities').select('duration_minutes').gte('start_time', yesterday + 'T00:00:00').lte('start_time', yesterday + 'T23:59:59'),
    supabase.from('daily_checkins').select('digestion, energy').eq('date', yesterday).limit(1),
    supabase.from('health_metrics').select('hrv_ms, active_energy_kcal, resting_energy_kcal').eq('date', yesterday).eq('source', 'google_sheets').limit(1),
  ])

  // Build cause explorer context
  let causeCtx: CauseExplorerContext | null = null
  if (latest) {
    const coffeeList     = coffeePrev ?? []
    const lastCoffee     = coffeeList.length ? coffeeList.reduce((a, b) => a.consumed_at > b.consumed_at ? a : b) : null
    const lastCoffeeHour = lastCoffee ? parseInt(lastCoffee.consumed_at.slice(11, 13), 10) : null
    const totalCaffeine  = coffeeList.reduce((s, c) => s + (c.caffeine_mg ?? 0), 0) || null

    const foodList         = foodPrev ?? []
    const totalCalories    = foodList.reduce((s, f) => s + (f.estimated_calories ?? 0), 0) || null
    const lateMeals        = foodList.filter(f => f.eaten_at && f.eaten_at.slice(11, 13) >= '20')
    const lateMealCalories = lateMeals.reduce((s, f) => s + (f.estimated_calories ?? 0), 0) || null

    const activityMinutes = (actPrev ?? []).reduce((s, a) => s + (a.duration_minutes ?? 0), 0) || null
    const hm              = hmPrev?.[0]
    const estimatedBurn   = hm
      ? (hm.active_energy_kcal ?? 0) + (hm.resting_energy_kcal ?? 0) || null
      : null

    // 14d HRV baseline
    const { data: hmHistory } = await supabase
      .from('health_metrics')
      .select('hrv_ms')
      .gte('date', d14ago)
      .lte('date', yesterday)
      .eq('source', 'google_sheets')
    const baselineHrv = avg((hmHistory ?? []).map(r => r.hrv_ms ? Number(r.hrv_ms) : null))

    causeCtx = {
      record:           latest,
      lastCoffeeHour,
      totalCaffeineMg:  totalCaffeine,
      totalCalories,
      estimatedBurnKcal: estimatedBurn,
      lateMealAfter20h:  lateMeals.length > 0,
      lateMealCalories,
      activityMinutes,
      previousDayHrv:    hm?.hrv_ms ? Number(hm.hrv_ms) : null,
      baselineHrv,
      checkinDigestion:  checkinPrev?.[0]?.digestion ?? null,
      checkinEnergy:     checkinPrev?.[0]?.energy ?? null,
    }
  }

  const cause = causeCtx ? analyzeSleepCauses(causeCtx) : null

  const hasData = sleepRecords.length > 0

  // ── Patterns analysis (requires ≥7 records) ───────────────────────────────
  const hasEnoughForPatterns = sleepRecords.length >= 7
  // Pattern: avg sleep duration after late coffee vs early coffee
  const { data: allCoffee } = hasEnoughForPatterns
    ? await supabase.from('coffee_logs').select('date, consumed_at').gte('date', d30ago).lte('date', today)
    : { data: null }

  const patternInsights: Array<{ text: string }> = []
  if (hasEnoughForPatterns && allCoffee) {
    const lateCoffeeDates = new Set(
      allCoffee.filter(c => parseInt(c.consumed_at.slice(11, 13), 10) >= 14).map(c => c.date)
    )
    const sleepAfterLate  = sleepRecords.filter(r => lateCoffeeDates.has(r.date) && r.asleep_minutes != null)
    const sleepAfterEarly = sleepRecords.filter(r => !lateCoffeeDates.has(r.date) && r.asleep_minutes != null)

    if (sleepAfterLate.length >= 3 && sleepAfterEarly.length >= 3) {
      const avgLate  = avg(sleepAfterLate.map(r => r.asleep_minutes))
      const avgEarly = avg(sleepAfterEarly.map(r => r.asleep_minutes))
      if (avgLate != null && avgEarly != null) {
        const diff = Math.round(Math.abs(avgLate - avgEarly))
        if (diff >= 20) {
          patternInsights.push({
            text: avgLate < avgEarly
              ? `Nights after late caffeine (after 14:00) seem associated with ${diff} fewer minutes of sleep on average.`
              : `No clear negative pattern with late caffeine in your data yet — but sample size is small.`,
          })
        }
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">

      {/* ═══ ZONE 1 — Dark hero ══════════════════════════════════════════════ */}
      <div className="bg-[#0D0D0D] px-6 sm:px-10 lg:px-14 py-12 lg:py-16 min-h-[400px] flex flex-col">

        <div className="flex items-center gap-3 mb-10">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.15em]">Sleep</p>
          {latestDate && (
            <p className="text-[10px] text-white/25 uppercase tracking-[0.12em]">
              — Last recorded {format(new Date(latestDate + 'T12:00:00'), 'MMM d')}
            </p>
          )}
        </div>

        {!hasData ? (
          <div className="flex-1 flex items-center">
            <div>
              <h1 className="font-display font-bold text-white/30 text-[3rem] mb-4">No sleep data yet.</h1>
              <p className="text-white/40 text-base max-w-md">
                Import your Sleep sheet from Health Auto Export in Settings to see your sleep analysis here.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Verdict */}
            <h1
              className={cn(
                'font-display font-bold mb-6',
                'text-[2.5rem] sm:text-[3.5rem] lg:text-[5rem]',
                verdict.key === 'solid' || verdict.key === 'efficient' ? 'text-[#16A34A]'
                : verdict.key === 'disrupted' || verdict.key === 'short' ? 'text-[#E5173F]'
                : verdict.key === 'long_fragmented' || verdict.key === 'short_efficient' ? 'text-[#D97706]'
                : 'text-white',
              )}
              style={{ lineHeight: 0.92, letterSpacing: '-0.03em', maxWidth: '640px' }}
            >
              {verdict.text}
            </h1>

            {/* Key facts */}
            {verdict.facts.length > 0 && (
              <div className="flex flex-wrap gap-x-8 gap-y-4 mt-auto">
                {verdict.facts.map(fact => (
                  <div key={fact.label}>
                    <div className="font-display font-bold text-white tabular-nums leading-none text-[2rem]">
                      {fact.value}
                    </div>
                    <div className="text-[10px] font-bold text-white/30 uppercase tracking-[0.12em] mt-1">
                      {fact.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {hasData && (
        <>
          {/* ═══ ZONE 2 — Sleep architecture ══════════════════════════════════ */}
          {latest && (latest.deep_minutes || latest.core_minutes || latest.rem_minutes || latest.awake_minutes) ? (
            <div className="bg-[#F2EDE6] dark:bg-zinc-900 px-6 sm:px-10 lg:px-14 py-10">
              <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-6">
                Sleep Architecture — Last Night
              </p>
              <SleepArchitectureChart
                deep={latest.deep_minutes}
                core={latest.core_minutes}
                rem={latest.rem_minutes}
                awake={latest.awake_minutes}
              />
            </div>
          ) : null}

          {/* ═══ ZONE 3 — 14-day trends ════════════════════════════════════════ */}
          <div className="bg-[#EDEDEB] dark:bg-zinc-900/80 px-6 sm:px-10 lg:px-14 py-10 space-y-12">

            {/* Duration */}
            <div>
              <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-1">
                Sleep Duration · 14 Days
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-[#888888] mb-5">
                {latest?.asleep_minutes && (
                  <span>Last: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{formatMinutes(latest.asleep_minutes)}</span></span>
                )}
                {avg14Duration && (
                  <span>14d avg: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{avg14Duration}h</span></span>
                )}
                {trendLabel(durationTrend).text && (
                  <span className={cn('font-semibold', trendLabel(durationTrend).cls)}>
                    {trendLabel(durationTrend).text}
                  </span>
                )}
              </div>
              <SleepChart data={durationData} />
            </div>

            {/* Efficiency + Wake Count */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div>
                <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-1">
                  Efficiency · 14 Days
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-[#888888] mb-5">
                  {latest?.efficiency_pct && (
                    <span>Last: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{Math.round(latest.efficiency_pct)}%</span></span>
                  )}
                  {avg14Efficiency && (
                    <span>14d avg: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{avg14Efficiency}%</span></span>
                  )}
                  {trendLabel(effTrend).text && (
                    <span className={cn('font-semibold', trendLabel(effTrend).cls)}>
                      {trendLabel(effTrend).text}
                    </span>
                  )}
                </div>
                <SleepEfficiencyChart data={efficiencyData} unit="%" goodThreshold={85} higherIsBetter />
              </div>

              <div>
                <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-1">
                  Wake Count · 14 Days
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-[#888888] mb-5">
                  {latest?.wake_count != null && (
                    <span>Last: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{latest.wake_count} times</span></span>
                  )}
                  {avg14WakeCount != null && (
                    <span>14d avg: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{avg14WakeCount}</span></span>
                  )}
                </div>
                <WakeCountChart data={wakeCountData} />
              </div>
            </div>

            {/* Deep sleep */}
            {deepData.some(d => d.hours != null) && (
              <div>
                <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-1">
                  Deep Sleep · 14 Days
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-[#888888] mb-5">
                  {latest?.deep_minutes && (
                    <span>Last: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{formatMinutes(latest.deep_minutes)}</span></span>
                  )}
                  {avg14Deep && (
                    <span>14d avg: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{avg14Deep}h</span></span>
                  )}
                </div>
                <SleepChart data={deepData} />
              </div>
            )}

            {/* Avg sleep HRV */}
            {avg14AvgHrv && (
              <div>
                <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-1">
                  Avg Sleep HRV · 14 Days
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-[#888888] mb-5">
                  {latest?.avg_hrv && (
                    <span>Last: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{Math.round(latest.avg_hrv)} ms</span></span>
                  )}
                  <span>14d avg: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{Math.round(avg14AvgHrv)} ms</span></span>
                </div>
                <SleepEfficiencyChart
                  data={records14.map(r => ({ date: r.date, value: r.avg_hrv ? Math.round(r.avg_hrv) : null }))}
                  unit=" ms"
                  goodThreshold={40}
                  higherIsBetter
                />
              </div>
            )}
          </div>

          {/* ═══ ZONE 4 — Sleep Cause Explorer ══════════════════════════════════ */}
          {cause && latest && (
            <div className="bg-[#0D0D0D] px-6 sm:px-10 lg:px-14 py-12">
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-2">
                Sleep Cause Explorer
              </p>
              <p className="text-xl font-semibold text-white mb-8 max-w-xl">
                {cause.headline}
              </p>

              {cause.contributors.length === 0 ? (
                <p className="text-white/40 text-base">
                  Not enough prior-day data to identify specific contributors.
                  {' '}Log coffee, food, and activities regularly for better analysis.
                </p>
              ) : (
                <div className="space-y-8">
                  {cause.contributors.map((c, i) => (
                    <div key={i} className="border-t border-white/10 pt-8 first:border-0 first:pt-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <h3 className="font-semibold text-white text-lg">{c.factor}</h3>
                        <span className={cn(
                          'text-[10px] font-bold uppercase tracking-[0.12em] flex-shrink-0 mt-1',
                          CONFIDENCE_CLS[c.confidence]
                        )}>
                          {c.confidence} confidence
                        </span>
                      </div>
                      <p className="text-sm text-white/50 mb-2 font-mono">{c.evidence}</p>
                      <p className="text-sm text-white/70 leading-relaxed mb-3">{c.explanation}</p>
                      <p className="text-sm font-semibold text-white/50">
                        Try: <span className="text-white">{c.recommendation}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-white/20 mt-12 max-w-xl leading-relaxed">
                These are possible associations, not diagnoses. Individual sleep is complex and
                influenced by many factors. Use this as a starting point for personal experimentation.
              </p>
            </div>
          )}

          {/* ═══ ZONE 5 — Patterns ══════════════════════════════════════════════ */}
          <div className="bg-[#F2EDE6] dark:bg-zinc-900 px-6 sm:px-10 lg:px-14 py-12">
            <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-2">
              What Seems to Affect Your Sleep
            </p>
            <p className="text-sm text-[#888888] mb-8 max-w-md">
              Based on correlations in your logs. Language is intentionally cautious — these are patterns, not causes.
            </p>

            {!hasEnoughForPatterns ? (
              <p className="text-[#888888] text-base">
                Not enough data yet. Patterns emerge after 7+ nights of sleep data and consistent food and coffee logging.
              </p>
            ) : (
              <div className="space-y-4">
                {patternInsights.length > 0 ? (
                  patternInsights.map((p, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-800 rounded-sm px-5 py-4">
                      <p className="text-sm text-[#0D0D0D] dark:text-zinc-200">{p.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[#888888] text-base">
                    Patterns are still building. Keep logging consistently and check back in a few weeks.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ═══ ZONE 6 — Experiments ═══════════════════════════════════════════ */}
          <div className="bg-white dark:bg-zinc-950 px-6 sm:px-10 lg:px-14 py-12">
            <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-2">
              Experiments to Try
            </p>
            <p className="text-sm text-[#888888] mb-8 max-w-md">
              Simple, time-bounded experiments you can run yourself. One at a time for cleaner signal.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  title: 'Early caffeine cutoff',
                  duration: '10 days',
                  description: 'No caffeine after 13:00. Compare sleep duration and wake count.',
                },
                {
                  title: 'Earlier dinner',
                  duration: '7 days',
                  description: 'Finish eating by 19:30. Observe effect on sleep efficiency and wake count.',
                },
                {
                  title: 'Consistent bedtime',
                  duration: '7 days',
                  description: 'Same bedtime within 30 minutes every night. Circadian rhythm matters.',
                },
                {
                  title: 'Easy Zone 2 after hard days',
                  duration: '2 weeks',
                  description: 'Replace rest days with 30-40 min easy activity. Observe recovery markers.',
                },
                {
                  title: 'Increase calories on training days',
                  duration: '10 days',
                  description: 'Avoid large deficits on heavy training days. Target under 300 kcal deficit.',
                },
              ].map(exp => (
                <div key={exp.title} className="border border-[#D9D9D9] dark:border-zinc-800 rounded-sm px-5 py-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-semibold text-[#0D0D0D] dark:text-zinc-200">{exp.title}</h4>
                    <span className="text-[10px] text-[#888888] uppercase tracking-widest flex-shrink-0">{exp.duration}</span>
                  </div>
                  <p className="text-xs text-[#888888] leading-relaxed">{exp.description}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
