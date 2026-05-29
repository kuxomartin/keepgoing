import { cn } from '@/lib/utils'
import type { Insight } from '@/lib/insights/types'

// ── Per-type styling ─────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  warning: {
    border:  'border-l-orange-400',
    badge:   'bg-orange-100 text-orange-700',
    label:   'Warning',
    icon:    '⚠',
  },
  recommendation: {
    border:  'border-l-blue-400',
    badge:   'bg-blue-100 text-blue-700',
    label:   'Recommendation',
    icon:    '💡',
  },
  trend: {
    border:  'border-l-purple-400',
    badge:   'bg-purple-100 text-purple-700',
    label:   'Trend',
    icon:    '📈',
  },
  positive: {
    border:  'border-l-green-400',
    badge:   'bg-green-100 text-green-700',
    label:   'Positive',
    icon:    '✅',
  },
} as const

// ── Single insight card ───────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: Insight }) {
  const cfg = TYPE_CONFIG[insight.type]
  return (
    <div className={cn(
      'bg-white rounded-xl border border-gray-200 border-l-4 shadow-sm px-4 py-3.5',
      cfg.border,
    )}>
      <div className="flex items-start gap-2.5">
        <span className="text-base flex-shrink-0 mt-0.5" aria-hidden>{cfg.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn(
              'inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded',
              cfg.badge,
            )}>
              {cfg.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900 leading-snug">{insight.headline}</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{insight.explanation}</p>
        </div>
      </div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

interface Props {
  insights: Insight[]
}

export function InsightsSection({ insights }: Props) {
  if (insights.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-4 text-center">
        <p className="text-sm text-gray-400">Insights will appear as more data syncs.</p>
        <p className="text-xs text-gray-300 mt-1">Need at least 7 days of health data.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Today&apos;s Insights
        </h2>
        <span className="text-xs text-gray-300">{insights.length} insight{insights.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-2">
        {insights.map(insight => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  )
}
