'use client'

import { formatMinutes } from '@/lib/calculations/sleep-verdict'

interface Props {
  deep: number | null
  core: number | null
  rem: number | null
  awake: number | null
  inBed?: number | null
  asleep?: number | null
}

// Warm monochrome — no Apple Health rainbow
const SEGMENTS = [
  { key: 'deep'  as const, label: 'Deep',  color: '#2C1810' },  // near black / dark brown
  { key: 'core'  as const, label: 'Core',  color: '#8C7B70' },  // taupe / warm gray
  { key: 'rem'   as const, label: 'REM',   color: '#C49A8A' },  // muted dusty rose
  { key: 'awake' as const, label: 'Awake', color: '#E0D5CC' },  // warm stone (light)
]

export function SleepArchitectureChart({ deep, core, rem, awake, inBed, asleep }: Props) {
  const values: Record<string, number | null> = { deep, core, rem, awake }
  const total = SEGMENTS.reduce((s, seg) => s + (values[seg.key] ?? 0), 0)

  if (total === 0) {
    return <p className="text-sm text-[#888888]">No sleep stage breakdown available.</p>
  }

  const active = SEGMENTS.filter(s => (values[s.key] ?? 0) > 0)

  return (
    <div>
      {/* Optional summary line */}
      {(asleep != null || inBed != null) && (
        <div className="flex gap-6 text-xs text-[#888888] mb-5">
          {asleep != null && (
            <span>Asleep <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{formatMinutes(asleep)}</span></span>
          )}
          {inBed != null && (
            <span>In bed <span className="font-semibold text-[#0D0D0D] dark:text-zinc-200">{formatMinutes(inBed)}</span></span>
          )}
        </div>
      )}

      {/* Stacked bar */}
      <div className="h-7 flex rounded-sm overflow-hidden gap-[2px]">
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
      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
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
      </div>
    </div>
  )
}
