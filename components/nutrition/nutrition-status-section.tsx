'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { NutritionStatusItem } from '@/lib/nutrition/today-status'
import type { PlanResponse } from '@/app/api/food/plan/route'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PlanContext {
  foodDescriptions:  string[]
  caloriesConsumed:  number
  proteinConsumed:   number
  calorieTarget:     number
  proteinTarget:     number
  coffeeMg:          number
  recoveryScore:     number | null
  sleepH:            number | null
  todayTraining:     string | null
}

interface Props {
  statusItems:  NutritionStatusItem[]
  planContext:  PlanContext
}

// ── Status icon + colour ───────────────────────────────────────────────────────

function StatusIcon({ status }: { status: NutritionStatusItem['status'] }) {
  if (status === 'ok')      return <span className="text-[#12B76A] font-bold text-sm leading-none flex-shrink-0">✓</span>
  if (status === 'warning') return <span className="text-[#FFB800] font-bold text-sm leading-none flex-shrink-0">⚠</span>
  return <span className="text-white/25 font-bold text-sm leading-none flex-shrink-0">·</span>
}

// ── Plan result card ───────────────────────────────────────────────────────────

function PlanCard({ plan }: { plan: PlanResponse }) {
  return (
    <div className="mt-6 border border-white/[0.08] bg-white/[0.02]">
      {/* Objective */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-1.5">Objective</p>
        <p className="text-sm font-semibold text-white leading-snug">{plan.objective}</p>
      </div>

      {/* Dinner */}
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-2">Recommended Dinner</p>
        <p className="text-sm font-semibold text-white mb-1">{plan.dinner.name}</p>
        <p className="text-sm text-white/55 leading-relaxed mb-2">{plan.dinner.description}</p>
        <p className="font-mono text-xs text-white/35">
          ~{plan.dinner.estimatedCalories} kcal · {plan.dinner.estimatedProtein}g protein
        </p>
      </div>

      {/* Snack */}
      {plan.snack && (
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-2">Optional Snack</p>
          <p className="text-sm font-semibold text-white mb-1">{plan.snack.name}</p>
          <p className="text-sm text-white/55 leading-relaxed mb-2">{plan.snack.description}</p>
          <p className="font-mono text-xs text-white/35">
            ~{plan.snack.estimatedCalories} kcal · {plan.snack.estimatedProtein}g protein
          </p>
        </div>
      )}

      {/* Reasoning */}
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-1.5">Why these choices</p>
        <p className="text-sm text-white/50 leading-relaxed">{plan.reasoning}</p>
      </div>

      {/* Totals */}
      <div className="px-5 py-3 flex gap-5">
        <p className="font-mono text-xs text-white/40">
          Adds: <span className="font-semibold text-white/60">{plan.totalCalories} kcal</span>
        </p>
        <p className="font-mono text-xs text-white/40">
          Protein: <span className="font-semibold text-white/60">+{plan.totalProtein}g</span>
        </p>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

type Mode = 'lean' | 'balanced' | 'performance'

const MODE_LABELS: { key: Mode; label: string }[] = [
  { key: 'lean',        label: 'Lean'        },
  { key: 'balanced',    label: 'Balanced'    },
  { key: 'performance', label: 'Performance' },
]

export function NutritionStatusSection({ statusItems, planContext }: Props) {
  const [mode, setMode]       = useState<Mode>('balanced')
  const [loading, setLoading] = useState(false)
  const [plan, setPlan]       = useState<PlanResponse | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [hasPlanned, setHasPlanned] = useState(false)

  async function handlePlan() {
    setLoading(true)
    setError(null)
    setPlan(null)
    try {
      const res = await fetch('/api/food/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...planContext, mode }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        setError(err.error ?? 'Failed to generate plan')
        return
      }
      const data = await res.json() as PlanResponse
      setPlan(data)
      setHasPlanned(true)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.18em]">
          Today Nutrition Status
        </p>
      </div>

      {/* Status items */}
      <div className="space-y-3 mb-8">
        {statusItems.map(item => (
          <div key={item.key} className="flex items-start gap-2.5">
            <StatusIcon status={item.status} />
            <div>
              <p className={cn(
                'text-sm leading-snug',
                item.status === 'ok'      ? 'text-white/70'
                : item.status === 'warning' ? 'text-white/85'
                : 'text-white/40'
              )}>
                {item.label}
              </p>
              {item.detail && (
                <p className="font-mono text-xs text-white/35 mt-0.5">{item.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.06] mb-6" />

      {/* Mode selector */}
      <div className="flex items-center gap-1 mb-4">
        {MODE_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setMode(key); if (hasPlanned) { setPlan(null); setHasPlanned(false) } }}
            className={cn(
              'px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] border transition-colors',
              mode === key
                ? 'bg-white text-[#0D0D0D] border-white'
                : 'text-white/35 border-white/[0.08] hover:text-white/65 hover:border-white/15'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* CTA button */}
      <button
        onClick={handlePlan}
        disabled={loading}
        className={cn(
          'flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border transition-all',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          loading
            ? 'border-white/20 text-white/50'
            : 'border-white/[0.15] text-white/80 hover:border-white/35 hover:text-white'
        )}
      >
        {loading ? (
          <>
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" />
            Planning…
          </>
        ) : (
          <>Plan the rest of today →</>
        )}
      </button>

      {/* Error */}
      {error && (
        <p className="mt-3 text-xs text-[#E5173F]">{error}</p>
      )}

      {/* Plan result */}
      {plan && <PlanCard plan={plan} />}
    </div>
  )
}
