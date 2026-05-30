/**
 * RECENT TREND widget — flat, cardless. Renders as content, not a card.
 * Wrapping container is provided by the Today page.
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
  good:    'text-emerald-600 dark:text-emerald-400',
  bad:     'text-amber-600   dark:text-amber-400',
  neutral: 'text-gray-500    dark:text-zinc-500',
}

const ACCENT_COLOR: Record<string, string> = {
  good:    'bg-emerald-500',
  bad:     'bg-amber-400',
  neutral: 'bg-gray-300 dark:bg-zinc-600',
}

export function TrendWidget({ items, interpretation, recommendation }: Props) {
  if (items.length === 0) return null

  const hasBad  = items.some(i => i.sentiment === 'bad')
  const hasGood = items.some(i => i.sentiment === 'good')
  const accentClass = hasBad ? ACCENT_COLOR.bad : hasGood ? ACCENT_COLOR.good : ACCENT_COLOR.neutral

  return (
    <div className="flex gap-3.5">
      {/* Vertical accent line */}
      <div className={cn('w-0.5 self-stretch rounded-full flex-shrink-0 min-h-[16px]', accentClass)} />

      <div className="flex-1 min-w-0 space-y-2">
        <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Recent Trend</span>

        {/* Trend items as compact chips */}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {items.map(item => (
            <span key={item.label} className={cn('text-sm font-medium', SENTIMENT_COLOR[item.sentiment])}>
              <span className="mr-0.5 font-bold">{DIRECTION_ICON[item.direction]}</span>
              {item.label}: {item.value}
            </span>
          ))}
        </div>

        <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 leading-snug">{interpretation}</p>
        {recommendation && (
          <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">{recommendation}</p>
        )}
      </div>
    </div>
  )
}
