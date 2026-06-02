'use client'

/**
 * Stacked bar chart: sleep stage breakdown across recent nights.
 * Each bar = one night. Segments: deep / REM / core / awake (hours).
 * Used for Section 2 – Sleep Architecture history.
 */

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'

export interface SleepStageNight {
  date: string
  deep:  number | null
  rem:   number | null
  core:  number | null
  awake: number | null
}

const COLORS = {
  deep:  '#4A6785',  // steel blue
  rem:   '#8B6FA8',  // muted purple
  core:  '#55606C',  // slate
  awake: '#FFB000',  // amber
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const fmtH = (v: number) => {
    const h = Math.floor(v)
    const m = Math.round((v - h) * 60)
    return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`
  }
  const order = ['deep', 'rem', 'core', 'awake'] as const
  const labels: Record<string, string> = { deep: 'Deep', rem: 'REM', core: 'Core', awake: 'Awake' }
  return (
    <div className="bg-[#20252B] border border-white/10 px-3 py-2 text-xs space-y-1 min-w-[110px]">
      <p className="font-medium text-white mb-1">
        {label ? format(parseISO(label), 'EEE d MMM') : ''}
      </p>
      {order.map(key => {
        const entry = payload.find((p: { dataKey: string; value?: number }) => p.dataKey === key)
        if (!entry?.value) return null
        return (
          <div key={key} className="flex items-center justify-between gap-3">
            <span style={{ color: COLORS[key] }} className="font-semibold">{labels[key]}</span>
            <span className="font-mono text-white/60">{fmtH(entry.value)}</span>
          </div>
        )
      })}
    </div>
  )
}

export function SleepStageHistoryChart({
  data,
  chartHeight = 220,
}: {
  data: SleepStageNight[]
  chartHeight?: number
}) {
  const hasStages = data.some(d => d.deep || d.rem || d.core)

  if (!hasStages) {
    return (
      <div className="flex items-center justify-center text-sm text-[#888888]" style={{ height: chartHeight }}>
        No stage data available
      </div>
    )
  }

  const chartData = data.map(d => ({
    date:  d.date,
    deep:  d.deep  ? Math.round(d.deep  / 60 * 100) / 100 : 0,
    rem:   d.rem   ? Math.round(d.rem   / 60 * 100) / 100 : 0,
    core:  d.core  ? Math.round(d.core  / 60 * 100) / 100 : 0,
    awake: d.awake ? Math.round(d.awake / 60 * 100) / 100 : 0,
  }))

  return (
    <div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => format(parseISO(v), 'd MMM')}
            tick={{ fontSize: 11, fill: '#A8B3BC', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => `${v}h`}
            tick={{ fontSize: 11, fill: '#A8B3BC', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
            axisLine={false}
            tickLine={false}
            width={32}
            domain={[0, 'dataMax + 0.5']}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="deep"  stackId="s" fill={COLORS.deep}  radius={[0,0,0,0]} name="Deep"  />
          <Bar dataKey="rem"   stackId="s" fill={COLORS.rem}   radius={[0,0,0,0]} name="REM"   />
          <Bar dataKey="core"  stackId="s" fill={COLORS.core}  radius={[0,0,0,0]} name="Core"  />
          <Bar dataKey="awake" stackId="s" fill={COLORS.awake} radius={[2,2,0,0]} name="Awake" />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex gap-5 mt-3 flex-wrap">
        {(['deep', 'rem', 'core', 'awake'] as const).map(key => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[key] }} />
            <span className="text-[11px] text-white/40 capitalize">
              {key === 'awake' ? 'Awake' : key === 'rem' ? 'REM' : key.charAt(0).toUpperCase() + key.slice(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
