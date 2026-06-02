import { cn } from '@/lib/utils'

/** 1200px max-width content container — global standard. Matches Sleep page layout. */
export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16', className)}>
      {children}
    </div>
  )
}
