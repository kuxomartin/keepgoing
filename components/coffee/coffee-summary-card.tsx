import Link from 'next/link'
import { coffeeLabel } from '@/lib/coffee/types'
import type { CoffeeLog } from '@/types/database'
import { format } from 'date-fns'

interface Props {
  logs: CoffeeLog[]
  date: string  // YYYY-MM-DD
}

export function CoffeeSummaryCard({ logs, date }: Props) {
  const totalCups    = logs.reduce((s, l) => s + Number(l.cups), 0)
  const totalCaffeine = logs.reduce((s, l) => s + (l.caffeine_mg ?? 0), 0)
  const lastLog      = logs.length > 0 ? logs[logs.length - 1] : null

  const lastTime = lastLog
    ? format(new Date(lastLog.consumed_at), 'HH:mm')
    : null

  const addHref = `/coffee/add?date=${date}&from=food`

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>☕</span>
          <span className="text-sm font-semibold text-gray-700">Coffee today</span>
        </div>
        <Link
          href={addHref}
          className="text-xs font-medium text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1 rounded-full transition-colors"
        >
          + Add
        </Link>
      </div>

      {logs.length === 0 ? (
        <div className="px-5 py-4">
          <p className="text-sm text-gray-400">No coffee logged yet today.</p>
        </div>
      ) : (
        <div className="px-5 py-4">
          {/* Summary row */}
          <div className="flex gap-6 mb-3">
            <div>
              <p className="text-xl font-bold text-gray-900">
                {totalCups % 1 === 0 ? totalCups : totalCups.toFixed(1)}
              </p>
              <p className="text-xs text-gray-400">cups</p>
            </div>
            <div>
              <p className="text-xl font-bold text-amber-700">
                {totalCaffeine > 0 ? totalCaffeine : '—'}
              </p>
              <p className="text-xs text-gray-400">mg caffeine</p>
            </div>
            {lastTime && (
              <div>
                <p className="text-xl font-bold text-gray-600">{lastTime}</p>
                <p className="text-xs text-gray-400">last coffee</p>
              </div>
            )}
          </div>

          {/* Log entries */}
          <ul className="space-y-1">
            {logs.map(l => (
              <li key={l.id} className="flex items-center justify-between text-xs">
                <Link
                  href={`/coffee/${l.id}/edit`}
                  className="flex items-center gap-2 text-gray-600 hover:text-amber-700 group"
                >
                  <span className="font-medium group-hover:underline">
                    {coffeeLabel(l.coffee_type)}
                    {Number(l.cups) !== 1 && ` ×${l.cups}`}
                  </span>
                  {l.caffeine_mg != null && (
                    <span className="text-gray-400">{l.caffeine_mg}mg</span>
                  )}
                </Link>
                <span className="text-gray-400">
                  {format(new Date(l.consumed_at), 'HH:mm')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
