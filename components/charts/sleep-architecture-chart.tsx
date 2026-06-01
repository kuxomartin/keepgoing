'use client'

import { formatMinutes } from '@/lib/calculations/sleep-verdict'

interface SleepArchitectureChartProps {
  deep: number | null
  core: number | null
  rem: number | null
  awake: number | null
}

const SEGMENTS = [
  { key: 'deep'  as const, label: 'Deep',  color: '#1D4ED8', lightColor: '#DBEAFE' },
  { key: 'core'  as const, label: 'Core',  color: '#60A5FA', lightColor: '#EFF6FF' },
  { key: 'rem'   as const, label: 'REM',   color: '#7C3AED', lightColor: '#EDE9FE' },
  { key: 'awake' as const, label: 'Awake', color: '#D97706', lightColor: '#FEF3C7' },
]

export function SleepArchitectureChart({ deep, core, rem, awake }: SleepArchitectureChartProps) {
  const values: Record<string, number | null> = { deep, core, rem, awake }
  const total = SEGMENTS.reduce((s, seg) => s + (values[seg.key] ?? 0), 0)

  if (total === 0) {
    return <p className="text-sm text-[#888888]">No sleep stage data available.</p>
  }

  const active = SEGMENTS.filter(s => (values[s.key] ?? 0) > 0)

  return (
    <div>
      {/* Stacked bar */}
      <div className="h-8 flex rounded-sm overflow-hidden gap-px">
        {active.map(seg => {
          const mins = values[seg.key]!
          const pct  = ((mins / total) * 100).toFixed(2)
          return (
            <div
              key={seg.key}
              style={{ width: `${pct}%`, backgroundColor: seg.color }}
              title={`${seg.label}: ${formatMinutes(mins)}`}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
        {active.map(seg => (
          <div key={seg.key} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-xs text-[#888888]">
              {seg.label}{' '}
              <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">
                {formatMinutes(values[seg.key]!)}
              </span>
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-[#888888]">
            Total in bed{' '}
            <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">
              {formatMinutes(total)}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
