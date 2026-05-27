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
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-medium text-gray-700">{label ? format(parseISO(label), 'EEE d MMM') : ''}</p>
      <p className="text-blue-700">{payload[0].value} ms HRV</p>
    </div>
  )
}

export function HrvChart({ data }: { data: HrvChartPoint[] }) {
  const filtered = data.filter((d) => d.hrv !== null) as { date: string; hrv: number }[]

  if (filtered.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-400">
        No HRV data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={filtered} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#93c5fd" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => format(parseISO(v), 'd MMM')}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          width={36}
          unit=" ms"
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="hrv"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#hrvGrad)"
          dot={{ r: 2.5, fill: '#3b82f6', strokeWidth: 0 }}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
