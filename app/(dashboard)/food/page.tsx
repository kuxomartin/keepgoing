export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { DateNavStrip } from '@/components/food/date-nav-strip'
import type { FoodLog, CoffeeLog } from '@/types/database'
import { coffeeLabel } from '@/lib/coffee/types'

interface PageProps { searchParams: Promise<{ date?: string }> }

// ── Unified timeline entry ────────────────────────────────────────────────────
type TimelineEntry =
  | { type: 'food';   time: Date | null; food: FoodLog   }
  | { type: 'coffee'; time: Date | null; coffee: CoffeeLog }

function fmtTime(d: Date | null): string | null {
  if (!d) return null
  try { return format(d, 'HH:mm') } catch { return null }
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

  const logs: FoodLog[]         = rawLogs   ? (rawLogs   as FoodLog[])   : []
  const coffeeLogs: CoffeeLog[] = coffeeRaw ? (coffeeRaw as CoffeeLog[]) : []

  const totalCalories = logs.reduce((sum, f) => sum + (f.estimated_calories ?? 0), 0)
  const totalProtein  = logs.reduce((sum, f) => sum + (f.protein_g  ?? 0), 0)
  const totalCarbs    = logs.reduce((sum, f) => sum + (f.carbs_g    ?? 0), 0)
  const totalFat      = logs.reduce((sum, f) => sum + (f.fat_g      ?? 0), 0)
  const totalCoffeeMg = coffeeLogs.reduce((s, l) => s + (l.caffeine_mg ?? 0), 0)

  // ── Build unified chronological timeline ──────────────────────────────────
  const entries: TimelineEntry[] = [
    ...logs.map(f => ({
      type: 'food' as const,
      time: f.eaten_at ? new Date(f.eaten_at) : null,
      food: f,
    })),
    ...coffeeLogs.map(c => ({
      type: 'coffee' as const,
      time: c.consumed_at ? new Date(c.consumed_at) : null,
      coffee: c,
    })),
  ].sort((a, b) => {
    if (!a.time && !b.time) return 0
    if (!a.time) return 1
    if (!b.time) return -1
    return a.time.getTime() - b.time.getTime()
  })

  const hasEntries = entries.length > 0

  return (
    <div className="flex flex-col">

      {/* ── HERO — calorie total on warm stone ─────────────────────────── */}
      <div className="bg-[#F2EDE6] dark:bg-zinc-900 px-6 sm:px-10 lg:px-14 py-10">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            {totalCalories > 0 ? (
              <>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-display font-bold text-[#0D0D0D] dark:text-zinc-50 tabular-nums leading-none"
                        style={{ fontSize: '5rem' }}>
                    {totalCalories.toLocaleString()}
                  </span>
                  <span className="text-lg text-[#888888]">kcal today</span>
                </div>
                {(totalProtein > 0 || totalCarbs > 0 || totalFat > 0) && (
                  <p className="text-sm text-[#888888]">
                    {totalProtein > 0 && `${Math.round(totalProtein)}g protein`}
                    {totalCarbs   > 0 && ` · ${Math.round(totalCarbs)}g carbs`}
                    {totalFat     > 0 && ` · ${Math.round(totalFat)}g fat`}
                  </p>
                )}
                {totalCoffeeMg > 0 && (
                  <p className="text-sm text-[#888888] mt-0.5">
                    ☕ {totalCoffeeMg}mg caffeine
                  </p>
                )}
              </>
            ) : (
              <p className="text-2xl font-medium text-[#888888]">Nothing logged yet.</p>
            )}
          </div>

          <Link
            href="/food/add"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#0D0D0D] dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold flex-shrink-0 hover:bg-[#333] dark:hover:bg-zinc-200 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Meal
          </Link>
        </div>

        {/* Date navigation */}
        <DateNavStrip selectedDate={selectedDate} />
      </div>

      {/* ── CHRONOLOGICAL TIMELINE ─────────────────────────────────────── */}
      <div className="flex-1 px-6 sm:px-10 lg:px-14 py-6">

        {!hasEntries ? (
          <div className="py-16 text-center">
            <p className="text-[#888888] text-base mb-6">No entries for this day.</p>
            <Link href="/food/add"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#0D0D0D] text-white text-sm font-semibold hover:bg-[#333] transition-colors">
              <Plus className="h-4 w-4" />
              Add first meal
            </Link>
          </div>
        ) : (
          <div>
            {entries.map((entry, i) => (
              <div key={i}>
                {/* Divider above every entry except first */}
                {i > 0 && <div className="border-t border-[#D9D9D9] dark:border-zinc-800" />}

                {entry.type === 'food' && (
                  <div className="py-5 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-4">
                        {/* Time */}
                        <span className="text-[11px] font-mono text-[#888888] flex-shrink-0 mt-0.5 w-10 tabular-nums">
                          {fmtTime(entry.time) ?? '—'}
                        </span>
                        <div className="flex-1 min-w-0">
                          {/* Description — primary */}
                          <p className="text-base text-[#0D0D0D] dark:text-zinc-100 leading-snug">
                            {entry.food.description}
                          </p>
                          {/* Macros — secondary */}
                          {(entry.food.protein_g || entry.food.carbs_g || entry.food.fat_g) && (
                            <p className="text-xs text-[#888888] mt-1 tabular-nums">
                              {[
                                entry.food.protein_g ? `P ${entry.food.protein_g}g` : null,
                                entry.food.carbs_g   ? `C ${entry.food.carbs_g}g`   : null,
                                entry.food.fat_g     ? `F ${entry.food.fat_g}g`     : null,
                              ].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {entry.food.digestion_note && (
                            <p className="text-xs text-[#888888] italic mt-0.5">{entry.food.digestion_note}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Calories + edit */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {entry.food.estimated_calories != null && (
                        <span className="text-base font-semibold text-[#0D0D0D] dark:text-zinc-200 tabular-nums">
                          {entry.food.estimated_calories}
                        </span>
                      )}
                      <Link
                        href={`/food/${entry.food.id}/edit`}
                        className="text-xs text-[#888888] hover:text-[#0D0D0D] dark:hover:text-zinc-100 transition-colors"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                )}

                {entry.type === 'coffee' && (
                  <div className="py-5 flex items-center gap-4">
                    <span className="text-[11px] font-mono text-[#888888] flex-shrink-0 w-10 tabular-nums">
                      {fmtTime(entry.time) ?? '—'}
                    </span>
                    <div className="flex-1">
                      <p className="text-base text-[#0D0D0D] dark:text-zinc-100">
                        <span className="mr-1.5">☕</span>
                        {coffeeLabel(entry.coffee.coffee_type)}
                        {Number(entry.coffee.cups) !== 1 && ` ×${entry.coffee.cups}`}
                      </p>
                      {entry.coffee.caffeine_mg != null && (
                        <p className="text-xs text-[#888888] mt-0.5">{entry.coffee.caffeine_mg}mg caffeine</p>
                      )}
                    </div>
                    <Link
                      href={`/coffee/${entry.coffee.id}/edit`}
                      className="text-xs text-[#888888] hover:text-[#0D0D0D] dark:hover:text-zinc-100 transition-colors flex-shrink-0"
                    >
                      Edit
                    </Link>
                  </div>
                )}
              </div>
            ))}

            {/* Add entry */}
            <div className="border-t border-[#D9D9D9] dark:border-zinc-800 pt-5 flex gap-4">
              <Link href="/food/add"
                className="flex items-center gap-2 text-sm text-[#888888] hover:text-[#0D0D0D] dark:hover:text-zinc-100 transition-colors">
                <Plus className="h-4 w-4" />
                Add meal
              </Link>
              <Link href={`/coffee/add?date=${selectedDate}&from=food`}
                className="flex items-center gap-2 text-sm text-[#888888] hover:text-[#0D0D0D] dark:hover:text-zinc-100 transition-colors">
                <span>☕</span>
                Log coffee
              </Link>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
