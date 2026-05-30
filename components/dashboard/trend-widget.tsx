/**
 * RECENT TREND widget — dark mode + tier 2 card.
 */
import { cn } from '@/lib/utils'
import type { TrendItem } from '@/lib/insights/types'

interface Props {
  items: TrendItem[]
  interpretation: string
  recommendation: string
}

const DIRECTION_ICON: Record<string, string> = { up: '↑', down: '↓', stable: '→' }

const SENTIMENT_COLOR: Record<string, string> = {
  good:    'text-emerald-500 dark:text-emerald-400',
  bad:     'text-amber-500   dark:text-amber-400',
  neutral: 'text-gray-500   dark:text-zinc-500',
}

const SENTIMENT_DOT: Record<string, string> = {
  good:    'bg-emerald-500',
  bad:     'bg-amber-400',
  neutral: 'bg-gray-300 dark:bg-zinc-600',
}

function TrendRow({ item }: { item: TrendItem }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', SENTIMENT_DOT[item.sentiment])} />
      <span className="text-xs text-gray-500 dark:text-zinc-400 w-28 flex-shrink-0">{item.label}</span>
      <span className={cn('text-xs font-semibold flex-1', SENTIMENT_COLOR[item.sentiment])}>
        <span className="mr-0.5">{DIRECTION_ICON[item.direction]}</span>
        {item.value}
      </span>
      <span className="text-[10px] text-gray-300 dark:text-zinc-600 flex-shrink-0">{item.window}</span>
    </div>
  )
}

export function TrendWidget({ items, interpretation, recommendation }: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-zinc-800">
          <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Recent Trend</span>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-gray-400 dark:text-zinc-500">Not enough data yet. Keep logging to unlock trend analysis.</p>
        </div>
      </div>
    )
  }

  const hasBad  = items.some(i => i.sentiment === 'bad')
  const hasGood = items.some(i => i.sentiment === 'good')
  const borderColor = hasBad
    ? 'border-l-amber-400'
    : hasGood ? 'border-l-emerald-400'
    : 'border-l-gray-200 dark:border-l-zinc-700'

  return (
    <div className={cn(
      'bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 border-l-4 overflow-hidden',
      borderColor,
    )}>
      <div className="px-5 py-3 border-b border-gray-100 dark:border-zinc-800">
        <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Recent Trend</span>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="divide-y divide-gray-50 dark:divide-zinc-800">
          {items.map(item => <TrendRow key={item.label} item={item} />)}
        </div>

        <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 leading-snug border-t border-gray-100 dark:border-zinc-800 pt-3">
          {interpretation}
        </p>

        <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
          {recommendation}
        </p>
      </div>
    </div>
  )
}
