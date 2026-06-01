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
  hours: number | null
}

// Warm monochrome — no blue/amber/Apple Health colors
function barColor(hours: number) {
  if (hours >= 7) return '#5C4A3A'  // warm brown — adequate/good
  if (hours >= 6) return '#C4892A'  // muted ochre — caution
  return '#E5173F'                  // signal red — short
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const hours = payload[0].value
  if (hours == null) return null
  return (
    <div className="bg-white border border-[#D9D9D9] px-3 py-2 text-xs">
      <p className="font-medium text-[#0D0D0D]">{label ? format(parseISO(label), 'EEE d MMM') : ''}</p>
      <p className="text-[#888888]">{Number(hours).toFixed(1)}h sleep</p>
    </div>
  )
}

export function SleepChart({ data, maxHours = 10 }: { data: SleepChartPoint[]; maxHours?: number }) {
  // Only show days with actual data
  const hasData = data.some(d => d.hours != null && d.hours > 0)

  if (!hasData) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-[#888888]">
        No recent sleep data
      </div>
    )
  }

  // Replace null/0 with undefined so Recharts skips the bar
  const chartData = data.map(d => ({
    date: d.date,
    hours: d.hours && d.hours > 0 ? d.hours : undefined,
  }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => format(parseISO(v), 'd MMM')}
          tick={{ fontSize: 11, fill: '#888888' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, maxHours]}
          ticks={maxHours <= 2 ? [0, 0.5, 1, 1.5, 2] : [4, 6, 7, 8, 10]}
          tickFormatter={(v) => `${v}h`}
          tick={{ fontSize: 11, fill: '#888888' }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        {maxHours > 2 && <ReferenceLine y={7} stroke="#D9D9D9" strokeDasharray="4 4" strokeWidth={1.5} />}
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Bar dataKey="hours" radius={[3, 3, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.hours ? barColor(entry.hours) : 'transparent'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
