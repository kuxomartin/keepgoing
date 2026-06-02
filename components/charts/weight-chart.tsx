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

export interface WeightChartPoint {
  date: string   // 'YYYY-MM-DD'
  weight: number
  ma7: number
}

interface WeightChartProps {
  data: WeightChartPoint[]
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#272D35] border border-white/10 px-3 py-2 text-xs">
      <p className="font-medium text-[#E7EDF2] mb-1">
        {label ? format(parseISO(label), 'EEE d MMM') : ''}
      </p>
      {payload.map((p) => (
        <p key={p.name} className="text-[#A8B3BC]">
          {p.name === 'weight' ? 'Weight' : '7-day avg'}: <span className="font-mono font-semibold text-[#E7EDF2]">{p.value.toFixed(1)} kg</span>
        </p>
      ))}
    </div>
  )
}

export function WeightChart({ data }: WeightChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-gray-400">
        No weight data yet
      </div>
    )
  }

  const weights = data.map((d) => d.weight)
  const minY = Math.floor(Math.min(...weights) - 0.5)
  const maxY = Math.ceil(Math.max(...weights) + 0.5)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
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
          tickFormatter={(v) => `${v}`}
          tick={{ fontSize: 11, fill: '#A8B3BC', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1.5}
          dot={{ r: 2, fill: '#A8B3BC', strokeWidth: 0 }}
          activeDot={{ r: 3 }}
          name="weight"
        />
        <Line
          type="monotone"
          dataKey="ma7"
          stroke="#A8B3BC"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: '#0D0D0D' }}
          name="ma7"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
