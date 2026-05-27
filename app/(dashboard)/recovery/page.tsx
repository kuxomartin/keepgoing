export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SleepChart } from '@/components/charts/sleep-chart'
import { HrvChart } from '@/components/charts/hrv-chart'
import { RestingHrChart } from '@/components/charts/resting-hr-chart'
import { getRecoveryScore } from '@/lib/calculations/recovery-score'
import { sevenDayAverage } from '@/lib/calculations/weekly-totals'
import { mockHealthMetrics } from '@/lib/mock-data/demo-data'
import type { HealthMetrics } from '@/types/database'
import { Moon, Heart, Zap, Footprints, AlertCircle, CheckCircle } from 'lucide-react'

// Priority order for deduplicating same-date rows from multiple sources
const SOURCE_PRIORITY = ['google_sheets', 'apple_health_export', 'manual', 'mock']

function deduplicateByDate(metrics: HealthMetrics[]): HealthMetrics[] {
  const byDate = new Map<string, HealthMetrics>()
  for (const m of metrics) {
    const existing = byDate.get(m.date)
    if (!existing) {
      byDate.set(m.date, m)
    } else {
      const existingPrio = SOURCE_PRIORITY.indexOf(existing.source)
      const newPrio = SOURCE_PRIORITY.indexOf(m.source)
      if (newPrio < existingPrio) byDate.set(m.date, m)
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export default async function RecoveryPage() {
  const supabase = await createClient()

  const today = format(new Date(), 'yyyy-MM-dd')
  const fourteenDaysAgo = format(new Date(Date.now() - 14 * 86400000), 'yyyy-MM-dd')

  const { data: rawMetrics } = await supabase
    .from('health_metrics')
    .select('*')
    .gte('date', fourteenDaysAgo)
    .lte('date', today)
    .order('date', { ascending: true })

  // Use real data if available, otherwise fall back to mock
  const metrics: HealthMetrics[] =
    rawMetrics && rawMetrics.length > 0
      ? deduplicateByDate(rawMetrics as HealthMetrics[])
      : mockHealthMetrics.slice().sort((a, b) => a.date.localeCompare(b.date))

  const todayMetrics = metrics.find((m) => m.date === today) ?? metrics[metrics.length - 1] ?? null
  const recovery = getRecoveryScore(todayMetrics)

  // Chart data
  const sleepData = metrics.map((m) => ({
    date: m.date,
    hours: Math.round(((m.sleep_minutes ?? 0) / 60) * 10) / 10,
  }))

  const hrvData = metrics.map((m) => ({
    date: m.date,
    hrv: m.hrv_ms ? Math.round(Number(m.hrv_ms)) : null,
  }))

  const rhrData = metrics.map((m) => ({
    date: m.date,
    rhr: m.resting_hr,
  }))

  // 7-day averages for stats
  const avg7dSleep = sevenDayAverage(metrics.map((m) => m.sleep_minutes ? m.sleep_minutes / 60 : null))
  const avg7dHrv = sevenDayAverage(metrics.map((m) => m.hrv_ms ? Number(m.hrv_ms) : null))
  const avg7dRhr = sevenDayAverage(metrics.map((m) => m.resting_hr))

  const statusColor = recovery.status === 'green' ? 'green' : recovery.status === 'yellow' ? 'yellow' : 'red'
  const statusLabel = recovery.status === 'green' ? 'Well recovered' : recovery.status === 'yellow' ? 'Moderate recovery' : 'Low recovery'

  const isUsingMock = !rawMetrics || rawMetrics.length === 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recovery</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sleep, HRV, resting HR and readiness trends over the last 14 days.
        </p>
        {isUsingMock && (
          <p className="mt-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-block">
            Showing demo data — sync your Google Sheet in Settings to see real data
          </p>
        )}
      </div>

      {/* Recovery status banner */}
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${
        recovery.status === 'green'
          ? 'bg-green-50 border-green-200'
          : recovery.status === 'yellow'
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-red-50 border-red-200'
      }`}>
        {recovery.status === 'green' ? (
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
            recovery.status === 'yellow' ? 'text-yellow-600' : 'text-red-600'
          }`} />
        )}
        <div>
          <p className={`font-semibold text-sm ${
            recovery.status === 'green' ? 'text-green-800'
            : recovery.status === 'yellow' ? 'text-yellow-800'
            : 'text-red-800'
          }`}>
            {statusLabel} — Score {recovery.score}/100
          </p>
          {recovery.issues.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {recovery.issues.map((issue, i) => (
                <li key={i} className="text-xs text-gray-600">• {issue}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Sleep last night"
          value={todayMetrics?.sleep_minutes ? (todayMetrics.sleep_minutes / 60).toFixed(1) : '—'}
          unit={todayMetrics?.sleep_minutes ? 'h' : ''}
          subtitle={avg7dSleep ? `7d avg: ${avg7dSleep}h` : undefined}
          status={todayMetrics?.sleep_minutes
            ? (todayMetrics.sleep_minutes / 60 >= 7 ? 'green' : todayMetrics.sleep_minutes / 60 >= 6 ? 'yellow' : 'red')
            : 'neutral'}
          icon={<Moon className="h-5 w-5" />}
        />
        <StatCard
          label="HRV"
          value={todayMetrics?.hrv_ms != null ? Math.round(Number(todayMetrics.hrv_ms)) : '—'}
          unit={todayMetrics?.hrv_ms != null ? 'ms' : ''}
          subtitle={avg7dHrv ? `7d avg: ${avg7dHrv} ms` : undefined}
          status={todayMetrics?.hrv_ms != null
            ? (Number(todayMetrics.hrv_ms) >= 55 ? 'green' : Number(todayMetrics.hrv_ms) >= 40 ? 'yellow' : 'red')
            : 'neutral'}
          icon={<Zap className="h-5 w-5" />}
        />
        <StatCard
          label="Resting HR"
          value={todayMetrics?.resting_hr ?? '—'}
          unit={todayMetrics?.resting_hr ? 'bpm' : ''}
          subtitle={avg7dRhr ? `7d avg: ${avg7dRhr} bpm` : undefined}
          status={todayMetrics?.resting_hr
            ? (todayMetrics.resting_hr <= 55 ? 'green' : todayMetrics.resting_hr <= 65 ? 'yellow' : 'red')
            : 'neutral'}
          icon={<Heart className="h-5 w-5" />}
        />
        <StatCard
          label="Steps today"
          value={todayMetrics?.steps ? todayMetrics.steps.toLocaleString() : '—'}
          subtitle={todayMetrics?.steps ? (todayMetrics.steps >= 10000 ? 'Target reached ✓' : `${10000 - todayMetrics.steps} to go`) : undefined}
          status={todayMetrics?.steps
            ? (todayMetrics.steps >= 10000 ? 'green' : todayMetrics.steps >= 6000 ? 'yellow' : 'neutral')
            : 'neutral'}
          icon={<Footprints className="h-5 w-5" />}
        />
      </div>

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Sleep — last 14 days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" /> ≥ 7h</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> 6–7h</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> &lt; 6h</span>
            <span className="text-blue-400">— 7h target</span>
          </div>
          <SleepChart data={sleepData} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>HRV trend</CardTitle>
          </CardHeader>
          <CardContent>
            <HrvChart data={hrvData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Resting HR trend</CardTitle>
          </CardHeader>
          <CardContent>
            <RestingHrChart data={rhrData} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
