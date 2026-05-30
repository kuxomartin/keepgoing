'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, subDays, startOfDay, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

interface DateNavStripProps {
  selectedDate: string // yyyy-MM-dd
}

export function DateNavStrip({ selectedDate }: DateNavStripProps) {
  const router = useRouter()
  const today = format(new Date(), 'yyyy-MM-dd')

  // Last 7 days, oldest first → newest (today) at right
  const pills = Array.from({ length: 7 }, (_, i) => {
    const date = format(subDays(startOfDay(new Date()), 6 - i), 'yyyy-MM-dd')
    const isToday = date === today
    const isSelected = date === selectedDate
    const dayLabel = isToday ? 'Today' : format(parseISO(date), 'EEE')
    const dayNum = format(parseISO(date), 'd')
    return { date, isToday, isSelected, dayLabel, dayNum }
  })

  // Older-date picker — navigate immediately on change
  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (val) router.push(`/food?date=${val}`)
  }

  const isOlderDate = !pills.some(p => p.date === selectedDate)

  return (
    <div className="space-y-3">
      {/* ── 7-day pill strip ─────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
        {pills.map(({ date, isSelected, isToday, dayLabel, dayNum }) => (
          <Link
            key={date}
            href={`/food?date=${date}`}
            scroll={false}
            className={cn(
              'flex flex-col items-center px-3.5 py-2.5 rounded-xl border text-sm font-medium',
              'flex-shrink-0 min-w-[56px] min-h-[56px] justify-center transition-colors',
              isSelected
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : isToday
                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 active:scale-95'
            )}
          >
            <span className={cn(
              'text-[11px] leading-none mb-0.5',
              isSelected ? 'text-blue-200' : isToday ? 'text-blue-500' : 'text-gray-400'
            )}>
              {dayLabel}
            </span>
            <span className="font-bold text-base leading-none">{dayNum}</span>
          </Link>
        ))}
      </div>

      {/* ── Older date picker (no Go button) ─────────────────────── */}
      <div className="flex items-center gap-2.5">
        <span className="text-xs text-gray-400 flex-shrink-0">Older date</span>
        <input
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
          max={today}
          className={cn(
            'h-8 rounded-lg border bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors',
            isOlderDate
              ? 'border-blue-400 text-blue-700 ring-1 ring-blue-200'
              : 'border-gray-200 text-gray-500'
          )}
        />
        {isOlderDate && (
          <span className="text-xs text-blue-600 font-medium">
            {format(parseISO(selectedDate), 'EEE, d MMM')}
          </span>
        )}
      </div>
    </div>
  )
}
