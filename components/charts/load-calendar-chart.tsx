'use client'

import { useState, useRef, useCallback } from 'react'
import { format, parseISO, addDays } from 'date-fns'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

type RecoveryOutcome = 'improved' | 'stable' | 'dropped' | 'unknown'
type DayType = 'training' | 'movement' | 'empty'

interface CalDay {
  date:         string
  dayType:      DayType
  load:         number
  count:        number
  totalMinutes: number
  activeEnergy: number
  outcome:      RecoveryOutcome | null
  dotSize:      number
  color:        string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CELL = 44
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const RECOVERY_COLORS: Record<RecoveryOutcome, string> = {
  improved: '#12B76A',
  stable:   '#FFB800',
  dropped:  '#E5173F',
  unknown:  '#FF8A00',
}

const MOVEMENT_COLOR = '#7C8794'
const EMPTY_COLOR    = '#3A4450'

// Training load dot diameters — percentile-ranked from active days
const TRAINING_SIZES = { veryLow: 6, low: 9, medium: 13, high: 18, veryHigh: 24 }
const EMPTY_SIZE = 4

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function getOutcome(date: string, hrv: Record<string, number>): RecoveryOutcome {
  const next = format(addDays(parseISO(date), 1), 'yyyy-MM-dd')
  const h0   = hrv[date]
  const h1   = hrv[next]
  if (h0 == null || h1 == null) return 'unknown'
  const diff = h1 - h0
  if (diff >= 5)  return 'improved'
  if (diff <= -5) return 'dropped'
  return 'stable'
}

function trainingSize(load: number, sortedLoads: number[]): number {
  if (load === 0 || sortedLoads.length === 0) return EMPTY_SIZE
  let rank = 0
  for (const l of sortedLoads) { if (l <= load) rank++ }
  const pct = rank / sortedLoads.length
  if (pct <= 0.20) return TRAINING_SIZES.veryLow
  if (pct <= 0.40) return TRAINING_SIZES.low
  if (pct <= 0.60) return TRAINING_SIZES.medium
  if (pct <= 0.80) return TRAINING_SIZES.high
  return TRAINING_SIZES.veryHigh
}

function movementSize(kcal: number): number {
  if (kcal >= 1500) return 22
  if (kcal >= 1000) return 17
  if (kcal >= 600)  return 13
  if (kcal >= 300)  return 10
  return 7
}

// ── Component ──────────────────────────────────────────────────────────────────

export interface CalendarDayInput {
  period:       string   // yyyy-MM-dd
  load:         number
  count:        number
  totalMinutes: number
}

export function LoadCalendarChart({
  data,
  hrvByDate = {},
  activeEnergyByDate = {},
  selectedPeriod,
  onDotClick,
}: {
  data:                 CalendarDayInput[]
  hrvByDate?:           Record<string, number>
  activeEnergyByDate?:  Record<string, number>
  selectedPeriod?:      string | null
  onDotClick?:          (period: string) => void
}) {
  const [tooltip, setTooltip] = useState<{ day: CalDay; x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Percentile buckets from training days only — never mix with energy values
  const trainingSorted = data
    .filter(d => d.load > 0)
    .map(d => d.load)
    .sort((a, b) => a - b)

  // Enrich each day
  const days: CalDay[] = data.map(d => {
    const hasTraining  = d.count > 0 && d.load > 0
    const activeEnergy = activeEnergyByDate[d.period] ?? 0
    const hasMovement  = !hasTraining && activeEnergy >= 100

    let dayType:  DayType
    let dotSize:  number
    let color:    string
    let outcome:  RecoveryOutcome | null = null

    if (hasTraining) {
      dayType = 'training'
      outcome = getOutcome(d.period, hrvByDate)
      dotSize = trainingSize(d.load, trainingSorted)
      color   = RECOVERY_COLORS[outcome]
    } else if (hasMovement) {
      dayType = 'movement'
      dotSize = movementSize(activeEnergy)
      color   = MOVEMENT_COLOR
    } else {
      dayType = 'empty'
      dotSize = EMPTY_SIZE
      color   = EMPTY_COLOR
    }

    return {
      date:         d.period,
      dayType,
      load:         Math.round(d.load),
      count:        d.count,
      totalMinutes: d.totalMinutes,
      activeEnergy: Math.round(activeEnergy),
      outcome,
      dotSize,
      color,
    }
  })

  const firstDay = parseISO(days[0]?.date ?? format(new Date(), 'yyyy-MM-dd'))
  const startPad = (firstDay.getDay() + 6) % 7   // Mon = 0

  const handleEnter = useCallback((e: React.MouseEvent, day: CalDay) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({ day, x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [])
  const handleLeave = useCallback(() => setTooltip(null), [])

  return (
    <div ref={containerRef} className="relative select-none">

      {/* Weekday header */}
      <div className="grid grid-cols-7" style={{ maxWidth: 7 * CELL }}>
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="flex items-center justify-center" style={{ height: 22 }}>
            <span className="font-mono text-[10px] text-white/20">{d}</span>
          </div>
        ))}
      </div>

      {/* Dot grid */}
      <div className="grid grid-cols-7 overflow-x-auto" style={{ maxWidth: 7 * CELL }}>
        {Array.from({ length: startPad }, (_, i) => (
          <div key={`pad-${i}`} style={{ width: CELL, height: CELL }} />
        ))}
        {days.map(day => {
          const isSelected = selectedPeriod === day.date
          return (
            <div
              key={day.date}
              style={{ width: CELL, height: CELL }}
              className="flex items-center justify-center cursor-pointer"
              onClick={() => onDotClick?.(day.date)}
              onMouseEnter={e => handleEnter(e, day)}
              onMouseLeave={handleLeave}
            >
              <div
                style={{
                  width:           day.dotSize,
                  height:          day.dotSize,
                  borderRadius:    '50%',
                  backgroundColor: day.color,
                  opacity:         day.dayType === 'empty' ? 0.25 : 1,
                  transition:      'transform 0.1s ease, box-shadow 0.1s ease',
                  transform:       isSelected ? 'scale(1.25)' : undefined,
                  boxShadow:       isSelected ? '0 0 0 2px white' : undefined,
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Floating tooltip */}
      {tooltip && (() => {
        const maxLeft = (containerRef.current?.offsetWidth ?? 400) - 188
        return (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left:      Math.min(Math.max(tooltip.x + 8, 0), maxLeft),
              top:       tooltip.y,
              transform: 'translateY(calc(-100% - 8px))',
            }}
          >
            <div className="bg-[#20252B] border border-white/10 px-3 py-2.5 text-xs min-w-[168px]">
              <p className="font-mono text-white/50 mb-1.5">
                {format(parseISO(tooltip.day.date), 'EEE, d MMM')}
              </p>

              {tooltip.day.dayType === 'training' && (
                <>
                  <p className="font-mono text-white mb-0.5">
                    Load: <span className="font-bold">{tooltip.day.load}</span>
                    {tooltip.day.count > 0 && (
                      <span className="text-white/40 font-normal ml-1.5">
                        · {tooltip.day.count} {tooltip.day.count === 1 ? 'activity' : 'activities'}
                        {tooltip.day.totalMinutes > 0 && ` · ${fmtDuration(tooltip.day.totalMinutes)}`}
                      </span>
                    )}
                  </p>
                  <p className={cn('font-mono font-medium', {
                    'text-[#12B76A]': tooltip.day.outcome === 'improved',
                    'text-[#FFB800]': tooltip.day.outcome === 'stable',
                    'text-[#E5173F]': tooltip.day.outcome === 'dropped',
                    'text-[#FF8A00]': tooltip.day.outcome === 'unknown',
                  })}>
                    {tooltip.day.outcome === 'improved' ? 'Recovery: Improved'
                      : tooltip.day.outcome === 'stable'   ? 'Recovery: Stable'
                      : tooltip.day.outcome === 'dropped'  ? 'Recovery: Dropped'
                      : 'Recovery: Unknown'}
                  </p>
                </>
              )}

              {tooltip.day.dayType === 'movement' && (
                <>
                  <p className="text-white/35 mb-1">No recorded workout</p>
                  <p className="font-mono text-white/60">
                    Active energy:{' '}
                    <span className="font-bold text-white">
                      {tooltip.day.activeEnergy.toLocaleString()} kcal
                    </span>
                  </p>
                </>
              )}

              {tooltip.day.dayType === 'empty' && (
                <p className="text-white/25">No recorded activity</p>
              )}
            </div>
          </div>
        )
      })()}

      {/* Legend — two sections: training vs movement */}
      <div className="mt-5 space-y-2.5">

        {/* Training */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.14em] w-[72px] flex-shrink-0">
            Training
          </span>
          {([
            ['improved', '#12B76A', '↑ Improved'],
            ['stable',   '#FFB800', '→ Stable'],
            ['dropped',  '#E5173F', '↓ Dropped'],
            ['unknown',  '#FF8A00', 'Unknown'],
          ] as [string, string, string][]).map(([key, color, label]) => (
            <div key={key} className="flex items-center gap-1">
              <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
              <span className="text-[10px] text-white/25">{label}</span>
            </div>
          ))}
          <span className="text-[9px] text-white/15">· next-day recovery</span>
        </div>

        {/* Movement */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.14em] w-[72px] flex-shrink-0">
            Movement
          </span>
          <div className="flex items-center gap-1">
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: MOVEMENT_COLOR, flexShrink: 0 }} />
            <span className="text-[10px] text-white/25">Untracked activity</span>
          </div>
        </div>

        {/* Size scale */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.14em] w-[72px] flex-shrink-0">
            Size
          </span>
          <div className="flex items-center gap-1.5">
            {[6, 9, 13, 18, 24].map(s => (
              <div key={s} className="flex items-center justify-center" style={{ width: 26, height: 22 }}>
                <div style={{ width: s, height: s, borderRadius: '50%', backgroundColor: '#FF8A00' }} />
              </div>
            ))}
            <span className="text-[10px] text-white/20 ml-0.5">magnitude →</span>
          </div>
        </div>

      </div>
    </div>
  )
}
