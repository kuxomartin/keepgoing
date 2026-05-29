export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { StatCard } from '@/components/ui/stat-card'
import { RecommendationCard } from '@/components/dashboard/recommendation-card'
import { DailyCheckinForm } from '@/components/dashboard/daily-checkin-form'
import { QuickAddWeight } from '@/components/dashboard/quick-add-weight'
import { QuickAddFood } from '@/components/dashboard/quick-add-food'
import { QuickAddActivity } from '@/components/dashboard/quick-add-activity'
import { DailySummaryCard } from '@/components/dashboard/daily-summary-card'
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

  const [
    { data: metricsRaw },
    { data: weightsRaw },
    { data: foodRaw },
    { data: recentEnergyRaw },
    { data: activitiesRaw },
    { data: checkinRaw },
    { data: weights7dRaw },
  ] = await Promise.all([
    // Today's health metrics
    supabase
      .from('health_metrics')
      .select('*')
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(1),
    // Latest weight
    supabase
      .from('weight_logs')
      .select('*')
      .order('date', { ascending: false })
      .limit(1),
    // Today's food logs (calories + protein)
    supabase
      .from('food_logs')
      .select('estimated_calories, protein_g')
      .eq('date', today),
    // Most-recent row with actual energy data — fallback when today has no metrics
    supabase
      .from('health_metrics')
      .select('date, active_energy_kcal, resting_energy_kcal')
      .not('active_energy_kcal', 'is', null)
      .order('date', { ascending: false })
      .limit(1),
    // Today's activities
    supabase
      .from('activities')
      .select('duration_minutes')
      .gte('start_time', today + 'T00:00:00')
      .lte('start_time', today + 'T23:59:59'),
    // Today's check-in
    supabase
      .from('daily_checkins')
      .select('energy, stress, soreness')
      .eq('date', today)
      .limit(1),
    // Last 7 weight logs for 7-day average
    supabase
      .from('weight_logs')
      .select('weight_kg')
      .order('date', { ascending: false })
      .limit(7),
  ])

  // ── Existing mock-fallback for StatCards + RecommendationCard ─────────────
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

  // ── Real-data-only values for DailySummaryCard ────────────────────────────
  const realMetrics = metricsRaw?.[0] as HealthMetrics | null ?? null

  // Energy: prefer today's real metrics, fall back to most-recent available
  const todayHasEnergy =
    realMetrics?.active_energy_kcal != null || realMetrics?.resting_energy_kcal != null
  const energyRow = todayHasEnergy ? realMetrics : (recentEnergyRaw?.[0] ?? null)
  const energyFallbackDate = !todayHasEnergy && energyRow ? (energyRow.date as string) : null
  const activeEnergy  = energyRow?.active_energy_kcal  ?? null
  const restingEnergy = energyRow?.resting_energy_kcal ?? null

  // Food
  const consumed = foodRaw?.length
    ? foodRaw.reduce((sum, f) => sum + (f.estimated_calories ?? 0), 0)
    : null
  const protein = foodRaw?.some(f => f.protein_g != null)
    ? foodRaw.reduce((sum, f) => sum + (f.protein_g ?? 0), 0)
    : null

  // Activities
  const activityCount   = activitiesRaw?.length ?? 0
  const activityMinutes = activitiesRaw?.reduce((sum, a) => sum + (a.duration_minutes ?? 0), 0) ?? 0

  // Check-in
  const checkinData = checkinRaw?.[0] ?? null

  // 7-day weight average
  const avgWeight7d =
    weights7dRaw && weights7dRaw.length >= 2
      ? weights7dRaw.reduce((sum, w) => sum + w.weight_kg, 0) / weights7dRaw.length
      : null

  // Recovery from real data only (null if no real metrics today)
  const realRecovery = realMetrics ? getRecoveryScore(realMetrics) : null

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

      {/* Recovery recommendation */}
      <RecommendationCard recovery={recovery} />

      {/* Daily summary — real data only, graceful missing states */}
      <DailySummaryCard
        consumed={consumed}
        protein={protein}
        activeEnergy={activeEnergy}
        restingEnergy={restingEnergy}
        energyFallbackDate={energyFallbackDate}
        recovery={realRecovery}
        hrv={realMetrics?.hrv_ms ?? null}
        restingHr={realMetrics?.resting_hr ?? null}
        sleepHours={realMetrics?.sleep_minutes != null ? realMetrics.sleep_minutes / 60 : null}
        steps={realMetrics?.steps ?? null}
        activityCount={activityCount}
        activityMinutes={activityMinutes}
        latestWeight={weightsRaw?.[0]?.weight_kg ?? null}
        avgWeight7d={avgWeight7d}
        checkin={checkinData}
      />

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
