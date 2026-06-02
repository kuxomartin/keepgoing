'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'

export interface HrvChartPoint {
  date: string
  hrv: number | null
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#272D35] border border-white/10 rounded-lg px-3 py-2 text-xs">
      <p className="font-medium text-[#E7EDF2]">{label ? format(parseISO(label), 'EEE d MMM') : ''}</p>
      <p className="font-mono text-[#888888]">{payload[0].value} ms HRV</p>
    </div>
  )
}

export function HrvChart({ data, minimal, onDark }: { data: HrvChartPoint[]; minimal?: boolean; onDark?: boolean }) {
  const filtered = data.filter((d) => d.hrv !== null) as { date: string; hrv: number }[]

  if (filtered.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-[#888888]">
        No HRV data yet
      </div>
    )
  }

  // Minimal mode — atmospheric curve only, no axes/grid/tooltip
  if (minimal) {
    return (
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={filtered} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="hrvGradMinimal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ffffff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ffffff" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="hrv"
            stroke="#ffffff"
            strokeWidth={1.5}
            fill="url(#hrvGradMinimal)"
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={filtered} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={onDark ? '#ffffff' : '#0D0D0D'} stopOpacity={onDark ? 0.12 : 0.15} />
            <stop offset="95%" stopColor={onDark ? '#ffffff' : '#0D0D0D'} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={onDark ? 'rgba(255,255,255,0.06)' : '#D9D9D9'} />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => format(parseISO(v), 'd MMM')}
          tick={{ fontSize: 11, fill: '#A8B3BC', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#A8B3BC', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
          axisLine={false}
          tickLine={false}
          width={36}
          unit=" ms"
        />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        <Area
          type="monotone"
          dataKey="hrv"
          stroke={onDark ? '#A8B3BC' : '#55606C'}
          strokeWidth={1.5}
          fill="url(#hrvGrad)"
          dot={{ r: 2, fill: onDark ? '#A8B3BC' : '#55606C', strokeWidth: 0 }}
          activeDot={{ r: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
