export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { format, subDays } from 'date-fns'
import { AddMealForm } from '@/components/food/add-meal-form'
import type { FoodLog } from '@/types/database'

interface PageProps {
  searchParams: Promise<{ from?: string }>
}

export default async function AddFoodPage({ searchParams }: PageProps) {
  const { from } = await searchParams
  const returnTo = from === 'today' ? '/today' : '/food'

  const supabase = await createClient()
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  // Last 20 logs → deduplicated to 10 unique descriptions
  const { data: recentRaw } = await supabase
    .from('food_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  const seen = new Set<string>()
  const recentMeals: FoodLog[] = []
  for (const row of (recentRaw ?? []) as FoodLog[]) {
    const key = row.description.toLowerCase().trim()
    if (!seen.has(key) && recentMeals.length < 10) {
      seen.add(key)
      recentMeals.push(row)
    }
  }

  // Yesterday's meals for "same as yesterday"
  const { data: yesterdayRaw } = await supabase
    .from('food_logs')
    .select('*')
    .eq('date', yesterday)
    .order('created_at', { ascending: true })

  const yesterdayMeals = (yesterdayRaw ?? []) as FoodLog[]

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 lg:py-10">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href={returnTo}
          className="p-2 -ml-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Add meal</h1>
      </div>

      <AddMealForm
        recentMeals={recentMeals}
        yesterdayMeals={yesterdayMeals}
        returnTo={returnTo}
      />
    </div>
  )
}
