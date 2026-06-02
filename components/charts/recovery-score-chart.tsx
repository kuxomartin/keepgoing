'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { format, parseISO } from 'date-fns'

export interface RecoveryScorePoint {
  date: string
  score: number
}

function scoreColor(score: number) {
  if (score >= 70) return '#55606C'
  if (score >= 45) return '#FFB000'
  return '#E5173F'
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string
}) {
  if (!active || !payload?.[0]) return null
  return (
    <div className="bg-[#20252B] border border-white/10 px-3 py-2 text-xs">
      <p className="font-medium text-white">{label ? format(parseISO(label), 'EEE d MMM') : ''}</p>
      <p className="font-mono text-white/50">{payload[0].value} / 100</p>
    </div>
  )
}

export function RecoveryScoreChart({
  data,
  chartHeight = 180,
}: {
  data: RecoveryScorePoint[]
  chartHeight?: number
}) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-white/30"
        style={{ height: chartHeight }}
      >
        No recovery data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.06)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => format(parseISO(v), 'd MMM')}
          tick={{ fontSize: 11, fill: '#A8B3BC', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 45, 70, 100]}
          tick={{ fontSize: 11, fill: '#A8B3BC', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <ReferenceLine
          y={70}
          stroke="rgba(255,255,255,0.10)"
          strokeDasharray="4 4"
          strokeWidth={1}
        />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        <Bar dataKey="score" radius={[2, 2, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={scoreColor(entry.score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
