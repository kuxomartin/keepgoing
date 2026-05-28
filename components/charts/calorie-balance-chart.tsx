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
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: { name: string; value: number | null; color: string }) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-500 capitalize">{p.name}:</span>
          <span className="font-medium text-gray-800">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function CalorieBalanceChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${Math.round(v / 100) * 100}`}
          width={45}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}
        />
        <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1.5} />

        <Bar dataKey="consumed" name="consumed" fill="#3b82f6" opacity={0.8} radius={[3, 3, 0, 0]} />
        <Bar dataKey="burned"   name="burned"   fill="#10b981" opacity={0.8} radius={[3, 3, 0, 0]} />
        <Line
          dataKey="balance"
          name="balance"
          stroke="#f97316"
          strokeWidth={2}
          dot={{ r: 3, fill: '#f97316' }}
          connectNulls
          type="monotone"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
