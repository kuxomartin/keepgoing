'use client'

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts'

export interface ChartPoint {
  period: string
  label: string
  load: number         // bar height
  count: number        // activity count, tooltip only
  totalMinutes: number // total duration, tooltip only
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const CustomTooltip = ({ active, payload }: {
  active?: boolean; payload?: Array<{ value: number; payload: ChartPoint }>
}) => {
  if (!active || !payload?.[0]) return null
  const { label, load, count, totalMinutes } = payload[0].payload
  if (load === 0 && count === 0) return null
  return (
    <div className="bg-[#20252B] border border-white/10 text-xs px-3 py-2 rounded-sm min-w-[140px]">
      <p className="font-mono text-white/50 mb-1.5">{label}</p>
      {load > 0 && (
        <p className="font-mono text-white mb-0.5">Load: <span className="font-bold">{Math.round(load)}</span></p>
      )}
      <p className="font-mono text-white/40">
        {count} {count === 1 ? 'activity' : 'activities'}
        {totalMinutes > 0 && ` · ${fmtDuration(totalMinutes)}`}
      </p>
    </div>
  )
}

export function ActivityFrequencyChart({
  data,
  weeklyGoal = 3,
  isDaily = false,
  onBarClick,
  selectedPeriod,
}: {
  data: ChartPoint[]
  weeklyGoal?: number
  isDaily?: boolean
  onBarClick?: (period: string) => void
  selectedPeriod?: string | null
}) {
  if (!data.length) return null

  const barGap = data.length > 30 ? '15%' : data.length > 14 ? '20%' : '28%'

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart
        data={data}
        barCategoryGap={barGap}
        margin={{ top: 4, right: 0, left: -32, bottom: 0 }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onClick={onBarClick ? (chartData: any) => {
          if (chartData?.activePayload?.[0]) {
            const item = chartData.activePayload[0].payload as ChartPoint
            onBarClick(item.period)
          }
        } : undefined}
        style={onBarClick ? { cursor: 'pointer' } : undefined}
      >
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
          tickLine={false} axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
          tickLine={false} axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={false}
          content={(props) => (
            <CustomTooltip
              active={props.active}
              payload={props.payload as unknown as Array<{ value: number; payload: ChartPoint }>}
            />
          )}
        />
        <Bar dataKey="load" radius={[2, 2, 0, 0]}>
          {data.map((entry, i) => {
            const isSelected = selectedPeriod === entry.period
            // Daily: any load = orange; weekly: count >= goal = orange
            const active = isDaily ? entry.load > 0 : entry.count >= weeklyGoal
            const baseColor = active ? '#FF7A00' : 'rgba(255,255,255,0.08)'
            const color = isSelected ? '#FFFFFF' : baseColor
            return (
              <Cell
                key={i}
                fill={color}
                opacity={selectedPeriod && !isSelected ? 0.35 : 1}
              />
            )
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
