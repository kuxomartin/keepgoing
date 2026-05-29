import type { ReactNode } from 'react'
import Link from 'next/link'
import { Flame, Heart, Footprints, Scale, Smile, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeBalance, fmtKcal } from '@/lib/calculations/calorie-balance'
import type { RecoveryResult } from '@/types/database'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailySummaryCheckin {
  energy: number | null
  stress: number | null
  soreness: number | null
}

export interface DailySummaryProps {
  // Calories — balance only valid when both come from today
  consumed: number | null
  protein: number | null
  /** Same-date active energy only. Pass null if today has no metrics. */
  activeEnergy: number | null
  /** Same-date resting energy only. Pass null if today has no metrics. */
  restingEnergy: number | null

  // Recovery
  recovery: RecoveryResult | null
  hrv: number | null
  restingHr: number | null
  sleepHours: number | null

  // Movement
  steps: number | null
  activityCount: number
  activityMinutes: number

  // Weight
  latestWeight: number | null
  avgWeight7d: number | null

  // Check-in
  checkin: DailySummaryCheckin | null
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function SectionLabel({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2.5">
      {icon}
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
    </div>
  )
}

function pill(color: string, text: string) {
  return (
    <span className={cn('inline-block text-xs font-semibold px-2 py-0.5 rounded-full', color)}>
      {text}
    </span>
  )
}

function rhrColor(hr: number | null): string {
  if (hr == null) return 'text-gray-400'
  return hr <= 55 ? 'text-green-600' : hr <= 65 ? 'text-yellow-600' : 'text-red-600'
}
function hrvColor(hrv: number | null): string {
  if (hrv == null) return 'text-gray-400'
  return hrv >= 55 ? 'text-green-600' : hrv >= 40 ? 'text-yellow-600' : 'text-red-600'
}
function sleepColor(h: number | null): string {
  if (h == null) return 'text-gray-400'
  return h >= 7 ? 'text-green-600' : h >= 6 ? 'text-yellow-600' : 'text-red-600'
}
function stepsColor(s: number | null): string {
  if (s == null) return 'text-gray-400'
  return s >= 8000 ? 'text-green-600' : s >= 5000 ? 'text-blue-600' : 'text-gray-700'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DailySummaryCard({
  consumed, protein, activeEnergy, restingEnergy,
  recovery, hrv, restingHr, sleepHours,
  steps, activityCount, activityMinutes,
  latestWeight, avgWeight7d,
  checkin,
}: DailySummaryProps) {

  // Calorie balance — valid only if today's energy data exists
  const { burned, statusLabel, textColor } = computeBalance(consumed, activeEnergy, restingEnergy)
  const burnValid = burned != null

  // Recovery labels
  const recoveryLabel =
    !recovery ? '—' :
    recovery.status === 'green'  ? 'Good' :
    recovery.status === 'yellow' ? 'Moderate' : 'Low'

  const recoveryPillColor =
    !recovery ? 'bg-gray-100 text-gray-400' :
    recovery.status === 'green'  ? 'bg-green-100 text-green-700' :
    recovery.status === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                                   'bg-red-100 text-red-700'

  // Weight delta
  const weightDelta = latestWeight != null && avgWeight7d != null ? latestWeight - avgWeight7d : null
  const weightDeltaStr =
    weightDelta == null ? null :
    (weightDelta > 0 ? `+${weightDelta.toFixed(1)}` : weightDelta.toFixed(1)) + ' kg vs 7d'
  const weightDeltaColor =
    weightDelta == null ? 'text-gray-400' :
    Math.abs(weightDelta) < 0.3 ? 'text-blue-600' :
    weightDelta < 0 ? 'text-green-600' : 'text-orange-500'

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">Today so far</span>
        <span className="text-xs text-gray-400">Based on logged data</span>
      </div>

      <div className="divide-y divide-gray-100">

        {/* ── 1. Recovery ──────────────────────────────────────────────── */}
        <div className="px-5 py-4">
          <SectionLabel icon={<Heart className="h-3.5 w-3.5 text-red-400" />} label="Recovery" />

          {/* Status pill + HRV + RHR on one line */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {pill(recoveryPillColor, recoveryLabel)}
            {hrv != null && (
              <span className={cn('text-sm font-medium', hrvColor(hrv))}>
                HRV {Math.round(hrv)}<span className="text-xs font-normal text-gray-400"> ms</span>
              </span>
            )}
            {restingHr != null && (
              <span className={cn('text-sm font-medium', rhrColor(restingHr))}>
                RHR {restingHr}<span className="text-xs font-normal text-gray-400"> bpm</span>
              </span>
            )}
          </div>

          {sleepHours != null && (
            <p className="text-xs text-gray-400">
              Sleep{' '}
              <span className={cn('font-semibold', sleepColor(sleepHours))}>
                {sleepHours.toFixed(1)} h
              </span>
            </p>
          )}
          {!recovery && (
            <p className="text-xs text-gray-400">Waiting for Apple Health sync</p>
          )}
        </div>

        {/* ── 2. Calories ──────────────────────────────────────────────── */}
        <div className="px-5 py-4">
          <SectionLabel icon={<Flame className="h-3.5 w-3.5 text-orange-400" />} label="Calories" />

          {burnValid ? (
            /* Full balance: consumed / burned / balance */
            <div className="grid grid-cols-3 gap-3 mb-2.5 text-center">
              <div>
                <p className="text-lg font-bold text-gray-900">{fmtKcal(consumed)}</p>
                <p className="text-xs text-gray-400">consumed</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{fmtKcal(burned)}</p>
                <p className="text-xs text-gray-400">burned</p>
              </div>
              <div>
                <p className={cn('text-lg font-bold', textColor)}>{statusLabel}</p>
                <p className="text-xs text-gray-400">balance</p>
              </div>
            </div>
          ) : (
            /* Consumed only — burn data not yet available */
            <div className="flex items-baseline gap-2 mb-2.5">
              <span className="text-2xl font-bold text-gray-900">{fmtKcal(consumed)}</span>
              <span className="text-sm text-gray-400">kcal consumed</span>
            </div>
          )}

          {/* Protein + sync note */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            {protein != null ? (
              <span className="text-blue-600 font-medium">{Math.round(protein)} g protein</span>
            ) : (
              <span className="text-gray-300">protein not logged</span>
            )}
            {!burnValid && consumed != null && (
              <span className="text-gray-400 ml-auto">Waiting for Apple Health energy data</span>
            )}
            {!burnValid && consumed == null && (
              <span className="text-gray-400">Log a meal to track intake</span>
            )}
          </div>
        </div>

        {/* ── 3. Movement ──────────────────────────────────────────────── */}
        <div className="px-5 py-4">
          <SectionLabel icon={<Footprints className="h-3.5 w-3.5 text-blue-400" />} label="Movement" />

          {/* Steps — primary */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className={cn('text-2xl font-bold', stepsColor(steps))}>
              {steps != null ? steps.toLocaleString() : '—'}
            </span>
            <span className="text-sm text-gray-400">steps</span>
          </div>

          {/* Secondary: workouts / minutes / active kcal */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-400">
            {activityCount > 0 && (
              <span>{activityCount} workout{activityCount !== 1 ? 's' : ''}</span>
            )}
            {activityMinutes > 0 && <span>{activityMinutes} min</span>}
            {activeEnergy != null && (
              <span>{activeEnergy.toLocaleString()} active kcal</span>
            )}
            {steps == null && activityCount === 0 && (
              <span>No movement data yet</span>
            )}
          </div>
        </div>

        {/* ── 4. Weight + Check-in (side by side) ─────────────────────── */}
        <div className="px-5 py-4 grid grid-cols-2 gap-4">

          {/* Weight */}
          <div>
            <SectionLabel icon={<Scale className="h-3.5 w-3.5 text-gray-400" />} label="Weight" />
            {latestWeight != null ? (
              <>
                <p className="text-lg font-bold text-gray-900">
                  {latestWeight.toFixed(1)}<span className="text-xs font-normal text-gray-400 ml-1">kg</span>
                </p>
                {weightDeltaStr && (
                  <p className={cn('text-xs font-medium mt-0.5', weightDeltaColor)}>
                    {weightDeltaStr}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-300">Not logged</p>
            )}
          </div>

          {/* Check-in */}
          <div>
            <SectionLabel icon={<Smile className="h-3.5 w-3.5 text-purple-400" />} label="Check-in" />
            {checkin ? (
              <div className="space-y-0.5 text-xs">
                {checkin.energy != null && (
                  <p className="text-gray-600">Energy <span className="font-semibold">{checkin.energy}/10</span></p>
                )}
                {checkin.stress != null && (
                  <p className="text-gray-600">Stress <span className="font-semibold">{checkin.stress}/10</span></p>
                )}
                {checkin.soreness != null && (
                  <p className="text-gray-600">Soreness <span className="font-semibold">{checkin.soreness}/10</span></p>
                )}
              </div>
            ) : (
              <Link
                href="/today#checkin"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Add check-in
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}
