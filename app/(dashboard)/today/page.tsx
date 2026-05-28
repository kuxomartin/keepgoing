export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { StatCard } from '@/components/ui/stat-card'
import { RecommendationCard } from '@/components/dashboard/recommendation-card'
import { DailyCheckinForm } from '@/components/dashboard/daily-checkin-form'
import { QuickAddWeight } from '@/components/dashboard/quick-add-weight'
import { QuickAddFood } from '@/components/dashboard/quick-add-food'
import { QuickAddActivity } from '@/components/dashboard/quick-add-activity'
import { getRecoveryScore } from '@/lib/calculations/recovery-score'
import { mockHealthMetrics, mockWeightLogs } from '@/lib/mock-data/demo-data'
import type { HealthMetrics, WeightLog } from '@/types/database'
import Link from 'next/link'
import { Scale, Moon, Heart, Zap, UtensilsCrossed } from 'lucide-react'
import { QuickActionsPanel } from '@/components/dashboard/quick-actions-panel'

export default async function TodayPage() {
  const supabase = await createClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const longDate = format(new Date(), 'EEEE, d MMMM yyyy')

  // Fetch real data
  const [{ data: metricsRaw }, { data: weightsRaw }] = await Promise.all([
    supabase
      .from('health_metrics')
      .select('*')
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('weight_logs')
      .select('*')
      .order('date', { ascending: false })
      .limit(1),
  ])

  // Fallback to mock
  const todayMetrics: HealthMetrics | null =
    metricsRaw && metricsRaw.length > 0
      ? (metricsRaw[0] as HealthMetrics)
      : (mockHealthMetrics.find((m) => m.date === today) ?? mockHealthMetrics[0])

  const latestWeight: WeightLog | null =
    weightsRaw && weightsRaw.length > 0
      ? (weightsRaw[0] as WeightLog)
      : mockWeightLogs[0]

  const recovery = getRecoveryScore(todayMetrics)

  const sleepHours = todayMetrics?.sleep_minutes
    ? (todayMetrics.sleep_minutes / 60).toFixed(1)
    : null

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{longDate}</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-0.5">Today</h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Weight"
          value={latestWeight ? latestWeight.weight_kg.toFixed(1) : '—'}
          unit={latestWeight ? 'kg' : ''}
          subtitle={latestWeight ? `Last: ${latestWeight.date}` : 'Not logged yet'}
          icon={<Scale className="h-5 w-5" />}
        />
        <StatCard
          label="Sleep"
          value={sleepHours ?? '—'}
          unit={sleepHours ? 'h' : ''}
          subtitle={todayMetrics?.deep_sleep_minutes
            ? `${Math.round(todayMetrics.deep_sleep_minutes / 60 * 10) / 10}h deep`
            : undefined}
          status={sleepHours
            ? (parseFloat(sleepHours) >= 7 ? 'green' : parseFloat(sleepHours) >= 6 ? 'yellow' : 'red')
            : 'neutral'}
          icon={<Moon className="h-5 w-5" />}
        />
        <StatCard
          label="Resting HR"
          value={todayMetrics?.resting_hr ?? '—'}
          unit={todayMetrics?.resting_hr ? 'bpm' : ''}
          status={todayMetrics?.resting_hr
            ? (todayMetrics.resting_hr <= 55 ? 'green' : todayMetrics.resting_hr <= 65 ? 'yellow' : 'red')
            : 'neutral'}
          icon={<Heart className="h-5 w-5" />}
        />
        <StatCard
          label="HRV"
          value={todayMetrics?.hrv_ms != null ? Math.round(Number(todayMetrics.hrv_ms)) : '—'}
          unit={todayMetrics?.hrv_ms != null ? 'ms' : ''}
          status={todayMetrics?.hrv_ms != null
            ? (Number(todayMetrics.hrv_ms) >= 55 ? 'green' : Number(todayMetrics.hrv_ms) >= 40 ? 'yellow' : 'red')
            : 'neutral'}
          icon={<Zap className="h-5 w-5" />}
        />
      </div>

      {/* Recommendation */}
      <RecommendationCard recovery={recovery} />

      {/* Mobile: prominent "Add Meal" shortcut + quick action strip */}
      <Link
        href="/food/add?from=today"
        className="lg:hidden flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm hover:border-blue-200 hover:shadow-md transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            <UtensilsCrossed className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Log a meal</p>
            <p className="text-xs text-gray-400">Tap to add food</p>
          </div>
        </div>
        <span className="text-blue-600 font-semibold text-lg">+</span>
      </Link>

      <QuickActionsPanel />

      {/* Daily check-in */}
      <DailyCheckinForm />

      {/* Desktop: quick-add cards (hidden on mobile — handled by QuickActionsPanel) */}
      <div className="hidden lg:grid grid-cols-3 gap-4">
        <QuickAddWeight />
        <QuickAddFood />
        <QuickAddActivity />
      </div>
    </div>
  )
}
