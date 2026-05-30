import { cn } from '@/lib/utils'
import { Card, CardContent } from './card'
import { MetricInfo } from './metric-info'

type StatusColor = 'green' | 'yellow' | 'red' | 'neutral' | 'blue'

interface StatCardProps {
  label: string
  tooltipSlug?: string
  value: string | number
  unit?: string
  subtitle?: string
  status?: StatusColor
  icon?: React.ReactNode
  className?: string
}

export function StatCard({
  label,
  tooltipSlug,
  value,
  unit,
  subtitle,
  status = 'neutral',
  icon,
  className,
}: StatCardProps) {
  const borderColor = {
    green: 'border-l-green-500',
    yellow: 'border-l-yellow-400',
    red: 'border-l-red-500',
    blue: 'border-l-blue-500',
    neutral: 'border-l-gray-200',
  }[status]

  return (
    <Card className={cn('border-l-4', borderColor, className)}>
      <CardContent className="py-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">
                {label}
              </p>
              {tooltipSlug && <MetricInfo slug={tooltipSlug} />}
            </div>
            <p className="mt-1 text-2xl font-bold text-gray-900 leading-none">
              {value}
              {unit && (
                <span className="ml-1 text-sm font-normal text-gray-500">{unit}</span>
              )}
            </p>
            {subtitle && (
              <p className="mt-1 text-xs text-gray-400 truncate">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className="text-gray-300 flex-shrink-0 ml-3">{icon}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
