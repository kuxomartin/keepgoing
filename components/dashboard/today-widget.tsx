/**
 * TODAY widget — top of the Today page.
 * Answers: "How am I today, and what should I do?"
 *
 * Structure: hard data → interpretation → recommendation
 */
import { cn } from '@/lib/utils'
import type { TodayReadiness } from '@/lib/insights/types'

interface Props {
  readiness: TodayReadiness
  interpretation: string  // "HRV is 12% above baseline."
  recommendation: string  // "A hard session is on the table today."
  supporting: string[]    // evidence bullets
  usingFallback: boolean  // data from yesterday, not today

  // Hard data
  sleepH: number | null
  hrv: number | null
  rhr: number | null
  consumedKcal: number | null
  proteinG: number | null
  activityMinutes: number
}

const STATUS = {
  go: {
    border: 'border-l-green-500',
    dot:    'bg-green-500',
    badge:  'bg-green-100 text-green-700',
    label:  'Go',
    bg:     '',
  },
  moderate: {
    border: 'border-l-yellow-400',
    dot:    'bg-yellow-400',
    badge:  'bg-yellow-100 text-yellow-700',
    label:  'Take it easy',
    bg:     '',
  },
  rest: {
    border: 'border-l-red-400',
    dot:    'bg-red-400',
    badge:  'bg-red-100 text-red-700',
    label:  'Rest day',
    bg:     '',
  },
} as const

export function TodayWidget({
  readiness, interpretation, recommendation, supporting, usingFallback,
  sleepH, hrv, rhr, consumedKcal, proteinG, activityMinutes,
}: Props) {
  const s = STATUS[readiness]

  const recoveryChips = [
    sleepH  != null && `${sleepH.toFixed(1)}h sleep`,
    hrv     != null && `HRV ${Math.round(hrv)}ms`,
    rhr     != null && `RHR ${rhr}bpm`,
  ].filter(Boolean) as string[]

  const todayChips = [
    consumedKcal != null && `${consumedKcal.toLocaleString()} kcal`,
    proteinG     != null && `${Math.round(proteinG)}g protein`,
    activityMinutes > 0  && `${activityMinutes}min activity`,
  ].filter(Boolean) as string[]

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
        {/* ① Hard data — recovery metrics */}
        {recoveryChips.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {usingFallback && (
              <span className="text-[10px] text-gray-400 font-medium self-center">Yesterday ·</span>
            )}
            {recoveryChips.map(chip => (
              <span key={chip} className="text-xs text-gray-600 font-medium">{chip}</span>
            ))}
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

        {/* Today's logged data (so far) */}
        {todayChips.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-gray-100 pt-2.5">
            <span className="text-[10px] text-gray-400 font-medium self-center">Logged today ·</span>
            {todayChips.map(chip => (
              <span key={chip} className="text-xs text-gray-500">{chip}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
