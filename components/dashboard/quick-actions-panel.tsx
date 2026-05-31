'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Utensils, Scale, Coffee } from 'lucide-react'

type ActivePanel = 'weight' | null

// ── Weight inline form ────────────────────────────────────────────────────────
function WeightForm({ onDone }: { onDone: () => void }) {
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const kg = parseFloat(weight)
    if (isNaN(kg) || kg <= 0) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('weight_logs').insert({ user_id: user.id, date: today, weight_kg: kg, notes: notes || null })
    setSaved(true)
    setLoading(false)
    setTimeout(onDone, 800)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        id="qa-weight" type="number" label="Weight (kg)"
        value={weight} onChange={e => setWeight(e.target.value)}
        placeholder="85.5" step="0.1" min="30" max="300" required
        autoFocus
      />
      <Input
        id="qa-weight-notes" label="Notes (optional)"
        value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Morning, before breakfast"
      />
      <Button type="submit" size="lg" className="w-full" disabled={loading || saved}>
        {saved ? '✓ Saved!' : loading ? 'Saving…' : 'Save weight'}
      </Button>
    </form>
  )
}

// ── Panel (mobile-only, hidden on lg+) ───────────────────────────────────────

type PanelButton =
  | { id: 'meal';   label: string; icon: typeof Utensils; href: string }
  | { id: 'coffee'; label: string; icon: typeof Coffee;   href: string }
  | { id: 'weight'; label: string; icon: typeof Scale;    href?: undefined }

const PANEL_BUTTONS: PanelButton[] = [
  { id: 'meal',   label: 'Meal',   icon: Utensils, href: '/food/add?from=today' },
  { id: 'coffee', label: 'Coffee', icon: Coffee,   href: '/coffee/add?from=today' },
  { id: 'weight', label: 'Weight', icon: Scale },
]

export function QuickActionsPanel() {
  const [active, setActive] = useState<ActivePanel>(null)

  function toggle(panel: ActivePanel) {
    setActive(p => (p === panel ? null : panel))
  }

  return (
    <div className="lg:hidden space-y-3">
      {/* Action strip */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-4 px-4 sm:mx-0 sm:px-0">
        {PANEL_BUTTONS.map(({ id, label, icon: Icon, href }) => {
          const isActive = active === id

          if (href) {
            return (
              <Link
                key={id}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium',
                  'whitespace-nowrap flex-shrink-0 transition-colors border min-h-[44px]',
                  'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 active:scale-95'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>+ {label}</span>
              </Link>
            )
          }

          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id as ActivePanel)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium',
                'whitespace-nowrap flex-shrink-0 transition-colors border min-h-[44px]',
                isActive
                  ? 'bg-gray-900 text-white border-gray-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                  : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 active:scale-95'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>+ {label}</span>
            </button>
          )
        })}
      </div>

      {/* Expanded form panel */}
      {active && (
        <Card>
          <CardContent className="py-5">
            {active === 'weight' && <WeightForm onDone={() => setActive(null)} />}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
