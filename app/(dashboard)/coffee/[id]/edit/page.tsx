import { createClient } from '@/lib/supabase/server'
import { EditCoffeeForm } from '@/components/coffee/edit-coffee-form'
import type { CoffeeLog } from '@/types/database'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditCoffeePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('coffee_logs')
    .select('*')
    .eq('id', id)
    .single()

  if (!data) notFound()

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/food"
          className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Edit Coffee</h1>
          <p className="text-xs text-gray-400">{data.date}</p>
        </div>
      </div>

      <EditCoffeeForm log={data as CoffeeLog} />
    </div>
  )
}
