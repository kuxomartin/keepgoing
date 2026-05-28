export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { mockFoodLogs } from '@/lib/mock-data/demo-data'
import type { FoodLog, MealType } from '@/types/database'

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'other']
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', other: 'Other',
}

interface PageProps {
  searchParams: Promise<{ date?: string }>
}

export default async function FoodPage({ searchParams }: PageProps) {
  const { date: dateParam } = await searchParams
  const selectedDate = dateParam || format(new Date(), 'yyyy-MM-dd')

  const supabase = await createClient()

  const { data: rawLogs } = await supabase
    .from('food_logs')
    .select('*')
    .eq('date', selectedDate)
    .order('created_at', { ascending: true })

  const isUsingMock = !rawLogs || rawLogs.length === 0

  const logs: FoodLog[] =
    rawLogs && rawLogs.length > 0
      ? (rawLogs as FoodLog[])
      : mockFoodLogs.filter((f) => f.date === selectedDate || selectedDate === format(new Date(), 'yyyy-MM-dd'))

  // Daily totals
  const totalCalories = logs.reduce((sum, f) => sum + (f.estimated_calories ?? 0), 0)
  const totalProtein = logs.reduce((sum, f) => sum + (f.protein_g ?? 0), 0)
  const totalCarbs = logs.reduce((sum, f) => sum + (f.carbs_g ?? 0), 0)
  const totalFat = logs.reduce((sum, f) => sum + (f.fat_g ?? 0), 0)

  // Group by meal type
  const grouped = MEAL_ORDER.reduce((acc, meal) => {
    const items = logs.filter((f) => f.meal_type === meal)
    if (items.length > 0) acc[meal] = items
    return acc
  }, {} as Partial<Record<MealType, FoodLog[]>>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Food Log</h1>
          {isUsingMock && (
            <p className="mt-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-block">
              Showing demo data
            </p>
          )}
        </div>
        <Link
          href="/food/add"
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors flex-shrink-0 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add Meal
        </Link>
      </div>

      {/* Date picker */}
      <form className="flex items-center gap-3">
        <input
          type="date"
          name="date"
          defaultValue={selectedDate}
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-3 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Go
        </button>
        <span className="text-sm text-gray-500">
          {format(new Date(selectedDate + 'T12:00:00'), 'EEE, d MMM yyyy')}
        </span>
      </form>

      {/* Daily summary */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalCalories}</p>
                <p className="text-xs text-gray-500 mt-0.5">kcal</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{Math.round(totalProtein)}g</p>
                <p className="text-xs text-gray-500 mt-0.5">Protein</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{Math.round(totalCarbs)}g</p>
                <p className="text-xs text-gray-500 mt-0.5">Carbs</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{Math.round(totalFat)}g</p>
                <p className="text-xs text-gray-500 mt-0.5">Fat</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meals */}
      {Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-gray-400">
            No food logged for this day yet.
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([meal, items]) => (
          <Card key={meal}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{MEAL_LABELS[meal as MealType]}</CardTitle>
                <span className="text-xs text-gray-400">
                  {items.reduce((s, f) => s + (f.estimated_calories ?? 0), 0)} kcal
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-gray-100">
                {items.map((f) => (
                  <li key={f.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{f.description}</p>
                        {(f.protein_g || f.carbs_g || f.fat_g) && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {f.protein_g ? `P: ${f.protein_g}g ` : ''}
                            {f.carbs_g ? `C: ${f.carbs_g}g ` : ''}
                            {f.fat_g ? `F: ${f.fat_g}g` : ''}
                          </p>
                        )}
                        {f.digestion_note && (
                          <p className="text-xs text-gray-400 italic mt-0.5">{f.digestion_note}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {f.confidence && (
                          <Badge variant={f.confidence === 'high' ? 'green' : f.confidence === 'medium' ? 'yellow' : 'default'}>
                            {f.confidence}
                          </Badge>
                        )}
                        {f.estimated_calories && (
                          <span className="text-sm font-medium text-gray-700">{f.estimated_calories} kcal</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}

    </div>
  )
}
