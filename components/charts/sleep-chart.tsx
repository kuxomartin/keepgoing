'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { format, parseISO } from 'date-fns'

export interface SleepChartPoint {
  date: string
  hours: number | null
}

// Black / amber / red — no brown, no blue
function barColor(hours: number) {
  if (hours >= 7) return '#0D0D0D'   // black — solid
  if (hours >= 6) return '#FFB000'   // amber — caution
  return '#E5173F'                   // red — short
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const hours = payload[0].value
  if (hours == null) return null
  return (
    <div className="bg-[#0D0D0D] border border-white/10 px-3 py-2 text-xs">
      <p className="font-medium text-white">{label ? format(parseISO(label), 'EEE d MMM') : ''}</p>
      <p className="text-white/50">{Number(hours).toFixed(1)}h sleep</p>
    </div>
  )
}

export function SleepChart({
  data,
  maxHours = 10,
  fixedColor,
  chartHeight = 200,
}: {
  data: SleepChartPoint[]
  maxHours?: number
  fixedColor?: string
  chartHeight?: number
}) {
  const hasData = data.some(d => d.hours != null && d.hours > 0)

  if (!hasData) {
    return (
      <div className="flex items-center justify-center text-sm text-[#888888]" style={{ height: chartHeight }}>
        No recent sleep data
      </div>
    )
  }

  const chartData = data.map(d => ({
    date: d.date,
    hours: d.hours && d.hours > 0 ? d.hours : undefined,
  }))

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
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
        <Bar dataKey="hours" radius={[2, 2, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.hours ? (fixedColor ?? barColor(entry.hours)) : 'transparent'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
