export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EditMealForm } from '@/components/food/edit-meal-form'
import type { FoodLog } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditFoodPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) notFound()

  const meal = data as FoodLog

  return (
    <div className="max-w-lg mx-auto pb-4">
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/food"
          className="p-2 -ml-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Edit meal</h1>
      </div>

      <EditMealForm meal={meal} />
    </div>
  )
}
