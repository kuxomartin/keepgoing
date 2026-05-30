import { cn } from '@/lib/utils'
import { STATUS_LABELS } from '@/lib/insights/recommendation'
import type { DailyRecommendation, RecommendationStatus } from '@/lib/insights/recommendation'

// ── Status styling ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<RecommendationStatus, {
  border: string
  badge:  string
  dot:    string
}> = {
  rest:    { border: 'border-l-red-400',     badge: 'bg-red-50 text-red-700',          dot: 'bg-red-400'     },
  easy:    { border: 'border-l-amber-400',   badge: 'bg-amber-50 text-amber-700',      dot: 'bg-amber-400'   },
  train:   { border: 'border-l-green-500',   badge: 'bg-green-50 text-green-700',      dot: 'bg-green-500'   },
  fuel:    { border: 'border-l-blue-400',    badge: 'bg-blue-50 text-blue-700',        dot: 'bg-blue-400'    },
  deficit: { border: 'border-l-emerald-500', badge: 'bg-emerald-50 text-emerald-700',  dot: 'bg-emerald-500' },
  neutral: { border: 'border-l-gray-300',    badge: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-300'    },
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  rec: DailyRecommendation
}

export function RecommendationCard({ rec }: Props) {
  const style = STATUS_STYLES[rec.status]

  return (
    <div className={cn(
      'bg-white rounded-xl border border-gray-200 border-l-4 shadow-sm overflow-hidden',
      style.border,
    )}>
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Status badge */}
          <span className={cn(
            'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-2',
            style.badge,
          )}>
            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', style.dot)} />
            {STATUS_LABELS[rec.status]}
          </span>

          {/* Title */}
          <p className="text-sm font-semibold text-gray-900 leading-snug">
            {rec.title}
          </p>
        </div>

        {/* Confidence — only shown for high/medium */}
        {rec.confidence !== 'low' && (
          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide flex-shrink-0 mt-1">
            {rec.confidence === 'high' ? 'High confidence' : 'Medium'}
          </span>
        )}
      </div>

      {/* Reasons */}
      {rec.reasons.length > 0 && (
        <ul className="px-5 pb-3 space-y-1.5">
          {rec.reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Action */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-700">{rec.action}</p>
      </div>
    </div>
  )
}
