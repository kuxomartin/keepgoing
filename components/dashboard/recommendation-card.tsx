import { cn } from '@/lib/utils'
import { STATUS_LABELS } from '@/lib/insights/recommendation'
import type { DailyRecommendation, RecommendationStatus } from '@/lib/insights/recommendation'

const STATUS_STYLES: Record<RecommendationStatus, {
  accent: string
  label: string
}> = {
  rest:    { accent: 'bg-rose-400',    label: 'text-rose-600 dark:text-rose-400' },
  easy:    { accent: 'bg-amber-400',   label: 'text-amber-600 dark:text-amber-400' },
  train:   { accent: 'bg-emerald-500', label: 'text-emerald-600 dark:text-emerald-400' },
  fuel:    { accent: 'bg-blue-400',    label: 'text-blue-600 dark:text-blue-400' },
  deficit: { accent: 'bg-emerald-500', label: 'text-emerald-600 dark:text-emerald-400' },
  neutral: { accent: 'bg-gray-300 dark:bg-zinc-600', label: 'text-gray-500 dark:text-zinc-400' },
}

interface Props { rec: DailyRecommendation }

export function RecommendationCard({ rec }: Props) {
  const style = STATUS_STYLES[rec.status]

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
      <div className="flex">
        {/* Thin vertical accent */}
        <div className={cn('w-0.5 flex-shrink-0 my-0', style.accent)} />

        <div className="flex-1 px-5 py-4 space-y-2">
          {/* Status label */}
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-[10px] font-bold uppercase tracking-widest', style.label)}>
              {STATUS_LABELS[rec.status]}
            </span>
            {rec.confidence !== 'low' && (
              <span className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wide">
                {rec.confidence === 'high' ? 'High confidence' : 'Medium'}
              </span>
            )}
          </div>

          {/* Title */}
          <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 leading-snug">{rec.title}</p>

          {/* Reasons */}
          {rec.reasons.length > 0 && (
            <ul className="space-y-0.5">
              {rec.reasons.map((r, i) => (
                <li key={i} className="text-xs text-gray-500 dark:text-zinc-400 flex items-start gap-1.5">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-300 dark:bg-zinc-600 flex-shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Action */}
          <p className="text-xs font-medium text-gray-700 dark:text-zinc-300 pt-0.5">{rec.action}</p>
        </div>
      </div>
    </div>
  )
}
