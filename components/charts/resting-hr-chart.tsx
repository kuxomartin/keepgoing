'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { format, parseISO } from 'date-fns'

export interface RestingHrChartPoint {
  date: string
  rhr: number | null
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
      <p className="font-mono text-[#E5173F]">{payload[0].value} bpm resting HR</p>
    </div>
  )
}

export function RestingHrChart({ data, onDark }: { data: RestingHrChartPoint[]; onDark?: boolean }) {
  const filtered = data.filter((d) => d.rhr !== null) as { date: string; rhr: number }[]

  if (filtered.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-400">
        No resting HR data yet
      </div>
    )
  }

  const values = filtered.map((d) => d.rhr)
  const minY = Math.floor(Math.min(...values) - 2)
  const maxY = Math.ceil(Math.max(...values) + 2)

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={filtered} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
          domain={[minY, maxY]}
          tick={{ fontSize: 11, fill: '#A8B3BC', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
          axisLine={false}
          tickLine={false}
          width={36}
          unit=" bpm"
        />
        <ReferenceLine y={60} stroke={onDark ? 'rgba(255,255,255,0.08)' : '#D9D9D9'} strokeDasharray="4 4" strokeWidth={1.5} />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        <Line
          type="monotone"
          dataKey="rhr"
          stroke="#E5173F"
          strokeWidth={2}
          dot={{ r: 2.5, fill: '#ef4444', strokeWidth: 0 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
