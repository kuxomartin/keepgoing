import { cn } from '@/lib/utils'
import type { TodayReadiness } from '@/lib/insights/types'

interface Props {
  readiness: TodayReadiness
  headline: string
  supporting: string[]
}

export function TodayStatus({ readiness, headline, supporting }: Props) {
  const styles = {
    go: {
      wrap:  'bg-green-50 border-green-200',
      dot:   'bg-green-500',
      badge: 'bg-green-100 text-green-700',
      label: 'Good to go',
      text:  'text-green-900',
    },
    moderate: {
      wrap:  'bg-yellow-50 border-yellow-200',
      dot:   'bg-yellow-400',
      badge: 'bg-yellow-100 text-yellow-700',
      label: 'Take it easy',
      text:  'text-yellow-900',
    },
    rest: {
      wrap:  'bg-red-50 border-red-200',
      dot:   'bg-red-400',
      badge: 'bg-red-100 text-red-700',
      label: 'Rest day',
      text:  'text-red-900',
    },
  }[readiness]

  return (
    <div className={cn('rounded-xl border px-5 py-4', styles.wrap)}>
      <div className="flex items-start gap-3">
        <div className={cn('mt-1.5 h-2 w-2 rounded-full flex-shrink-0', styles.dot)} />
        <div className="flex-1 min-w-0">
          <span className={cn(
            'inline-block text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1.5',
            styles.badge,
          )}>
            {styles.label}
          </span>
          <p className={cn('text-sm font-semibold leading-snug', styles.text)}>
            {headline}
          </p>
          {supporting.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {supporting.map((item, i) => (
                <li key={i} className="text-xs text-gray-500">· {item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
