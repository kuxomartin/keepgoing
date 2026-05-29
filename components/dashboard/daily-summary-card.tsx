import type { ReactNode } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Flame, Heart, Footprints, Scale, Smile, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeBalance, fmtKcal } from '@/lib/calculations/calorie-balance'
import type { RecoveryResult } from '@/types/database'

// ── Sub-types ────────────────────────────────────────────────────────────────

export interface DailySummaryCheckin {
  energy: number | null
  stress: number | null
  soreness: number | null
}

export interface DailySummaryProps {
  // Calories & macros
  consumed: number | null
  protein: number | null
  activeEnergy: number | null
  restingEnergy: number | null
  /** If burned kcal comes from a previous day's data, pass that date (YYYY-MM-DD) */
  energyFallbackDate: string | null

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      {icon}
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
    </div>
  )
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div>
      <p className={cn('text-lg font-bold leading-tight', color ?? 'text-gray-900')}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

function rhrColor(hr: number | null) {
  if (hr == null) return 'text-gray-400'
  return hr <= 55 ? 'text-green-600' : hr <= 65 ? 'text-yellow-600' : 'text-red-600'
}

function hrvColor(hrv: number | null) {
  if (hrv == null) return 'text-gray-400'
  return hrv >= 55 ? 'text-green-600' : hrv >= 40 ? 'text-yellow-600' : 'text-red-600'
}

function sleepColor(h: number | null) {
  if (h == null) return 'text-gray-400'
  return h >= 7 ? 'text-green-600' : h >= 6 ? 'text-yellow-600' : 'text-red-600'
}

// ── Component ────────────────────────────────────────────────────────────────

