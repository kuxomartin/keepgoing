'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, subDays, startOfDay, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

export function DateNavStrip({ selectedDate }: { selectedDate: string }) {
  const router = useRouter()
  const today  = format(new Date(), 'yyyy-MM-dd')

  // Last 7 days, oldest first, today at right
  const pills = Array.from({ length: 7 }, (_, i) => {
    const date    = format(subDays(startOfDay(new Date()), 6 - i), 'yyyy-MM-dd')
    const isToday = date === today
    return {
      date,
      isSelected: date === selectedDate,
      num:   format(parseISO(date), 'd'),
      label: isToday ? 'Today' : format(parseISO(date), 'EEE'),
    }
  })

  const isOlderDate = !pills.some(p => p.date === selectedDate)

  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-none">
      {/* 7-day pills — single horizontal row */}
      {pills.map(({ date, isSelected, num, label }, i) => (
        <Link
          key={date}
          href={`/food?date=${date}`}
          scroll={false}
          className={cn(
            'flex items-baseline gap-1 px-2.5 py-1.5 whitespace-nowrap flex-shrink-0 transition-colors',
            isSelected
              ? 'text-white bg-white/[0.08]'
              : 'text-white/30 hover:text-white/60',
            i > 0 && 'border-l border-white/[0.05]',
          )}
        >
          <span className="font-mono font-semibold text-sm leading-none">{num}</span>
          <span className="text-[10px] uppercase tracking-[0.05em] leading-none">{label}</span>
        </Link>
      ))}

      {/* Divider */}
      <div className="w-px h-4 bg-white/[0.08] mx-2 flex-shrink-0" />

      {/* Older date — same row, no box */}
      {isOlderDate && (
        <span className="font-mono text-xs text-white/55 mr-2 whitespace-nowrap flex-shrink-0">
          {format(parseISO(selectedDate), 'd MMM')}
        </span>
      )}
      <input
        type="date"
        value={isOlderDate ? selectedDate : ''}
        onChange={e => { if (e.target.value) router.push(`/food?date=${e.target.value}`) }}
        max={today}
        title="Browse older dates"
        className="h-6 px-1 text-[11px] bg-transparent border-b border-white/[0.08] text-white/25 hover:text-white/40 focus:outline-none cursor-pointer transition-colors flex-shrink-0"
      />
    </div>
  )
}
