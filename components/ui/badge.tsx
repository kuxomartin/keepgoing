import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'green' | 'yellow' | 'red' | 'blue' | 'purple'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-gray-100 text-gray-700',
        variant === 'green' && 'bg-green-100 text-green-700',
        variant === 'yellow' && 'bg-yellow-100 text-yellow-700',
        variant === 'red' && 'bg-red-100 text-red-700',
        variant === 'blue' && 'bg-blue-100 text-blue-700',
        variant === 'purple' && 'bg-purple-100 text-purple-700',
        className
      )}
      {...props}
    />
  )
}
