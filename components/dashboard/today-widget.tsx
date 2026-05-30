/**
 * TODAY widget — top of the Today page.
 * Answers: "How am I today, and what should I do?"
 *
 * Structure: hard data → interpretation → recommendation
 */
import { cn } from '@/lib/utils'
import type { TodayReadiness } from '@/lib/insights/types'
import { MetricInfo } from '@/components/ui/metric-info'

interface Props {
  readiness: TodayReadiness
  interpretation: string  // "HRV is 12% above baseline."
  recommendation: string  // "A hard session is on the table today."
  supporting: string[]    // evidence bullets
  usingFallback: boolean  // data from yesterday, not today

  // Hard data — recovery
  sleepH: number | null
  hrv: number | null
  rhr: number | null
  // Hard data — today's logged
  consumedKcal: number | null
  proteinG: number | null
  activityMinutes: number
  // Coffee
  coffeeCups: number
  coffeeMg: number | null
  lastCoffeeTime: string | null  // HH:MM
}

const STATUS = {
  go: {
    border: 'border-l-green-500',
    dot:    'bg-green-500',
    badge:  'bg-green-100 text-green-700',
    label:  'Go',
  },
  moderate: {
    border: 'border-l-yellow-400',
    dot:    'bg-yellow-400',
    badge:  'bg-yellow-100 text-yellow-700',
    label:  'Take it easy',
  },
  rest: {
    border: 'border-l-red-400',
    dot:    'bg-red-400',
    badge:  'bg-red-100 text-red-700',
    label:  'Rest day',
  },
} as const

export function TodayWidget({
  readiness, interpretation, recommendation, supporting, usingFallback,
  sleepH, hrv, rhr, consumedKcal, proteinG, activityMinutes,
  coffeeCups, coffeeMg, lastCoffeeTime,
}: Props) {
  const s = STATUS[readiness]

  const hasRecovery   = sleepH != null || hrv != null || rhr != null
  const hasTodayFood  = consumedKcal != null || proteinG != null || activityMinutes > 0
  const hasCoffee     = coffeeCups > 0

  return (
    <div className={cn(
      'bg-white rounded-xl border border-gray-200 border-l-4 shadow-sm overflow-hidden',
      s.border,
    )}>
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Today</span>
        <div className="flex items-center gap-1.5">
          <div className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
          <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', s.badge)}>
            {s.label}
          </span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3.5">

        {/* ① Hard data — recovery metrics with info icons */}
        {hasRecovery && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
            {usingFallback && (
              <span className="text-[10px] text-gray-400 font-medium">Yesterday ·</span>
            )}

            {sleepH != null && (
              <span className="inline-flex items-center gap-0.5 text-xs text-gray-600 font-medium">
                {sleepH.toFixed(1)}h sleep
                <MetricInfo slug="sleep" />
              </span>
            )}

            {hrv != null && (
              <span className="inline-flex items-center gap-0.5 text-xs text-gray-600 font-medium">
                HRV {Math.round(hrv)}ms
                <MetricInfo slug="hrv" />
              </span>
            )}

            {rhr != null && (
              <span className="inline-flex items-center gap-0.5 text-xs text-gray-600 font-medium">
                RHR {rhr}bpm
                <MetricInfo slug="resting-heart-rate" />
              </span>
            )}
          </div>
        )}

        {/* ② Interpretation */}
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-snug">{interpretation}</p>
          {supporting.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {supporting.map((item, i) => (
                <li key={i} className="text-xs text-gray-500">· {item}</li>
              ))}
            </ul>
          )}
        </div>

        {/* ③ Recommendation */}
        <p className="text-sm font-medium text-gray-700 border-t border-gray-100 pt-3">
          {recommendation}
        </p>

        {/* Today's logged data (food + coffee) */}
        {(hasTodayFood || hasCoffee) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t border-gray-100 pt-2.5 items-center">

            {/* Food / activity */}
            {hasTodayFood && (
              <>
                <span className="text-[10px] text-gray-400 font-medium">Food ·</span>

                {consumedKcal != null && (
                  <span className="text-xs text-gray-500">
                    {consumedKcal.toLocaleString()} kcal
                  </span>
                )}

                {proteinG != null && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-gray-500">
                    {Math.round(proteinG)}g protein
                    <MetricInfo slug="protein" />
                  </span>
                )}

                {activityMinutes > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-gray-500">
                    {activityMinutes}min activity
                    <MetricInfo slug="training-load" />
                  </span>
                )}
              </>
            )}

            {/* Coffee */}
            {hasCoffee && (
              <>
                {hasTodayFood && <span className="text-gray-200">·</span>}

                <span className="text-xs text-gray-500">
                  ☕ {coffeeCups % 1 === 0 ? coffeeCups : coffeeCups.toFixed(1)} cup{coffeeCups !== 1 ? 's' : ''}
                </span>

                {coffeeMg != null && coffeeMg > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-gray-500">
                    {coffeeMg}mg caffeine
                    <MetricInfo slug="caffeine" />
                  </span>
                )}

                {lastCoffeeTime && (
                  <span className="text-xs text-gray-500">last {lastCoffeeTime}</span>
                )}
              </>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
