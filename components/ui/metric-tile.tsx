import { cn } from '@/lib/utils'
import type { SparkColor } from '@/lib/spark-utils'
import { Sparkline } from './sparkline'
import { MetricInfo } from './metric-info'

interface MetricTileProps {
  label: string
  value: string | number
  unit: string
  tooltipSlug?: string
  sparkValues?: number[]
  sparkColor?: SparkColor
  status?: 'green' | 'amber' | 'red' | 'blue' | 'neutral'
  className?: string
}

const VALUE_COLOR: Record<string, string> = {
  green:   'text-emerald-500 dark:text-emerald-400',
  amber:   'text-amber-500   dark:text-amber-400',
  red:     'text-rose-500    dark:text-rose-400',
  blue:    'text-blue-500    dark:text-blue-400',
  neutral: 'text-gray-900    dark:text-zinc-50',
}

export function MetricTile({
  label, value, unit, tooltipSlug,
  sparkValues, sparkColor = 'gray',
  status = 'neutral',
  className,
}: MetricTileProps) {
  const valueColor = VALUE_COLOR[status] ?? VALUE_COLOR.neutral

  return (
    <div className={cn(
      'flex flex-col gap-1 bg-white dark:bg-zinc-900 rounded-2xl p-4 min-w-[96px]',
      className,
    )}>
      <div className="flex items-end gap-1 leading-none">
        <span className={cn('text-3xl font-bold tracking-tight', valueColor)}>
          {value}
        </span>
        <span className="text-sm text-gray-400 dark:text-zinc-500 mb-0.5 leading-none">
          {unit}
        </span>
      </div>

      {sparkValues && sparkValues.length >= 2 && (
        <Sparkline values={sparkValues} color={sparkColor} width={64} height={16} />
      )}

      <div className="flex items-center gap-0.5 mt-0.5">
        <span className="text-[11px] font-medium uppercase tracking-widest text-gray-400 dark:text-zinc-500">
          {label}
        </span>
        {tooltipSlug && <MetricInfo slug={tooltipSlug} />}
      </div>
    </div>
  )
}
