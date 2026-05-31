import { cn } from '@/lib/utils'

interface DivProps extends React.HTMLAttributes<HTMLDivElement> {}
interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export function Card({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: DivProps) {
  return (
    <div
      className={cn('px-5 py-4 border-b border-gray-100 dark:border-zinc-800', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: HeadingProps) {
  return (
    <h3
      className={cn('text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide', className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: DivProps) {
  return <div className={cn('px-5 py-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: DivProps) {
  return (
    <div
      className={cn('px-5 py-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 rounded-b-2xl', className)}
      {...props}
    />
  )
}
