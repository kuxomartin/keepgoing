/**
 * YESTERDAY widget.
 * Answers: "What happened yesterday, and does today need adjustment?"
 *
 * Principle: never judge intake alone.
 * Always evaluates: consumed + burn + activity load + recent baseline.
 *
 * Structure: hard data → interpretation → recommendation
 */
import { cn } from '@/lib/utils'
import type { DaySummary } from '@/lib/insights/types'

interface Props {
  yday: DaySummary | null
  calBase7d: number | null   // 7-day consumed baseline for context
}

function fmt(n: number): string { return Math.round(n).toLocaleString() }

// ── Context-aware interpretation logic ─────────────────────────────────────────

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

  const hasActivity   = yday.activityMinutes > 20
  const intakeHigh    = yday.calories != null && calBase7d != null && yday.calories > calBase7d * 1.2
  const intakeRelRatio = yday.calories != null && calBase7d != null
    ? Math.round((yday.calories / calBase7d - 1) * 100)
    : null

  // ── Balance available ───────────────────────────────────────────────────
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

    // Healthy range: −700 to +500
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

  // ── Consumed but no burn data ───────────────────────────────────────────
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

  // ── Activity only, no food logged ──────────────────────────────────────
  if (hasActivity) {
    return {
      interpretation: `${Math.round(yday.activityMinutes)} min of activity. No food logged.`,
      recommendation: 'Log meals to track nutrition alongside training.',
    }
  }

  // ── Nothing useful ─────────────────────────────────────────────────────
  return {
    interpretation: 'No data logged for yesterday.',
    recommendation: '',
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function YesterdayWidget({ yday, calBase7d }: Props) {
  if (!yday) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Yesterday</span>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-gray-400">No data available for yesterday.</p>
        </div>
      </div>
    )
  }

  const { interpretation, recommendation } = interpret(yday, calBase7d)

  const burned =
    yday.activeEnergy != null || yday.restingEnergy != null
      ? (yday.activeEnergy ?? 0) + (yday.restingEnergy ?? 0)
      : null
  const balance = yday.calories != null && burned != null && burned > 0
    ? yday.calories - burned
    : null

  // Data chips
  const nutritionChips = [
    yday.calories   != null && `${fmt(yday.calories)} kcal consumed`,
    burned          != null && burned > 0 && `${fmt(burned)} kcal burned`,
    balance         != null && `${balance > 0 ? '+' : ''}${fmt(balance)} balance`,
  ].filter(Boolean) as string[]

  const macroChips = [
    yday.protein    != null && `${Math.round(yday.protein)}g protein`,
  ].filter(Boolean) as string[]

  const activityChips = [
    yday.activityMinutes > 0 && `${Math.round(yday.activityMinutes)} min activity`,
  ].filter(Boolean) as string[]

  // Border colour based on balance context
  const borderColor =
    balance == null ? 'border-l-gray-200' :
    balance > 500   ? 'border-l-orange-400' :
    balance < -700  ? 'border-l-blue-400' :
    'border-l-gray-300'

  return (
    <div className={cn(
      'bg-white rounded-xl border border-gray-200 border-l-4 shadow-sm overflow-hidden',
      borderColor,
    )}>
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Yesterday</span>
      </div>

      <div className="px-5 py-4 space-y-3.5">
        {/* ① Hard data */}
        <div className="space-y-1">
          {nutritionChips.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {nutritionChips.map(chip => (
                <span key={chip} className="text-xs text-gray-700 font-medium">{chip}</span>
              ))}
            </div>
          )}
          {(macroChips.length > 0 || activityChips.length > 0) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {[...macroChips, ...activityChips].map(chip => (
                <span key={chip} className="text-xs text-gray-500">{chip}</span>
              ))}
            </div>
          )}
          {nutritionChips.length === 0 && macroChips.length === 0 && activityChips.length === 0 && (
            <p className="text-xs text-gray-400">No data logged</p>
          )}
        </div>

        {/* ② Interpretation */}
        <p className="text-sm font-semibold text-gray-900 leading-snug">{interpretation}</p>

        {/* ③ Recommendation */}
        {recommendation && (
          <p className="text-sm font-medium text-gray-700 border-t border-gray-100 pt-3">
            {recommendation}
          </p>
        )}
      </div>
    </div>
  )
}