export function DailySummaryCard({
  consumed, protein, activeEnergy, restingEnergy, energyFallbackDate,
  recovery, hrv, restingHr, sleepHours,
  steps, activityCount, activityMinutes,
  latestWeight, avgWeight7d,
  checkin,
}: DailySummaryProps) {
  const { burned, statusLabel, textColor } = computeBalance(consumed, activeEnergy, restingEnergy)

  // Recovery
  const recoveryLabel = !recovery ? '—' : recovery.status === 'green' ? 'Good' : recovery.status === 'yellow' ? 'Moderate' : 'Low'
  const recoveryColor = !recovery ? 'text-gray-400' : recovery.status === 'green' ? 'text-green-600' : recovery.status === 'yellow' ? 'text-yellow-600' : 'text-red-600'

  // Steps
  const stepsColor = steps == null ? 'text-gray-400' : steps >= 8000 ? 'text-green-600' : steps >= 5000 ? 'text-blue-600' : 'text-gray-700'

  // Weight vs 7d avg
  const weightDelta = latestWeight != null && avgWeight7d != null ? latestWeight - avgWeight7d : null
  const weightDeltaStr = weightDelta == null ? null : (weightDelta > 0 ? `+${weightDelta.toFixed(1)}` : weightDelta.toFixed(1)) + ' kg vs 7d'
  const weightDeltaColor = weightDelta == null ? 'text-gray-400' : Math.abs(weightDelta) < 0.3 ? 'text-blue-600' : weightDelta < 0 ? 'text-green-600' : 'text-orange-500'

  // Checkin colors (low stress/soreness = good)
  const checkinEnergyColor = (v: number | null) => v == null ? 'text-gray-400' : v >= 7 ? 'text-green-600' : v >= 4 ? 'text-yellow-600' : 'text-red-600'
  const checkinStressColor  = (v: number | null) => v == null ? 'text-gray-400' : v <= 3 ? 'text-green-600' : v <= 6 ? 'text-yellow-600' : 'text-red-600'
  const checkinSoreColor    = (v: number | null) => v == null ? 'text-gray-400' : v <= 3 ? 'text-green-600' : v <= 6 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

      {/* Card header */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">Today so far</span>
        <span className="text-xs text-gray-400">Based on logged data</span>
      </div>

      <div className="divide-y divide-gray-100">

        {/* ─── Calories ───────────────────────────────────── */}
        <div className="px-5 py-4">
          <SectionLabel icon={<Flame className="h-3.5 w-3.5 text-orange-400" />} label="Calories" />
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Stat label="consumed" value={fmtKcal(consumed)} />
            <Stat label="burned"   value={fmtKcal(burned)} />
            <Stat label="balance"  value={statusLabel} color={textColor} />
          </div>

          {/* Protein + fallback note */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">Protein</span>
              <span className={cn('font-medium', protein != null ? 'text-blue-600' : 'text-gray-300')}>
                {protein != null ? `${Math.round(protein)} g` : 'not logged'}
              </span>
            </div>
            {energyFallbackDate && (
              <span className="text-xs text-gray-400">
                Burn est. from {format(parseISO(energyFallbackDate), 'MMM d')}
              </span>
            )}
          </div>
        </div>

        {/* ─── Recovery ───────────────────────────────────── */}
        <div className="px-5 py-4">
          <SectionLabel icon={<Heart className="h-3.5 w-3.5 text-red-400" />} label="Recovery" />
          <div className="grid grid-cols-3 gap-3">
            <Stat label="status"     value={recoveryLabel} color={recoveryColor} />
            <Stat label="HRV"        value={hrv != null ? `${Math.round(hrv)} ms` : '—'} color={hrvColor(hrv)} />
            <Stat label="resting HR" value={restingHr != null ? `${restingHr} bpm` : '—'} color={rhrColor(restingHr)} />
          </div>
          {sleepHours != null && (
            <p className="mt-2.5 text-xs text-gray-400">
              Sleep:{' '}
              <span className={cn('font-medium', sleepColor(sleepHours))}>
                {sleepHours.toFixed(1)} h
              </span>
            </p>
          )}
        </div>

        {/* ─── Movement ───────────────────────────────────── */}
        <div className="px-5 py-4">
          <SectionLabel icon={<Footprints className="h-3.5 w-3.5 text-blue-400" />} label="Movement" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Stat label="steps"      value={steps != null ? steps.toLocaleString() : '—'} color={stepsColor} />
            <Stat label="active kcal" value={activeEnergy != null ? activeEnergy.toLocaleString() : '—'} />
            <Stat label="activities" value={activityCount > 0 ? String(activityCount) : '—'} />
            <Stat label="total min"  value={activityMinutes > 0 ? String(activityMinutes) : '—'} />
          </div>
        </div>

        {/* ─── Weight ─────────────────────────────────────── */}
        <div className="px-5 py-4">
          <SectionLabel icon={<Scale className="h-3.5 w-3.5 text-gray-400" />} label="Weight" />
          <div className="flex items-baseline gap-3">
            <p className="text-2xl font-bold text-gray-900">
              {latestWeight != null ? (
                <>{latestWeight.toFixed(1)}<span className="text-sm font-normal text-gray-400 ml-1">kg</span></>
              ) : '—'}
            </p>
            {weightDeltaStr && (
              <span className={cn('text-sm font-medium', weightDeltaColor)}>
                {weightDeltaStr}
              </span>
            )}
          </div>
        </div>

        {/* ─── Check-in ───────────────────────────────────── */}
        <div className="px-5 py-4">
          <SectionLabel icon={<Smile className="h-3.5 w-3.5 text-purple-400" />} label="Check-in" />
          {checkin ? (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="energy"   value={checkin.energy   != null ? `${checkin.energy}/10`   : '—'} color={checkinEnergyColor(checkin.energy)} />
              <Stat label="stress"   value={checkin.stress   != null ? `${checkin.stress}/10`   : '—'} color={checkinStressColor(checkin.stress)} />
              <Stat label="soreness" value={checkin.soreness != null ? `${checkin.soreness}/10` : '—'} color={checkinSoreColor(checkin.soreness)} />
            </div>
          ) : (
            <Link
              href="/today#checkin"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Add today&apos;s check-in
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

      </div>
    </div>
  )
}
