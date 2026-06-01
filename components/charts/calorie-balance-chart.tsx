'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

export interface DayBalance {
  date: string      // 'MMM d'
  consumed: number | null
  burned: number | null
  balance: number | null
}

interface Props {
  data: DayBalance[]
}

const fmt = (v: number | null) => (v == null ? '—' : `${v.toLocaleString()} kcal`)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#D9D9D9] px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-[#0D0D0D] mb-1">{label}</p>
      {payload.map((p: { name: string; value: number | null; color: string }) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 flex-shrink-0" style={{ background: p.color }} />
          <span className="text-[#888888] capitalize">{p.name}:</span>
          <span className="font-medium text-[#0D0D0D]">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function CalorieBalanceChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#888888' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#888888' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${Math.round(v / 100) * 100}`}
          width={45}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#D9D9D9" strokeWidth={1.5} />

        <Bar dataKey="consumed" name="consumed" fill="#0D0D0D" opacity={0.7} radius={[2, 2, 0, 0]} />
        <Bar dataKey="burned"   name="burned"   fill="#888888" opacity={0.5} radius={[2, 2, 0, 0]} />
        <Line
          dataKey="balance"
          name="balance"
          stroke="#E5173F"
          strokeWidth={1.5}
          dot={{ r: 2, fill: '#E5173F' }}
          connectNulls
          type="monotone"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
