'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { format, parseISO } from 'date-fns'

export interface SleepChartPoint {
  date: string
  hours: number
}

function barColor(hours: number) {
  if (hours >= 7) return '#60a5fa'   // blue-400
  if (hours >= 6) return '#fbbf24'   // yellow-400
  return '#f87171'                    // red-400
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const hours = payload[0].value
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-medium text-gray-700">{label ? format(parseISO(label), 'EEE d MMM') : ''}</p>
      <p className="text-gray-600">{hours.toFixed(1)}h sleep</p>
    </div>
  )
}

export function SleepChart({ data }: { data: SleepChartPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-400">
        No sleep data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => format(parseISO(v), 'd MMM')}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 10]}
          ticks={[0, 4, 6, 7, 8, 10]}
          tickFormatter={(v) => `${v}h`}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <ReferenceLine y={7} stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1.5} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Bar dataKey="hours" radius={[3, 3, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={barColor(entry.hours)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
