'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface DataPoint { date: string; value: number | null }

interface Props {
  data: DataPoint[]
  unit?: string
  goodThreshold?: number
  higherIsBetter?: boolean
  chartHeight?: number
}

const CustomTooltip = ({ active, payload, label, unit }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string; unit: string
}) => {
  if (!active || !payload?.[0]) return null
  const val = payload[0].value
  if (val == null) return null
  return (
    <div className="bg-[#0D0D0D] border border-white/10 text-xs px-2.5 py-1.5 rounded-sm">
      <span className="text-white/50">{label} · </span>
      {Math.round(val)}{unit}
    </div>
  )
}

export function SleepEfficiencyChart({
  data, unit = '%', goodThreshold = 85, higherIsBetter = true, chartHeight = 200,
}: Props) {
  const hasData = data.some(d => d.value != null)
  if (!hasData) return <p className="text-sm text-[#888888] py-4">No data</p>

  const nonNull = data.filter(d => d.value != null).map(d => d.value!)
  const minVal  = Math.min(...nonNull)
  const maxVal  = Math.max(...nonNull)
  // Pad domain so bars aren't at the very edge
  const domainMin = Math.max(0, Math.floor(minVal * 0.95))
  const domainMax = Math.ceil(maxVal * 1.02)

  const chartData = data.map(d => ({
    label: d.date ? format(parseISO(d.date), 'dd MMM') : d.date,
    value: d.value,
  }))

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={chartData} barCategoryGap="30%" margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#888888' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[domainMin, domainMax]}
          tick={{ fontSize: 10, fill: '#888888' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => `${Math.round(v)}${unit}`}
          tickCount={4}
          width={38}
        />
        <Tooltip content={(props) => (
          <CustomTooltip
            active={props.active}
            payload={props.payload as unknown as Array<{ value: number }>}
            label={props.label as string}
            unit={unit}
          />
        )} />
        {goodThreshold >= domainMin && goodThreshold <= domainMax && (
          <ReferenceLine y={goodThreshold} stroke="#D9D9D9" strokeDasharray="3 3" strokeWidth={1} />
        )}
        <Bar dataKey="value" radius={[2, 2, 0, 0]}>
          {chartData.map((entry, i) => {
            const v = entry.value
            const color = v == null
              ? 'transparent'
              : higherIsBetter
                ? v >= goodThreshold       ? '#0D0D0D'
                  : v >= goodThreshold - 10 ? '#FFB000'
                  :                          '#E5173F'
                : v <= goodThreshold       ? '#0D0D0D'
                  : v <= goodThreshold + 3  ? '#FFB000'
                  :                          '#E5173F'
            return <Cell key={i} fill={color} />
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
