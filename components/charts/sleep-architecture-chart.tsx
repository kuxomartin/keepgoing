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

// High-contrast warm family — on dark background
const SEGMENTS = [
  { key: 'deep'  as const, label: 'Deep',  color: '#E5173F' },  // signal red
  { key: 'core'  as const, label: 'Core',  color: '#FF7A00' },  // orange
  { key: 'rem'   as const, label: 'REM',   color: '#FFB000' },  // amber
  { key: 'awake' as const, label: 'Awake', color: '#F2EDE6' },  // warm stone
]

export function SleepArchitectureChart({ deep, core, rem, awake, inBed, asleep }: Props) {
  const values: Record<string, number | null> = { deep, core, rem, awake }
  const total = SEGMENTS.reduce((s, seg) => s + (values[seg.key] ?? 0), 0)

  if (total === 0) {
    return <p className="text-sm text-white/30">No sleep stage breakdown available.</p>
  }

  const active = SEGMENTS.filter(s => (values[s.key] ?? 0) > 0)

  return (
    <div>
      {/* Summary line */}
      {(asleep != null || inBed != null) && (
        <div className="flex gap-8 mb-6">
          {asleep != null && (
            <div>
              <div className="font-bold text-white text-[2rem] leading-none font-mono tabular-nums">
                {formatMinutes(asleep)}
              </div>
              <div className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.12em] mt-1">Asleep</div>
            </div>
          )}
          {inBed != null && (
            <div>
              <div className="font-bold text-white/40 text-[2rem] leading-none font-mono tabular-nums">
                {formatMinutes(inBed)}
              </div>
              <div className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.12em] mt-1">In bed</div>
            </div>
          )}
        </div>
      )}

      {/* Timeline bar — flagship visualization, 140px tall */}
      <div className="flex rounded-sm overflow-hidden" style={{ height: '140px', gap: '2px' }}>
        {active.map(seg => {
          const mins = values[seg.key]!
          const pct  = ((mins / total) * 100).toFixed(2)
          return (
            <div
              key={seg.key}
              style={{ width: `${pct}%`, backgroundColor: seg.color }}
              title={`${seg.label}: ${formatMinutes(mins)}`}
              className="flex-shrink-0"
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-8 gap-y-3 mt-6">
        {active.map(seg => (
          <div key={seg.key} className="flex items-center gap-2.5">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-sm text-white/50">
              {seg.label}{' '}
              <span className="font-semibold text-white">
                {formatMinutes(values[seg.key]!)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
