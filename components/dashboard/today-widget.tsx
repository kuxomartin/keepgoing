/**
 * TODAY widget — hero block at the top of the Today page.
 * Always uses a dark/charcoal background (Oura-like).
 * Status is communicated via a thin top accent bar + colored badge.
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
  go: {
    bar:   'bg-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
    label: 'Ready to train',
  },
  moderate: {
    bar:   'bg-amber-400',
    badge: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30',
    label: 'Take it easy',
  },
  rest: {
    bar:   'bg-rose-500',
    badge: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30',
    label: 'Rest day',
  },
} as const

export function TodayWidget({
  readiness, interpretation, recommendation, supporting, usingFallback,
  sleepH, hrv, rhr, consumedKcal, proteinG, activityMinutes,
  coffeeCups, coffeeMg, lastCoffeeTime,
}: Props) {
  const s = STATUS[readiness]
  const hasRecovery  = sleepH != null || hrv != null || rhr != null
  const hasTodayFood = consumedKcal != null || proteinG != null || activityMinutes > 0
  const hasCoffee    = coffeeCups > 0

  return (
    <div className="relative rounded-2xl overflow-hidden bg-zinc-950">
      {/* Status accent bar at top */}
      <div className={cn('absolute top-0 left-0 right-0 h-0.5', s.bar)} />

      <div className="px-5 pt-5 pb-5 space-y-4">
        {/* Row 1: label + status badge */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
            Today
          </span>
          <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full', s.badge)}>
            {s.label}
          </span>
        </div>

        {/* Row 2: Recovery data chips */}
        {hasRecovery && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {usingFallback && (
              <span className="text-[10px] font-medium text-white/25">Yesterday ·</span>
            )}
            {sleepH != null && (
              <span className="inline-flex items-center gap-0.5 text-xs text-white/60 font-medium">
                {sleepH.toFixed(1)}h sleep
                <MetricInfo slug="sleep" />
              </span>
            )}
            {hrv != null && (
              <span className="inline-flex items-center gap-0.5 text-xs text-white/60 font-medium">
                HRV {Math.round(hrv)}ms
                <MetricInfo slug="hrv" />
              </span>
            )}
            {rhr != null && (
              <span className="inline-flex items-center gap-0.5 text-xs text-white/60 font-medium">
                RHR {rhr}bpm
                <MetricInfo slug="resting-heart-rate" />
              </span>
            )}
          </div>
        )}

        {/* Row 3: Main interpretation */}
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-white leading-snug">
            {interpretation}
          </p>
          {supporting.length > 0 && (
            <ul className="space-y-0.5">
              {supporting.map((item, i) => (
                <li key={i} className="text-xs text-white/40 leading-relaxed">· {item}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Row 4: Recommendation */}
        <div className="border-t border-white/8 pt-3.5">
          <p className="text-sm font-medium text-white/75 leading-relaxed">
            {recommendation}
          </p>
        </div>

        {/* Row 5: Today's logged data */}
        {(hasTodayFood || hasCoffee) && (
          <div className="border-t border-white/8 pt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {hasTodayFood && (
              <>
                <span className="text-[10px] font-medium text-white/25">Food ·</span>
                {consumedKcal != null && (
                  <span className="text-xs text-white/45">
                    {consumedKcal.toLocaleString()} kcal
                  </span>
                )}
                {proteinG != null && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-white/45">
                    {Math.round(proteinG)}g protein
                    <MetricInfo slug="protein" />
                  </span>
                )}
                {activityMinutes > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-white/45">
                    {activityMinutes}min activity
                    <MetricInfo slug="training-load" />
                  </span>
                )}
              </>
            )}
            {hasCoffee && (
              <>
                {hasTodayFood && <span className="text-white/15">·</span>}
                <span className="text-xs text-white/45">
                  ☕ {coffeeCups % 1 === 0 ? coffeeCups : coffeeCups.toFixed(1)} cup{coffeeCups !== 1 ? 's' : ''}
                </span>
                {coffeeMg != null && coffeeMg > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-white/45">
                    {coffeeMg}mg caffeine
                    <MetricInfo slug="caffeine" />
                  </span>
                )}
                {lastCoffeeTime && (
                  <span className="text-xs text-white/45">last {lastCoffeeTime}</span>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
