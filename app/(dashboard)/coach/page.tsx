export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { analyzeWeeklyPatterns } from '@/lib/insights/weekly-patterns'
import { mockActivities, mockHealthMetrics, mockWeightLogs, mockFoodLogs } from '@/lib/mock-data/demo-data'
import type { Activity, HealthMetrics, WeightLog, FoodLog } from '@/types/database'
import { Brain, TrendingDown, TrendingUp, Minus, Calendar, Flame, Moon, Apple } from 'lucide-react'

export default async function CoachPage() {
  const supabase = await createClient()

  const thisWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const thisWeekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  // Fetch this week's data
  const [
    { data: activitiesRaw },
    { data: metricsRaw },
    { data: weightsRaw },
    { data: foodsRaw },
  ] = await Promise.all([
    supabase.from('activities').select('*').gte('start_time', thisWeekStart + 'T00:00:00').lte('start_time', thisWeekEnd + 'T23:59:59'),
    supabase.from('health_metrics').select('*').gte('date', thisWeekStart).lte('date', thisWeekEnd),
    supabase.from('weight_logs').select('*').gte('date', thisWeekStart).lte('date', thisWeekEnd),
    supabase.from('food_logs').select('*').gte('date', thisWeekStart).lte('date', thisWeekEnd),
  ])

  const hasRealData =
    (activitiesRaw && activitiesRaw.length > 0) ||
    (metricsRaw && metricsRaw.length > 0)

  const activities: Activity[] = activitiesRaw?.length ? (activitiesRaw as Activity[]) : mockActivities
  const metrics: HealthMetrics[] = metricsRaw?.length ? (metricsRaw as HealthMetrics[]) : mockHealthMetrics
  const weights: WeightLog[] = weightsRaw?.length ? (weightsRaw as WeightLog[]) : mockWeightLogs.slice(0, 7)
  const foods: FoodLog[] = foodsRaw?.length ? (foodsRaw as FoodLog[]) : mockFoodLogs

  const patterns = analyzeWeeklyPatterns(activities, metrics, weights, foods)

  function WeightChangeIcon({ change }: { change: number | null }) {
    if (change === null) return <Minus className="h-4 w-4 text-gray-400" />
    if (change < 0) return <TrendingDown className="h-4 w-4 text-green-600" />
    if (change > 0.2) return <TrendingUp className="h-4 w-4 text-orange-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Coach</h1>
        <p className="mt-1 text-sm text-gray-500">
          Weekly patterns and insights for {format(new Date(thisWeekStart), 'd MMM')} – {format(new Date(thisWeekEnd), 'd MMM yyyy')}.
        </p>
        {!hasRealData && (
          <p className="mt-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-block">
            Showing demo data
          </p>
        )}
      </div>

      {/* Weekly report placeholder */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-600" />
            <CardTitle className="text-gray-900 normal-case text-sm font-semibold tracking-normal">
              Weekly Report
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600 leading-relaxed">
            <p className="font-medium text-gray-800 mb-2">This week at a glance</p>
            <ul className="space-y-1">
              <li>• <strong>{patterns.totalActivities}</strong> training sessions — <strong>{Math.round(patterns.totalTrainingMinutes / 60 * 10) / 10}h</strong> total</li>
              {patterns.avgSleepHours && (
                <li>• Average sleep: <strong>{patterns.avgSleepHours}h</strong></li>
              )}
              {patterns.avgHrv && (
                <li>• Average HRV: <strong>{patterns.avgHrv} ms</strong></li>
              )}
              {patterns.weightChange !== null && (
                <li>• Weight {patterns.weightChange > 0 ? 'up' : 'down'} <strong>{Math.abs(patterns.weightChange)} kg</strong></li>
              )}
              <li>• Food logged on <strong>{patterns.foodLogDays}</strong> of 7 days</li>
            </ul>
          </div>
          <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700">
            <strong>Coming soon:</strong> AI-powered weekly reports via OpenAI will analyse patterns across all your data and generate personalised coaching insights.
          </div>
        </CardContent>
      </Card>

      {/* Patterns */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">This week&apos;s patterns</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Flame className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Training volume</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {patterns.totalActivities} sessions · {Math.round(patterns.totalTrainingMinutes)}m
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {patterns.hardestActivity && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Hardest session</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {patterns.hardestActivity.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      Effort: {patterns.hardestActivity.perceived_effort}/10
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {patterns.bestSleepDay && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Moon className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Best sleep</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {patterns.bestSleepHours}h
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(patterns.bestSleepDay), 'EEE d MMM')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <WeightChangeIcon change={patterns.weightChange} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Weight change</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {patterns.weightChange !== null
                      ? `${patterns.weightChange > 0 ? '+' : ''}${patterns.weightChange} kg`
                      : 'No data'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Apple className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Food consistency</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {patterns.foodLogDays}/7 days logged
                  </p>
                  <p className="text-xs text-gray-400">
                    {patterns.foodLogDays >= 5 ? 'Great consistency' : patterns.foodLogDays >= 3 ? 'Room to improve' : 'Try to log more'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
