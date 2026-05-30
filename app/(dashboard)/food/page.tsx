export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'
import { DateNavStrip } from '@/components/food/date-nav-strip'
import type { FoodLog, MealType, CoffeeLog } from '@/types/database'
import { cn } from '@/lib/utils'
import { coffeeLabel } from '@/lib/coffee/types'

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

  const logs: FoodLog[]         = rawLogs    ? (rawLogs    as FoodLog[])    : []
  const coffeeLogs: CoffeeLog[] = coffeeRaw  ? (coffeeRaw as CoffeeLog[])  : []

  const totalCalories = logs.reduce((sum, f) => sum + (f.estimated_calories ?? 0), 0)
  const totalProtein  = logs.reduce((sum, f) => sum + (f.protein_g  ?? 0), 0)
  const totalCarbs    = logs.reduce((sum, f) => sum + (f.carbs_g    ?? 0), 0)
  const totalFat      = logs.reduce((sum, f) => sum + (f.fat_g      ?? 0), 0)

  const totalCoffeeCups    = coffeeLogs.reduce((s, l) => s + Number(l.cups), 0)
  const totalCoffeeMg      = coffeeLogs.reduce((s, l) => s + (l.caffeine_mg ?? 0), 0)
  const lastCoffeeLog      = coffeeLogs.length > 0 ? coffeeLogs[coffeeLogs.length - 1] : null
  const lastCoffeeTime     = lastCoffeeLog ? format(new Date(lastCoffeeLog.consumed_at), 'HH:mm') : null

  const grouped = MEAL_ORDER.reduce((acc, meal) => {
    const items = logs.filter((f) => f.meal_type === meal)
    if (items.length > 0) acc[meal] = items
    return acc
  }, {} as Partial<Record<MealType, FoodLog[]>>)

  const hasFood   = logs.length > 0
  const hasCoffee = coffeeLogs.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Food Log</p>
        <Link
          href="/food/add"
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Meal
        </Link>
      </div>

      {/* Date navigation */}
      <DateNavStrip selectedDate={selectedDate} />

      {/* ── DAILY TOTAL — prominent hero section ────────────────────────────── */}
      {(hasFood || hasCoffee) && (
        <div className="space-y-3">
          {/* Calorie hero */}
          {hasFood && (
            <div className="flex items-end gap-3">
              <p className="text-5xl font-black text-gray-900 dark:text-zinc-50 tabular-nums leading-none">
                {totalCalories.toLocaleString()}
              </p>
              <p className="text-sm text-gray-400 dark:text-zinc-500 pb-1.5">kcal</p>
            </div>
          )}

          {/* Macros — inline chips */}
          {hasFood && (totalProtein > 0 || totalCarbs > 0 || totalFat > 0) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {totalProtein > 0 && (
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-blue-600 dark:text-blue-400 tabular-nums">{Math.round(totalProtein)}g</span>
                  <span className="text-xs text-gray-400 dark:text-zinc-500">protein</span>
                </div>
              )}
              {totalCarbs > 0 && (
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-amber-500 dark:text-amber-400 tabular-nums">{Math.round(totalCarbs)}g</span>
                  <span className="text-xs text-gray-400 dark:text-zinc-500">carbs</span>
                </div>
              )}
              {totalFat > 0 && (
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-orange-500 dark:text-orange-400 tabular-nums">{Math.round(totalFat)}g</span>
                  <span className="text-xs text-gray-400 dark:text-zinc-500">fat</span>
                </div>
              )}
            </div>
          )}

          {/* Coffee — integrated as a compact chip row */}
          {hasCoffee && (
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-sm" aria-hidden>☕</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
                  {totalCoffeeCups % 1 === 0 ? totalCoffeeCups : totalCoffeeCups.toFixed(1)} cup{totalCoffeeCups !== 1 ? 's' : ''}
                </span>
                {totalCoffeeMg > 0 && (
                  <span className="text-sm text-gray-400 dark:text-zinc-500">{totalCoffeeMg}mg caffeine</span>
                )}
                {lastCoffeeTime && (
                  <span className="text-xs text-gray-400 dark:text-zinc-500">· last {lastCoffeeTime}</span>
                )}
              </div>
              <Link
                href={`/coffee/add?date=${selectedDate}&from=food`}
                className="text-xs font-medium text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
              >
                + Add
              </Link>
            </div>
          )}

          {/* Coffee log detail — compact, only when logged */}
          {hasCoffee && coffeeLogs.length > 1 && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {coffeeLogs.map(l => (
                <Link
                  key={l.id}
                  href={`/coffee/${l.id}/edit`}
                  className="text-xs text-gray-400 dark:text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                >
                  {coffeeLabel(l.coffee_type)}{Number(l.cups) !== 1 ? ` ×${l.cups}` : ''} · {format(new Date(l.consumed_at), 'HH:mm')}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Coffee add shortcut — when no coffee yet */}
      {!hasCoffee && (
        <Link
          href={`/coffee/add?date=${selectedDate}&from=food`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 dark:text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
        >
          <span aria-hidden>☕</span>
          Log coffee
        </Link>
      )}

      {/* ── MEALS ───────────────────────────────────────────────────────────── */}
      {Object.keys(grouped).length === 0 && !hasCoffee ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-sm text-gray-400 dark:text-zinc-500">No meals logged for this day.</p>
          <Link href="/food/add"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add first meal
          </Link>
        </div>
      ) : (
        <div className="space-y-7">
          {MEAL_ORDER.filter(meal => grouped[meal]).map(meal => {
            const items = grouped[meal]!
            const mealKcal = items.reduce((s, f) => s + (f.estimated_calories ?? 0), 0)
            return (
              <div key={meal}>
                {/* Section label */}
                <div className="flex items-baseline gap-2.5 mb-3">
                  <span className="text-base font-bold text-gray-900 dark:text-zinc-100">
                    {MEAL_LABELS[meal]}
                  </span>
                  {mealKcal > 0 && (
                    <span className="text-sm text-gray-400 dark:text-zinc-500 tabular-nums">{mealKcal} kcal</span>
                  )}
                </div>

                {/* Food item rows — generously spaced */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
                  <ul className="divide-y divide-gray-50 dark:divide-zinc-800">
                    {items.map((f) => {
                      const timeStr = fmtTime(f)
                      return (
                        <li key={f.id} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0 space-y-1">
                              {/* Time + description */}
                              <div className="flex items-center gap-2">
                                {timeStr && (
                                  <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono flex-shrink-0 tabular-nums">{timeStr}</span>
                                )}
                                <p className="text-base font-medium text-gray-900 dark:text-zinc-100 leading-snug">{f.description}</p>
                              </div>

                              {/* Macros — compact secondary */}
                              {(f.protein_g || f.carbs_g || f.fat_g) && (
                                <p className="text-xs text-gray-400 dark:text-zinc-500 tabular-nums">
                                  {[
                                    f.protein_g ? `P ${f.protein_g}g` : null,
                                    f.carbs_g   ? `C ${f.carbs_g}g`   : null,
                                    f.fat_g     ? `F ${f.fat_g}g`     : null,
                                  ].filter(Boolean).join(' · ')}
                                </p>
                              )}

                              {/* Digestion note */}
                              {f.digestion_note && (
                                <p className="text-xs text-gray-400 dark:text-zinc-500 italic">{f.digestion_note}</p>
                              )}
                            </div>

                            {/* Calories + edit */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {f.estimated_calories ? (
                                <span className="text-base font-bold text-gray-700 dark:text-zinc-200 tabular-nums">
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

          {/* Add another meal */}
          <Link href="/food/add"
            className="flex items-center gap-2 px-1 py-2 text-sm text-gray-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add another meal
          </Link>
        </div>
      )}
    </div>
  )
}
