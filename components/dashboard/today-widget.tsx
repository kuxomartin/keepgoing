/**
 * TODAY widget — hero block at the top of the Today page.
 * Always dark/charcoal. Vitals as a number grid, not chips.
 */
import { cn } from '@/lib/utils'
import type { TodayReadiness } from '@/lib/insights/types'
import { MetricInfo } from '@/components/ui/metric-info'

interface Props {
  readiness: TodayReadiness
  interpretation: string
  recommendation: string
  supporting: string[]
  usingFallback: boolean
  sleepH: number | null
  hrv: number | null
  rhr: number | null
  consumedKcal: number | null
  proteinG: number | null
  activityMinutes: number
  coffeeCups: number
  coffeeMg: number | null
  lastCoffeeTime: string | null
}

const STATUS = {
  push: {
    bar:   'bg-emerald-400',
    badge: 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30',
    label: 'Push day',
  },
  train: {
    bar:   'bg-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
    label: 'Ready to train',
  },
  easy: {
    bar:   'bg-amber-400',
    badge: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30',
    label: 'Easy day',
  },
  recover: {
    bar:   'bg-rose-500',
    badge: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30',
    label: 'Recovery day',
  },
} as const

export function TodayWidget({
  readiness, interpretation, recommendation, supporting, usingFallback,
  sleepH, hrv, rhr, consumedKcal, proteinG, activityMinutes,
  coffeeCups, coffeeMg, lastCoffeeTime,
}: Props) {
  const s = STATUS[readiness]
  const hasTodayFood = consumedKcal != null || proteinG != null || activityMinutes > 0
  const hasCoffee    = coffeeCups > 0

  // Vitals to show in the hero grid
  const vitals = [
    sleepH != null ? { label: 'Sleep', value: sleepH.toFixed(1), unit: 'h',   slug: 'sleep' }           : null,
    hrv    != null ? { label: 'HRV',   value: String(Math.round(hrv)), unit: 'ms',  slug: 'hrv' }          : null,
    rhr    != null ? { label: 'RHR',   value: String(rhr), unit: 'bpm', slug: 'resting-heart-rate' }   : null,
  ].filter((v): v is NonNullable<typeof v> => v !== null)

  return (
    <div className="relative rounded-2xl overflow-hidden bg-zinc-950">
      {/* Thin status accent at top */}
      <div className={cn('absolute top-0 left-0 right-0 h-0.5', s.bar)} />

      <div className="px-6 pt-6 pb-6 space-y-5">

        {/* Row 1: eyebrow + status badge */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
            {usingFallback ? "Yesterday's data" : 'Today'}
          </span>
          <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full', s.badge)}>
            {s.label}
          </span>
        </div>

        {/* Row 2: main interpretation — large, dominant */}
        <div className="space-y-2">
          <p className="text-xl font-bold text-white leading-snug">
            {interpretation}
          </p>
          {supporting.length > 0 && (
            <ul className="space-y-0.5">
              {supporting.map((item, i) => (
                <li key={i} className="text-sm text-white/40">· {item}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Row 3: recommendation */}
        <p className="text-sm text-white/65 leading-relaxed border-t border-white/8 pt-4">
          {recommendation}
        </p>

        {/* Row 4: vitals — number grid */}
        {vitals.length > 0 && (
          <div className={cn(
            'grid gap-5 border-t border-white/8 pt-4',
            vitals.length === 3 ? 'grid-cols-3'
            : vitals.length === 2 ? 'grid-cols-2'
            : 'grid-cols-1',
          )}>
            {vitals.map(v => (
              <div key={v.label}>
                <p className="text-2xl font-bold text-white font-mono tabular-nums leading-none">{v.value}</p>
                <div className="flex items-center gap-0.5 mt-1">
                  <span className="text-[10px] text-white/35 uppercase tracking-widest">{v.label} {v.unit}</span>
                  <MetricInfo slug={v.slug} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Row 5: food + coffee footer (secondary, muted) */}
        {(hasTodayFood || hasCoffee) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/8 pt-3">
            {consumedKcal != null && (
              <span className="text-xs text-white/35 font-mono tabular-nums">{consumedKcal.toLocaleString()} kcal</span>
            )}
            {proteinG != null && (
              <span className="inline-flex items-center gap-0.5 text-xs text-white/35">
                {Math.round(proteinG)}g protein
                <MetricInfo slug="protein" />
              </span>
            )}
            {activityMinutes > 0 && (
              <span className="text-xs text-white/35">{activityMinutes}min active</span>
            )}
            {hasCoffee && (
              <span className="text-xs text-white/35">
                ☕ {coffeeCups % 1 === 0 ? coffeeCups : coffeeCups.toFixed(1)}
                {coffeeMg != null && coffeeMg > 0 ? ` · ${coffeeMg}mg` : ''}
                {lastCoffeeTime ? ` · last ${lastCoffeeTime}` : ''}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
