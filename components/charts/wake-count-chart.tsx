'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface DataPoint { date: string; value: number | null }

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string
}) => {
  if (!active || !payload?.[0]) return null
  const val = payload[0].value
  if (val == null) return null
  return (
    <div className="bg-[#20252B] border border-white/10 text-xs px-2.5 py-1.5 rounded-sm">
      <span className="font-mono text-white/50">{label} · </span><span className="font-mono">{val} wakes</span>
    </div>
  )
}

export function WakeCountChart({ data, chartHeight = 200 }: { data: DataPoint[]; chartHeight?: number }) {
  const hasData = data.some(d => d.value != null)
  if (!hasData) return <p className="text-sm text-[#888888] py-4">No data</p>

  const chartData = data.map(d => ({
    label: d.date ? format(parseISO(d.date), 'dd MMM') : d.date,
    value: d.value,
  }))

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={chartData} barCategoryGap="30%" margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#A8B3BC', fontFamily: 'var(--font-jetbrains-mono), monospace' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: '#A8B3BC', fontFamily: 'var(--font-jetbrains-mono), monospace' }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip cursor={false} content={(props) => (
          <CustomTooltip
            active={props.active}
            payload={props.payload as unknown as Array<{ value: number }>}
            label={props.label as string}
          />
        )} />
        <Bar dataKey="value" radius={[2, 2, 0, 0]}>
          {chartData.map((entry, i) => {
            const v = entry.value
            // Lower is better. Apple Watch counts micro-arousals — 7-12 is typical.
            const color = v == null ? 'transparent' : v <= 7 ? '#55606C' : v <= 12 ? '#FFB000' : '#E5173F'
            return <Cell key={i} fill={color} />
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
