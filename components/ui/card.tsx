import { cn } from '@/lib/utils'

interface DivProps extends React.HTMLAttributes<HTMLDivElement> {}
interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export function Card({ className, ...props }: DivProps) {
  return (
    <div
      className={cn('bg-white rounded-xl border border-gray-200 shadow-sm', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: DivProps) {
  return (
    <div className={cn('px-5 py-4 border-b border-gray-100', className)} {...props} />
  )
}

export function CardTitle({ className, ...props }: HeadingProps) {
  return (
    <h3
      className={cn('text-xs font-semibold text-gray-500 uppercase tracking-wide', className)}
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
      className={cn('px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl', className)}
      {...props}
    />
  )
}
