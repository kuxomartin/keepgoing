export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'
import { CoffeeSummaryCard } from '@/components/coffee/coffee-summary-card'
import { DateNavStrip } from '@/components/food/date-nav-strip'
import type { FoodLog, MealType, CoffeeLog } from '@/types/database'
import { cn } from '@/lib/utils'

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'other']
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', other: 'Other',
}

interface PageProps { searchParams: Promise<{ date?: string }> }

function fmtTime(log: FoodLog): string | null {
  if (log.eaten_at) {
    try { return format(new Date(log.eaten_at), 'HH:mm') } catch { return null }
  }
  return null
}

export default async function FoodPage({ searchParams }: PageProps) {
  const { date: dateParam } = await searchParams
  const selectedDate = dateParam || format(new Date(), 'yyyy-MM-dd')
  const supabase = await createClient()

  const [{ data: rawLogs }, { data: coffeeRaw }] = await Promise.all([
    supabase.from('food_logs').select('*').eq('date', selectedDate)
      .order('eaten_at', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('coffee_logs').select('*').eq('date', selectedDate)
      .order('consumed_at', { ascending: true }),
  ])

  const logs: FoodLog[]     = rawLogs    ? (rawLogs    as FoodLog[])    : []
  const coffeeLogs: CoffeeLog[] = coffeeRaw ? (coffeeRaw as CoffeeLog[]) : []

  const totalCalories = logs.reduce((sum, f) => sum + (f.estimated_calories ?? 0), 0)
  const totalProtein  = logs.reduce((sum, f) => sum + (f.protein_g  ?? 0), 0)
  const totalCarbs    = logs.reduce((sum, f) => sum + (f.carbs_g    ?? 0), 0)
  const totalFat      = logs.reduce((sum, f) => sum + (f.fat_g      ?? 0), 0)

  const grouped = MEAL_ORDER.reduce((acc, meal) => {
    const items = logs.filter((f) => f.meal_type === meal)
    if (items.length > 0) acc[meal] = items
    return acc
  }, {} as Partial<Record<MealType, FoodLog[]>>)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-50">Food Log</h1>
        <Link
          href="/food/add"
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Meal
        </Link>
      </div>

      {/* Date navigation */}
      <DateNavStrip selectedDate={selectedDate} />

      {/* Coffee summary */}
      <CoffeeSummaryCard logs={coffeeLogs} date={selectedDate} />

      {/* Daily totals — inline, no card */}
      {logs.length > 0 && (
        <div className="flex items-center gap-4 px-1 py-2 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900 dark:text-zinc-50">{totalCalories}</span>
            <span className="text-xs text-gray-400 dark:text-zinc-500">kcal</span>
          </div>
          <span className="text-gray-200 dark:text-zinc-700">·</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">{Math.round(totalProtein)}g</span>
            <span className="text-xs text-gray-400 dark:text-zinc-500">protein</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold text-amber-500 dark:text-amber-400">{Math.round(totalCarbs)}g</span>
            <span className="text-xs text-gray-400 dark:text-zinc-500">carbs</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold text-orange-500 dark:text-orange-400">{Math.round(totalFat)}g</span>
            <span className="text-xs text-gray-400 dark:text-zinc-500">fat</span>
          </div>
        </div>
      )}

      {/* Meals — section headers + list rows, no card boxes */}
      {Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-sm text-gray-400 dark:text-zinc-500">No meals logged for this day.</p>
          <Link href="/food/add"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add first meal
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {MEAL_ORDER.filter(meal => grouped[meal]).map(meal => {
            const items = grouped[meal]!
            const mealKcal = items.reduce((s, f) => s + (f.estimated_calories ?? 0), 0)
            return (
              <div key={meal}>
                {/* Section header — no card, just a labelled rule */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold text-gray-900 dark:text-zinc-100 uppercase tracking-widest">
                    {MEAL_LABELS[meal]}
                  </span>
                  {mealKcal > 0 && (
                    <span className="text-xs text-gray-400 dark:text-zinc-500">{mealKcal} kcal</span>
                  )}
                </div>

                {/* Food item rows on white/dark-surface, no outer border */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
                  <ul className="divide-y divide-gray-50 dark:divide-zinc-800">
                    {items.map((f) => {
                      const timeStr = fmtTime(f)
                      return (
                        <li key={f.id} className="px-5 py-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {timeStr && (
                                  <span className="text-[11px] text-gray-400 dark:text-zinc-500 font-mono flex-shrink-0 tabular-nums">
                                    {timeStr}
                                  </span>
                                )}
                                <p className="text-sm text-gray-900 dark:text-zinc-100 truncate">{f.description}</p>
                              </div>
                              {(f.protein_g || f.carbs_g || f.fat_g) && (
                                <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5 tabular-nums">
                                  {f.protein_g ? `P ${f.protein_g}g` : ''}
                                  {f.protein_g && (f.carbs_g || f.fat_g) ? ' · ' : ''}
                                  {f.carbs_g ? `C ${f.carbs_g}g` : ''}
                                  {f.carbs_g && f.fat_g ? ' · ' : ''}
                                  {f.fat_g ? `F ${f.fat_g}g` : ''}
                                </p>
                              )}
                              {f.digestion_note && (
                                <p className="text-[11px] text-gray-400 dark:text-zinc-500 italic mt-0.5">{f.digestion_note}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2.5 flex-shrink-0">
                              {f.estimated_calories ? (
                                <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200 tabular-nums">
                                  {f.estimated_calories}
                                </span>
                              ) : null}
                              <Link
                                href={`/food/${f.id}/edit`}
                                className="p-1.5 rounded-lg text-gray-300 dark:text-zinc-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            )
          })}

          {/* Quick add for missing meals */}
          <Link href="/food/add"
            className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add another meal
          </Link>
        </div>
      )}
    </div>
  )
}
