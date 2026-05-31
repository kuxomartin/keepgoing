'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Coffee } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { COFFEE_TYPE_ORDER, COFFEE_SPECS, estimateCaffeine } from '@/lib/coffee/types'
import { cn } from '@/lib/utils'

// All quick types — custom_filter excluded (needs volume input, lives at /coffee/add)
const QUICK_TYPES = COFFEE_TYPE_ORDER.filter(t => t !== 'custom_filter')

export function QuickAddCoffee() {
  const router = useRouter()
  const [saving,  setSaving]  = useState<string | null>(null)  // type currently being saved
  const [saved,   setSaved]   = useState<string | null>(null)  // type most recently saved
  const [error,   setError]   = useState<string | null>(null)

  async function handlePill(coffeeType: string) {
    if (saving) return
    setSaving(coffeeType)
    setError(null)
    setSaved(null)

    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const pad  = (n: number) => String(n).padStart(2, '0')
    const consumed_at = `${date}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`
    const caffeine_mg = estimateCaffeine(coffeeType, 1)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(null); setError('Not signed in'); return }

    const { error: dbErr } = await supabase.from('coffee_logs').insert({
      user_id:     user.id,
      consumed_at,
      date,
      coffee_type: coffeeType,
      cups:        1,
      caffeine_mg,
      notes:       null,
    })

    setSaving(null)

    if (dbErr) {
      setError(dbErr.message)
    } else {
      setSaved(coffeeType)
      router.refresh()
      setTimeout(() => setSaved(null), 2500)
    }
  }

  const savedSpec = saved ? COFFEE_SPECS[saved as keyof typeof COFFEE_SPECS] : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Coffee className="h-4 w-4 text-gray-400" />
          <CardTitle>Log Coffee</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* Success feedback — shown above pills so they stay usable */}
        {savedSpec && (
          <p className="text-xs font-medium text-emerald-600">
            ☕ {savedSpec.label} logged
          </p>
        )}

        {/* Coffee type pills */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TYPES.map((type) => {
            const spec      = COFFEE_SPECS[type]
            const isLoading = saving === type

            return (
              <button
                key={type}
                type="button"
                onClick={() => handlePill(type)}
                disabled={saving !== null}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  'disabled:cursor-not-allowed',
                  isLoading
                    ? 'bg-blue-600 text-white border-blue-600 opacity-100'
                    : saving !== null
                      ? 'bg-white text-gray-400 border-gray-100 opacity-50'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-700 active:scale-95',
                )}
              >
                {isLoading ? '…' : spec.label}
              </button>
            )
          })}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {/* Secondary link for custom filter and advanced options */}
        <Link
          href="/coffee/add?from=today"
          className="block text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          More coffee options →
        </Link>

      </CardContent>
    </Card>
  )
}
