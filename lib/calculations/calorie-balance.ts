/**
 * Calorie balance utilities.
 * Balance = consumed - burned (negative = deficit, positive = surplus).
 */

export type BalanceStatus = 'deep-deficit' | 'deficit' | 'maintenance' | 'surplus'

export interface BalanceResult {
  consumed: number | null
  burned: number | null
  balance: number | null
  status: BalanceStatus | null
  statusLabel: string
  helpText: string
  color: 'green' | 'blue' | 'orange' | 'red' | 'neutral'
  borderColor: string
  textColor: string
}

export function computeBalance(
  consumed: number | null,
  activeEnergy: number | null,
  restingEnergy: number | null,
): BalanceResult {
  const burned =
    activeEnergy != null || restingEnergy != null
      ? (activeEnergy ?? 0) + (restingEnergy ?? 0)
      : null

  const balance =
    consumed != null && burned != null ? consumed - burned : null

  return { consumed, burned, balance, ...classifyBalance(balance) }
}

function classifyBalance(balance: number | null) {
  if (balance === null) {
    return {
      status: null,
      statusLabel: '—',
      helpText: 'Log meals and sync Apple Health to see balance',
      color: 'neutral' as const,
      borderColor: 'border-l-gray-200',
      textColor: 'text-gray-500',
    }
  }

  if (balance < -800) {
    return {
      status: 'deep-deficit' as const,
      statusLabel: `${balance.toLocaleString()} kcal`,
      helpText: 'Large deficit — may affect recovery and muscle mass',
      color: 'orange' as const,
      borderColor: 'border-l-orange-400',
      textColor: 'text-orange-600',
    }
  }

  if (balance < -100) {
    return {
      status: 'deficit' as const,
      statusLabel: `${balance.toLocaleString()} kcal`,
      helpText: 'On track for fat loss',
      color: 'green' as const,
      borderColor: 'border-l-green-500',
      textColor: 'text-green-600',
    }
  }

  if (balance <= 150) {
    return {
      status: 'maintenance' as const,
      statusLabel: `${balance >= 0 ? '+' : ''}${balance.toLocaleString()} kcal`,
      helpText: 'Maintenance range — energy balanced',
      color: 'blue' as const,
      borderColor: 'border-l-blue-500',
      textColor: 'text-blue-600',
    }
  }

  return {
    status: 'surplus' as const,
    statusLabel: `+${balance.toLocaleString()} kcal`,
    helpText: 'Calorie surplus — check if intentional',
    color: 'red' as const,
    borderColor: 'border-l-red-500',
    textColor: 'text-red-600',
  }
}

/** Format a kcal value for display, e.g. 1834 → "1,834" */
export function fmtKcal(v: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString()
}
