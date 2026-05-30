/**
 * YESTERDAY widget — flat, cardless. Renders as content, not a card.
 * Wrapping container is provided by the Today page.
 */
import { cn } from '@/lib/utils'
import type { DaySummary } from '@/lib/insights/types'

interface Props {
  yday: DaySummary | null
  calBase7d: number | null
}

function fmt(n: number): string { return Math.round(n).toLocaleString() }

function interpret(
  yday: DaySummary,
  calBase7d: number | null,
): { interpretation: string; recommendation: string } {
  const burned =
    yday.activeEnergy != null || yday.restingEnergy != null
      ? (yday.activeEnergy ?? 0) + (yday.restingEnergy ?? 0)
      : null

  const balance =
    yday.calories != null && burned != null && burned > 0
      ? yday.calories - burned
      : null

  const hasActivity    = yday.activityMinutes > 20
  const intakeHigh     = yday.calories != null && calBase7d != null && yday.calories > calBase7d * 1.2
  const intakeRelRatio = yday.calories != null && calBase7d != null
    ? Math.round((yday.calories / calBase7d - 1) * 100)
    : null

  if (balance != null) {
    if (balance > 500) {
      if (hasActivity && yday.activityMinutes > 60) {
        return {
          interpretation:
            intakeRelRatio != null && intakeRelRatio > 20
              ? `Intake was ${intakeRelRatio}% above average, but activity was high (${Math.round(yday.activityMinutes)} min). Balance: +${fmt(balance)} kcal.`
              : `Higher intake alongside ${Math.round(yday.activityMinutes)} min of activity — balance +${fmt(balance)} kcal.`,
          recommendation:
            balance > 800
              ? 'Balance was above typical even with activity. Consider lighter meals today.'
              : 'Activity-fuelled intake. No significant adjustment needed.',
        }
      }
      return {
        interpretation: `Yesterday ended with a +${fmt(balance)} kcal surplus.`,
        recommendation:
          balance > 900
            ? 'Focus on lighter, nutrient-dense meals today and reduce unnecessary snacking.'
            : 'Consider keeping meals lighter today to balance the week.',
      }
    }

    if (balance < -700) {
      return {
        interpretation: `Large calorie deficit — ${fmt(Math.abs(balance))} kcal below burn.`,
        recommendation: hasActivity
          ? 'Ensure adequate fuelling today to recover from training.'
          : 'Increase food intake — a sustained large deficit affects recovery and HRV.',
      }
    }

    if (hasActivity) {
      return {
        interpretation:
          intakeRelRatio != null && intakeRelRatio > 15
            ? `Intake was elevated (+${intakeRelRatio}% above avg) but activity was high — balance was ${balance > 0 ? '+' : ''}${fmt(balance)} kcal.`
            : `Fuelling matched activity well. Balance: ${balance > 0 ? '+' : ''}${fmt(balance)} kcal.`,
        recommendation: 'No adjustment needed — maintain the same approach.',
      }
    }

    return {
      interpretation:
        balance < -50
          ? `Moderate deficit — ${fmt(Math.abs(balance))} kcal below burn.`
          : `Near-maintenance intake — balance ${balance > 0 ? '+' : ''}${fmt(balance)} kcal.`,
      recommendation: 'No significant adjustment needed.',
    }
  }

  if (yday.calories != null && yday.calories > 200) {
    if (hasActivity) {
      return {
        interpretation: `${fmt(yday.calories)} kcal logged with ${Math.round(yday.activityMinutes)} min of activity. Burn data pending.`,
        recommendation: intakeHigh
          ? 'Calorie balance will confirm once burn data syncs — looks reasonable given activity.'
          : 'Looks reasonable alongside the activity. No action needed.',
      }
    }
    return {
      interpretation: `${fmt(yday.calories)} kcal consumed. Burn data not yet available.`,
      recommendation: 'Calorie balance will be available once Apple Health syncs.',
    }
  }

  if (hasActivity) {
    return {
      interpretation: `${Math.round(yday.activityMinutes)} min of activity. No food logged.`,
      recommendation: 'Log meals to track nutrition alongside training.',
    }
  }

  return { interpretation: 'No data logged for yesterday.', recommendation: '' }
}

export function YesterdayWidget({ yday, calBase7d }: Props) {
  if (!yday) return null

  const { interpretation, recommendation } = interpret(yday, calBase7d)

  const burned =
    yday.activeEnergy != null || yday.restingEnergy != null
      ? (yday.activeEnergy ?? 0) + (yday.restingEnergy ?? 0)
      : null
  const balance = yday.calories != null && burned != null && burned > 0
    ? yday.calories - burned : null

  const accentColor =
    balance == null     ? 'bg-gray-300 dark:bg-zinc-600' :
    balance > 500       ? 'bg-amber-400'                  :
    balance < -700      ? 'bg-blue-400'                   :
    'bg-gray-300 dark:bg-zinc-600'

  return (
    <div className="flex gap-3.5">
      {/* Vertical accent line */}
      <div className={cn('w-0.5 self-stretch rounded-full flex-shrink-0 min-h-[16px]', accentColor)} />

      <div className="flex-1 min-w-0 space-y-1.5">
        <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Yesterday</span>

        {/* Data chips */}
        {(yday.calories != null || balance != null || yday.activityMinutes > 0) && (
          <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
            {yday.calories != null && (
              <span className="text-sm font-semibold text-gray-800 dark:text-zinc-200 tabular-nums">{fmt(yday.calories)} kcal</span>
            )}
            {balance != null && (
              <span className="text-sm text-gray-500 dark:text-zinc-400 tabular-nums">
                {balance > 0 ? '+' : ''}{fmt(balance)} balance
              </span>
            )}
            {yday.protein != null && (
              <span className="text-sm text-gray-500 dark:text-zinc-400">{Math.round(yday.protein)}g protein</span>
            )}
            {yday.activityMinutes > 0 && (
              <span className="text-sm text-gray-500 dark:text-zinc-400">{Math.round(yday.activityMinutes)} min active</span>
            )}
          </div>
        )}

        <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 leading-snug">{interpretation}</p>
        {recommendation && (
          <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">{recommendation}</p>
        )}
      </div>
    </div>
  )
}
