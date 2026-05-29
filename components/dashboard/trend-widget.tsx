/**
 * RECENT TREND widget.
 * Answers: "Am I moving in the right direction?"
 *
 * Uses adaptive timeframes per metric:
 *   Weight → 14d, HRV → 5d, Sleep → 5d, Load → 7d, Calories → 5d
 *
 * Structure: hard data (trend rows) → interpretation → recommendation
 */
import { cn } from '@/lib/utils'
import type { TrendItem } from '@/lib/insights/types'

interface Props {
  items: TrendItem[]
  interpretation: string
  recommendation: string
}

// ── Trend row ─────────────────────────────────────────────────────────────────

const DIRECTION_ICON: Record<string, string> = {
  up:     '↑',
  down:   '↓',
  stable: '→',
}

const SENTIMENT_COLOR: Record<string, string> = {
  good:    'text-green-600',
  bad:     'text-orange-500',
  neutral: 'text-gray-500',
}

const SENTIMENT_DOT: Record<string, string> = {
  good:    'bg-green-400',
  bad:     'bg-orange-400',
  neutral: 'bg-gray-300',
}

function TrendRow({ item }: { item: TrendItem }) {
  const icon  = DIRECTION_ICON[item.direction]
  const color = SENTIMENT_COLOR[item.sentiment]
  const dot   = SENTIMENT_DOT[item.sentiment]

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', dot)} />
      <span className="text-xs text-gray-500 w-28 flex-shrink-0">{item.label}</span>
      <span className={cn('text-xs font-semibold flex-1', color)}>
        <span className="mr-0.5">{icon}</span>
        {item.value}
      </span>
      <span className="text-[10px] text-gray-300 flex-shrink-0">{item.window}</span>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TrendWidget({ items, interpretation, recommendation }: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent Trend</span>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-gray-400">Not enough data yet. Keep logging to unlock trend analysis.</p>
        </div>
      </div>
    )
  }

  // Pick border colour from dominant sentiment
  const hasBad  = items.some(i => i.sentiment === 'bad')
  const hasGood = items.some(i => i.sentiment === 'good')
  const borderColor = hasBad ? 'border-l-orange-300' : hasGood ? 'border-l-green-400' : 'border-l-gray-200'

  return (
    <div className={cn(
      'bg-white rounded-xl border border-gray-200 border-l-4 shadow-sm overflow-hidden',
      borderColor,
    )}>
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent Trend</span>
      </div>

      <div className="px-5 py-4 space-y-3.5">
        {/* ① Hard data — trend rows */}
        <div className="divide-y divide-gray-50">
          {items.map(item => <TrendRow key={item.label} item={item} />)}
        </div>

        {/* ② Interpretation */}
        <p className="text-sm font-semibold text-gray-900 leading-snug border-t border-gray-100 pt-3">
          {interpretation}
        </p>

        {/* ③ Recommendation */}
        <p className="text-sm font-medium text-gray-700">
          {recommendation}
        </p>
      </div>
    </div>
  )
}
