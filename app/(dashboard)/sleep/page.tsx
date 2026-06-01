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

// Warm palette trend labels
function trendLabel(key: string): { text: string; cls: string } {
  const map: Record<string, { text: string; cls: string }> = {
    green: { text: '↑ improving', cls: 'text-[#7A8C5E]' },  // muted olive
    amber: { text: '↓ declining', cls: 'text-[#E5173F]' },
    red:   { text: '↓ declining', cls: 'text-[#E5173F]' },
    blue:  { text: '→ stable',   cls: 'text-[#888888]' },
    gray:  { text: '',           cls: '' },
  }
  return map[key] ?? map.gray
}

// Verdict color: good = white, poor = red, mixed = warm neutral
function verdictColor(key: string): string {
  if (key === 'disrupted' || key === 'short') return 'text-[#E5173F]'
  if (key === 'short_efficient' || key === 'long_fragmented') return 'text-[#C4892A]'
  return 'text-white'
}

const CONFIDENCE_CLS: Record<string, string> = {
  high:   'text-[#E5173F]',
  medium: 'text-[#C4892A]',
  low:    'text-[#888888]',
}

export default async function SleepPage() {
  const supabase  = await createClient()
  const today     = format(new Date(), 'yyyy-MM-dd')
  const d30ago    = format(subDays(startOfDay(new Date()), 29), 'yyyy-MM-dd')
  const d14ago    = format(subDays(startOfDay(new Date()), 13), 'yyyy-MM-dd')
  const yesterday = format(subDays(startOfDay(new Date()), 1), 'yyyy-MM-dd')

  const { data: sleepRaw } = await supabase
    .from('sleep_records')
    .select('*')
    .gte('date', d30ago)
    .lte('date', today)
    .order('date', { ascending: true })

  const sleepRecords = (sleepRaw ?? []) as SleepRecord[]
  const latest       = [...sleepRecords].reverse().find(r => r.asleep_minutes != null) ?? null
  const latestDate   = latest?.date ?? null
  const records14    = sleepRecords.filter(r => r.date >= d14ago)

  // Chart data
  const durationData  = records14.map(r => ({ date: r.date, hours: r.asleep_minutes ? Math.round((r.asleep_minutes / 60) * 10) / 10 : null }))
  const efficiencyData = records14.map(r => ({ date: r.date, value: r.efficiency_pct ? Math.round(Number(r.efficiency_pct)) : null }))
  const wakeCountData  = records14.map(r => ({ date: r.date, value: r.wake_count }))
  const deepData       = records14.map(r => ({ date: r.date, hours: r.deep_minutes ? Math.round((r.deep_minutes / 60) * 10) / 10 : null }))

  // Trend keys
  const durationSpark  = records14.map(r => r.asleep_minutes ? r.asleep_minutes / 60 : null).filter((v): v is number => v != null)
  const effSpark       = records14.map(r => r.efficiency_pct ? Number(r.efficiency_pct) : null).filter((v): v is number => v != null)
  const durationTrend  = durationSpark.length >= 4 ? trendColor(durationSpark, true) : 'gray'
  const effTrend       = effSpark.length >= 4      ? trendColor(effSpark, true)       : 'gray'

  const avg14Duration   = avg(records14.map(r => r.asleep_minutes ? r.asleep_minutes / 60 : null))
  const avg14Efficiency = avg(effSpark)
  const avg14WakeCount  = avg(records14.map(r => r.wake_count))
  const avg14Deep       = avg(records14.map(r => r.deep_minutes ? r.deep_minutes / 60 : null))
  const avg14AvgHrv     = avg(records14.map(r => r.avg_hrv ? Number(r.avg_hrv) : null))

  const verdict = getSleepVerdict(latest)

  // Cause explorer
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

  let causeCtx: CauseExplorerContext | null = null
  if (latest) {
    const coffeeList     = coffeePrev ?? []
    const lastCoffee     = coffeeList.length ? coffeeList.reduce((a, b) => a.consumed_at > b.consumed_at ? a : b) : null
    const lastCoffeeHour = lastCoffee ? parseInt(lastCoffee.consumed_at.slice(11, 13), 10) : null
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

    causeCtx = {
      record: latest, lastCoffeeHour, totalCaffeineMg: totalCaffeine,
      totalCalories, estimatedBurnKcal: estimatedBurn,
      lateMealAfter20h: lateMeals.length > 0, lateMealCalories,
      activityMinutes, previousDayHrv: hm?.hrv_ms ? Number(hm.hrv_ms) : null,
      baselineHrv, checkinDigestion: checkinPrev?.[0]?.digestion ?? null,
      checkinEnergy: checkinPrev?.[0]?.energy ?? null,
    }
  }

  const cause = causeCtx ? analyzeSleepCauses(causeCtx) : null
  const hasData = sleepRecords.length > 0

  // Patterns
  const hasEnoughForPatterns = sleepRecords.length >= 7
  const { data: allCoffee } = hasEnoughForPatterns
    ? await supabase.from('coffee_logs').select('date, consumed_at').gte('date', d30ago).lte('date', today)
    : { data: null }

  const patternInsights: string[] = []
  if (hasEnoughForPatterns && allCoffee) {
    const lateCoffeeDates = new Set(allCoffee.filter(c => parseInt(c.consumed_at.slice(11, 13), 10) >= 14).map(c => c.date))
    const sleepAfterLate  = sleepRecords.filter(r => lateCoffeeDates.has(r.date) && r.asleep_minutes != null)
    const sleepAfterEarly = sleepRecords.filter(r => !lateCoffeeDates.has(r.date) && r.asleep_minutes != null)
    if (sleepAfterLate.length >= 3 && sleepAfterEarly.length >= 3) {
      const avgLate  = avg(sleepAfterLate.map(r => r.asleep_minutes))
      const avgEarly = avg(sleepAfterEarly.map(r => r.asleep_minutes))
      if (avgLate != null && avgEarly != null && Math.abs(avgLate - avgEarly) >= 20) {
        const diff = Math.round(Math.abs(avgLate - avgEarly))
        patternInsights.push(
          avgLate < avgEarly
            ? `Nights following late caffeine (after 14:00) seem associated with ${diff} fewer minutes of sleep on average.`
            : `No clear negative caffeine-sleep pattern visible yet — sample size is still small.`
        )
      }
    }
  }

  return (
    <div className="flex flex-col">

      {/* ══════════════════════════════════════════════════════════════════
          ZONE 1 — Dark hero: verdict + key facts
      ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#0D0D0D] px-6 sm:px-10 lg:px-14 pt-12 pb-10 flex flex-col" style={{ minHeight: '340px' }}>

        <div className="flex items-center gap-3 mb-8">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.15em]">Sleep</p>
          {latestDate && (
            <p className="text-[10px] text-white/25 uppercase tracking-[0.12em]">
              — {format(new Date(latestDate + 'T12:00:00'), 'MMMM d')}
            </p>
          )}
        </div>

        {!hasData ? (
          <div className="flex-1 flex items-center">
            <div>
              <h1 className="font-display font-bold text-white/30 text-[3rem] mb-4" style={{ lineHeight: 0.92 }}>No sleep data yet.</h1>
              <p className="text-white/40 text-base max-w-md">Import your Sleep sheet from Health Auto Export in Settings.</p>
            </div>
          </div>
        ) : (
          <>
            <h1
              className={cn('font-display font-bold mb-8', 'text-[2.5rem] sm:text-[3.5rem] lg:text-[5rem]', verdictColor(verdict.key))}
              style={{ lineHeight: 0.92, letterSpacing: '-0.03em', maxWidth: '640px' }}
            >
              {verdict.text}
            </h1>

            {verdict.facts.length > 0 && (
              <div className="flex flex-wrap gap-x-8 gap-y-5">
                {verdict.facts.map(fact => (
                  <div key={fact.label}>
                    <div className="font-display font-bold text-white tabular-nums leading-none text-[1.75rem]">
                      {fact.value}
                    </div>
                    <div className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.12em] mt-1.5">
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
          {/* ══════════════════════════════════════════════════════════════════
              ZONE 2 — Sleep Cause Explorer (directly below hero)
          ══════════════════════════════════════════════════════════════════ */}
          {cause && latest && (
            <div className="bg-[#111111] border-t border-white/5 px-6 sm:px-10 lg:px-14 py-12">
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.15em] mb-2">
                Sleep Cause Explorer
              </p>
              <p className="text-lg font-semibold text-white/80 mb-10 max-w-xl leading-snug">
                {cause.headline}
              </p>

              {cause.contributors.length === 0 ? (
                <p className="text-white/40 text-sm max-w-md leading-relaxed">
                  Not enough prior-day data to identify specific contributors.
                  Log coffee, food, and activities regularly for better analysis.
                </p>
              ) : (
                <div className="space-y-0 divide-y divide-white/[0.06]">
                  {cause.contributors.map((c, i) => (
                    <div key={i} className="py-8 first:pt-0">
                      <div className="flex items-baseline justify-between gap-4 mb-3">
                        <h3 className="font-semibold text-white">{c.factor}</h3>
                        <span className={cn(
                          'text-[10px] font-bold uppercase tracking-[0.12em] flex-shrink-0',
                          CONFIDENCE_CLS[c.confidence]
                        )}>
                          {c.confidence} confidence
                        </span>
                      </div>
                      <p className="text-xs text-white/40 font-mono mb-3 tracking-wide">{c.evidence}</p>
                      <p className="text-sm text-white/60 leading-relaxed mb-4 max-w-2xl">{c.explanation}</p>
                      <p className="text-sm text-white/40">
                        Try:{' '}
                        <span className="text-white/80 font-medium">{c.recommendation}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-white/15 mt-10 max-w-xl leading-relaxed border-t border-white/[0.06] pt-6">
                These are patterns, not diagnoses. Sleep is influenced by many factors.
                Use this as a starting point for personal experimentation.
              </p>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              ZONE 3 — Sleep architecture (warm stone)
          ══════════════════════════════════════════════════════════════════ */}
          {latest && (latest.deep_minutes || latest.core_minutes || latest.rem_minutes || latest.awake_minutes) && (
            <div className="bg-[#F2EDE6] dark:bg-zinc-900 px-6 sm:px-10 lg:px-14 py-10">
              <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-6">
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
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              ZONE 4 — Trends (light graphite)
          ══════════════════════════════════════════════════════════════════ */}
          <div className="bg-[#EDEDEB] dark:bg-zinc-900/80 px-6 sm:px-10 lg:px-14 py-12 space-y-14">

            {/* Duration */}
            <div>
              <div className="flex items-baseline justify-between gap-4 mb-1">
                <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">
                  Sleep Duration · 14 Days
                </p>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-[#888888] mb-5">
                {latest?.asleep_minutes != null && (
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

            {/* Efficiency + Wake count */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14">
              <div>
                <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-1">Efficiency · 14 Days</p>
                <div className="flex flex-wrap gap-4 text-xs text-[#888888] mb-5">
                  {latest?.efficiency_pct != null && (
                    <span>Last: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{Math.round(Number(latest.efficiency_pct))}%</span></span>
                  )}
                  {avg14Efficiency != null && (
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
                <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-1">Wake Count · 14 Days</p>
                <div className="flex flex-wrap gap-4 text-xs text-[#888888] mb-5">
                  {latest?.wake_count != null && (
                    <span>Last: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{latest.wake_count}</span></span>
                  )}
                  {avg14WakeCount != null && (
                    <span>14d avg: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{avg14WakeCount}</span></span>
                  )}
                  <span className="text-[#888888] italic text-[10px]">Apple Watch includes micro-arousals</span>
                </div>
                <WakeCountChart data={wakeCountData} />
              </div>
            </div>

            {/* Deep sleep */}
            {deepData.some(d => d.hours != null) && (
              <div>
                <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-1">Deep Sleep · 14 Days</p>
                <div className="flex flex-wrap gap-4 text-xs text-[#888888] mb-5">
                  {latest?.deep_minutes != null && (
                    <span>Last: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{formatMinutes(latest.deep_minutes)}</span></span>
                  )}
                  {avg14Deep != null && (
                    <span>14d avg: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{avg14Deep}h</span></span>
                  )}
                </div>
                <SleepChart data={deepData} maxHours={2} />
              </div>
            )}

            {/* Avg sleep HRV */}
            {avg14AvgHrv != null && (
              <div>
                <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-1">Avg Sleep HRV · 14 Days</p>
                <div className="flex flex-wrap gap-4 text-xs text-[#888888] mb-5">
                  {latest?.avg_hrv != null && (
                    <span>Last: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{Math.round(Number(latest.avg_hrv))} ms</span></span>
                  )}
                  <span>14d avg: <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{Math.round(avg14AvgHrv)} ms</span></span>
                </div>
                <SleepEfficiencyChart
                  data={records14.map(r => ({ date: r.date, value: r.avg_hrv ? Math.round(Number(r.avg_hrv)) : null }))}
                  unit=" ms"
                  goodThreshold={40}
                  higherIsBetter
                />
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              ZONE 5 — Patterns + Experiments (white)
          ══════════════════════════════════════════════════════════════════ */}
          <div className="bg-white dark:bg-zinc-950 px-6 sm:px-10 lg:px-14 py-12 space-y-12">

            {/* Patterns */}
            <div>
              <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-2">
                What Seems to Affect Your Sleep
              </p>
              <p className="text-sm text-[#888888] mb-6 max-w-lg">
                Based on correlations across your logs. These are associations, not causes.
              </p>
              {!hasEnoughForPatterns ? (
                <p className="text-[#888888] text-sm">
                  Patterns emerge after 7+ nights of data and consistent logging. Keep going.
                </p>
              ) : patternInsights.length > 0 ? (
                <div className="space-y-3">
                  {patternInsights.map((text, i) => (
                    <div key={i} className="border border-[#D9D9D9] dark:border-zinc-800 px-5 py-4">
                      <p className="text-sm text-[#0D0D0D] dark:text-zinc-200">{text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#888888] text-sm">
                  Patterns are still building. Check back in a few weeks.
                </p>
              )}
            </div>

            {/* Experiments */}
            <div>
              <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-2">
                Experiments to Try
              </p>
              <p className="text-sm text-[#888888] mb-6 max-w-lg">
                Time-bounded. Run one at a time for cleaner signal.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { title: 'Caffeine cutoff at 13:00',      duration: '10 days', desc: 'No caffeine after 13:00. Compare sleep duration and efficiency.' },
                  { title: 'Dinner before 19:30',            duration: '7 days',  desc: 'Finish eating earlier. Observe effect on efficiency and fragmentation.' },
                  { title: 'Fixed bedtime ±30 min',          duration: '7 days',  desc: 'Same bedtime every night. Circadian consistency matters.' },
                  { title: 'Easy Zone 2 after hard days',    duration: '2 weeks', desc: 'Light activity instead of full rest. Observe next-day HRV.' },
                  { title: 'Reduce deficit on heavy days',   duration: '10 days', desc: 'Keep calorie deficit under 400–500 kcal on training days.' },
                ].map(exp => (
                  <div key={exp.title} className="border border-[#D9D9D9] dark:border-zinc-800 px-5 py-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-[#0D0D0D] dark:text-zinc-200 leading-tight">{exp.title}</h4>
                      <span className="text-[10px] text-[#888888] uppercase tracking-widest flex-shrink-0">{exp.duration}</span>
                    </div>
                    <p className="text-xs text-[#888888] leading-relaxed">{exp.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
