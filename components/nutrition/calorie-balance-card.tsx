import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Flame, ArrowRight } from 'lucide-react'
import { computeBalance, fmtKcal } from '@/lib/calculations/calorie-balance'

interface Props {
  consumed: number | null
  activeEnergy: number | null
  restingEnergy: number | null
}

export function CalorieBalanceCard({ consumed, activeEnergy, restingEnergy }: Props) {
  const { burned, balance, statusLabel, helpText, color, borderColor, textColor } =
    computeBalance(consumed, activeEnergy, restingEnergy)

  const colorStyles = {
    green:   { bg: 'bg-green-50',  badge: 'bg-green-100  text-green-700' },
    blue:    { bg: 'bg-blue-50',   badge: 'bg-blue-100   text-blue-700'  },
    orange:  { bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700'},
    red:     { bg: 'bg-red-50',    badge: 'bg-red-100    text-red-700'   },
    neutral: { bg: 'bg-gray-50',   badge: 'bg-gray-100   text-gray-500'  },
  }[color]

  return (
    <div className={cn('rounded-xl border-l-4 bg-white shadow-sm border border-gray-200 overflow-hidden', borderColor)}>
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Calorie Balance
          </span>
        </div>
        <Link
          href="/nutrition"
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Details
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Metrics row */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-3 gap-3 text-center mb-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Consumed</p>
            <p className="text-xl font-bold text-gray-900">{fmtKcal(consumed)}</p>
            <p className="text-xs text-gray-400">kcal</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Burned</p>
            <p className="text-xl font-bold text-gray-900">{fmtKcal(burned)}</p>
            <p className="text-xs text-gray-400">kcal</p>
          </div>
          <div className={cn('rounded-lg px-2 py-1.5', colorStyles.bg)}>
            <p className="text-xs text-gray-400 mb-1">Balance</p>
            <p className={cn('text-xl font-bold', textColor)}>{statusLabel}</p>
            <p className="text-xs text-gray-400">kcal</p>
          </div>
        </div>

        {/* Help text badge */}
        <div className={cn('rounded-lg px-3 py-2 text-center', colorStyles.bg)}>
          <p className={cn('text-xs font-medium', textColor)}>{helpText}</p>
        </div>
      </div>
    </div>
  )
}
