import { AddCoffeeForm } from '@/components/coffee/add-coffee-form'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ from?: string; date?: string }>
}

export default async function AddCoffeePage({ searchParams }: PageProps) {
  const { from } = await searchParams
  const returnTo = from === 'today' ? '/today' : from === 'food' ? '/food' : '/today'

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={returnTo}
          className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Log Coffee</h1>
          <p className="text-xs text-gray-400">Track your caffeine intake</p>
        </div>
      </div>

      {/* Form */}
      <AddCoffeeForm returnTo={returnTo} />
    </div>
  )
}
