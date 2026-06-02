'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  computeEnergyBalanceSummary,
  computePatternInsights,
  type EnergyBalanceDay,
} from '@/lib/weight/energy-balance'

interface Props {
  days:         EnergyBalanceDay[]  // newest-first, excludes today
  todayIntake:  number | null
}

type Range = 7 | 14 | 30

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  return format(new Date(d + 'T12:00:00'), 'd MMM')
}

function fmtKcal(v: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString()
}

function fmtBalance(v: number | null): string {
  if (v == null) return '—'
  return (v > 0 ? '+' : '') + v.toLocaleString()
}

function balanceCls(v: number | null): string {
  if (v == null) return 'text-white/20'
  if (v < -50)  return 'text-[#16A34A]'   // deficit → green
  if (v > 50)   return 'text-[#FB923C]'   // surplus → orange
  return 'text-white/50'                   // near-zero → neutral
}

function statusCls(status: 'Surplus' | 'Deficit' | 'Maintenance'): string {
  if (status === 'Deficit')     return 'text-[#16A34A]'
  if (status === 'Surplus')     return 'text-[#FB923C]'
  return 'text-white/50'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EnergyBalanceSection({ days, todayIntake }: Props) {
  const [range, setRange] = useState<Range>(14)

  const sliced  = days.slice(0, range)
  const summary = computeEnergyBalanceSummary(days, range)
  const insights = computePatternInsights(sliced)

  return (
    <div>
      {/* Section header + range selector */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.18em]">
            Energy Balance
          </p>
          <p className="text-[10px] text-white/20 mt-1">
            Completed days only. Burn data comes from Apple Health after daily sync.
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {([7, 14, 30] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] border transition-colors',
                range === r
                  ? 'bg-white text-[#0D0D0D] border-white'
                  : 'text-white/30 border-white/[0.08] hover:text-white/55 hover:border-white/15'
              )}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary block */}
      {summary && (
        <div className="mb-6 mt-6 grid grid-cols-2 sm:grid-cols-4 gap-0 border border-white/[0.06] divide-x divide-white/[0.06]">
          <div className="px-4 py-4">
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.1em] mb-1.5">
              Avg Intake
            </p>
            <p className="font-mono text-base font-bold text-white tabular-nums">
              {summary.avgIntake.toLocaleString()}
            </p>
            <p className="font-mono text-[10px] text-white/20 mt-0.5">kcal / day</p>
          </div>
          <div className="px-4 py-4">
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.1em] mb-1.5">
              Avg Burn
            </p>
            <p className="font-mono text-base font-bold text-white tabular-nums">
              {summary.avgBurn.toLocaleString()}
            </p>
            <p className="font-mono text-[10px] text-white/20 mt-0.5">kcal / day</p>
          </div>
          <div className="px-4 py-4">
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.1em] mb-1.5">
              Avg Balance
            </p>
            <p className={cn('font-mono text-base font-bold tabular-nums', balanceCls(summary.avgBalance))}>
              {fmtBalance(summary.avgBalance)}
            </p>
            <p className="font-mono text-[10px] text-white/20 mt-0.5">kcal / day</p>
          </div>
          <div className="px-4 py-4">
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.1em] mb-1.5">
              Status
            </p>
            <p className={cn('text-base font-bold', statusCls(summary.status))}>
              {summary.status}
            </p>
            <p className="font-mono text-[10px] text-white/20 mt-0.5">{summary.sampleDays} days data</p>
          </div>
        </div>
      )}

      {/* Pattern insights */}
      {insights.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {insights.map(ins => (
            <span
              key={ins.key}
              className="px-3 py-1.5 border border-white/[0.08] bg-white/[0.02] text-xs text-white/50 font-mono"
            >
              {ins.text}
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[360px] border-collapse">
          {/* Sticky header */}
          <thead>
            <tr className="border-b border-white/[0.08]">
              <th className="py-2 pr-4 text-left text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] w-20">
                Date
              </th>
              <th className="py-2 px-3 text-right text-[10px] font-bold text-white/25 uppercase tracking-[0.12em]">
                Intake
              </th>
              <th className="py-2 px-3 text-right text-[10px] font-bold text-white/25 uppercase tracking-[0.12em]">
                Burn
              </th>
              <th className="py-2 pl-3 text-right text-[10px] font-bold text-white/25 uppercase tracking-[0.12em]">
                Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Today row — always first */}
            <tr className="border-b border-white/[0.04] bg-white/[0.015]">
              <td className="py-3 pr-4 font-mono text-xs text-white/35 whitespace-nowrap">
                Today
              </td>
              <td className="py-3 px-3 font-mono text-xs text-right text-white/50 tabular-nums">
                {todayIntake != null && todayIntake > 0
                  ? todayIntake.toLocaleString()
                  : '—'}
              </td>
              <td className="py-3 px-3 font-mono text-xs text-right text-white/20 tabular-nums italic">
                pending
              </td>
              <td className="py-3 pl-3 font-mono text-xs text-right text-white/20 tabular-nums italic">
                pending
              </td>
            </tr>

            {/* Completed days */}
            {sliced.map((day, i) => (
              <tr
                key={day.date}
                className={cn(
                  'border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]',
                  i % 2 === 0 ? '' : 'bg-white/[0.01]'
                )}
              >
                <td className="py-2.5 pr-4 font-mono text-xs text-white/40 whitespace-nowrap">
                  {fmtDate(day.date)}
                </td>
                <td className="py-2.5 px-3 font-mono text-xs text-right text-white/55 tabular-nums">
                  {fmtKcal(day.intake)}
                </td>
                <td className="py-2.5 px-3 font-mono text-xs text-right text-white/55 tabular-nums">
                  {fmtKcal(day.burn)}
                </td>
                <td className={cn(
                  'py-2.5 pl-3 font-mono text-xs text-right tabular-nums font-semibold',
                  balanceCls(day.balance)
                )}>
                  {fmtBalance(day.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <p className="font-mono text-[10px] text-white/15 mt-4 leading-relaxed">
        Burn = active energy + resting energy from Apple Health.
        Days with no intake logged show — for intake.
        Balance is only computed when both values are available.
      </p>
    </div>
  )
}
