'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { WeeklyActivityTotal } from '@/lib/calculations/weekly-totals'

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const hours = (payload[0].value / 60).toFixed(1)
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-medium text-gray-700">
        Week of {label ? format(parseISO(label), 'd MMM') : ''}
      </p>
      <p className="text-blue-700">{payload[0].value} min ({hours}h)</p>
      {payload[1] && <p className="text-gray-500">{payload[1].value?.toFixed(1)} km</p>}
    </div>
  )
}

export function ActivityDurationChart({ data }: { data: WeeklyActivityTotal[] }) {
  if (data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-400">
        No activity data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="weekStart"
          tickFormatter={(v) => format(parseISO(v), 'd MMM')}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          width={36}
          tickFormatter={(v) => `${v}m`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Bar
          dataKey="totalDurationMinutes"
          fill="#3b82f6"
          radius={[3, 3, 0, 0]}
          name="duration"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
