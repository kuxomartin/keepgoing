'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { COFFEE_TYPES, CAFFEINE_PER_CUP, estimateCaffeine, coffeeLabel } from '@/lib/coffee/types'
import { cn } from '@/lib/utils'

interface Props {
  returnTo?: string
}

function nowDateTime(): { date: string; time: string } {
  const d = new Date()
  const date = d.toISOString().slice(0, 10)
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return { date, time }
}

export function AddCoffeeForm({ returnTo = '/today' }: Props) {
  const router = useRouter()
  const { date: defaultDate, time: defaultTime } = nowDateTime()

  const [coffeeType, setCoffeeType]           = useState('espresso')
  const [cups, setCups]                       = useState(1)
  const [date, setDate]                       = useState(defaultDate)
  const [time, setTime]                       = useState(defaultTime)
  const [caffeineInput, setCaffeineInput]     = useState<string>('75')
  const [caffeineManual, setCaffeineManual]   = useState(false)
  const [notes, setNotes]                     = useState('')
  const [saving, setSaving]                   = useState(false)
  const [error, setError]                     = useState<string | null>(null)

  // Auto-update caffeine when type or cups change (unless manually overridden)
  useEffect(() => {
    if (caffeineManual) return
    const est = estimateCaffeine(coffeeType, cups)
    setCaffeineInput(est != null ? String(est) : '')
  }, [coffeeType, cups, caffeineManual])

  // Reset manual override when coffee type changes
  function handleTypeChange(type: string) {
    setCaffeineManual(false)
    setCoffeeType(type)
  }

  function handleCaffeineChange(val: string) {
    setCaffeineManual(true)
    setCaffeineInput(val)
  }

  function adjustCups(delta: number) {
    setCups(prev => Math.max(0.5, Math.round((prev + delta) * 2) / 2))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not signed in'); setSaving(false); return }

      const consumed_at = `${date}T${time}:00`
      const caffeine_mg = caffeineInput ? parseInt(caffeineInput, 10) : null

      const { error: dbErr } = await supabase.from('coffee_logs').insert({
        user_id:    user.id,
        consumed_at,
        date,
        coffee_type: coffeeType,
        cups,
        caffeine_mg: isNaN(caffeine_mg as number) ? null : caffeine_mg,
        notes:       notes.trim() || null,
      })
      if (dbErr) throw dbErr

      router.push(returnTo)
      router.refresh()
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to save')
      setSaving(false)
    }
  }

  const perCup = CAFFEINE_PER_CUP[coffeeType as keyof typeof CAFFEINE_PER_CUP]

  return (
    <div className="space-y-6">
      {/* Coffee type grid */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">Coffee type</p>
        <div className="grid grid-cols-3 gap-2">
          {COFFEE_TYPES.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeChange(type)}
              className={cn(
                'px-3 py-2.5 rounded-xl text-sm font-medium border transition-all text-center',
                coffeeType === type
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300 hover:bg-amber-50'
              )}
            >
              {coffeeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Cups stepper */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">Cups</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => adjustCups(-0.5)}
            disabled={cups <= 0.5}
            className="w-11 h-11 rounded-xl border border-gray-200 bg-white text-xl font-medium text-gray-700 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30"
          >
            −
          </button>
          <span className="text-2xl font-bold text-gray-900 w-16 text-center">
            {cups % 1 === 0 ? cups : cups.toFixed(1)}
          </span>
          <button
            type="button"
            onClick={() => adjustCups(0.5)}
            className="w-11 h-11 rounded-xl border border-gray-200 bg-white text-xl font-medium text-gray-700 flex items-center justify-center hover:bg-gray-50"
          >
            +
          </button>
        </div>
      </div>

      {/* Date + time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Time</label>
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="w-full h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Caffeine */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-gray-700">Caffeine (mg)</label>
          {!caffeineManual && perCup != null && (
            <span className="text-xs text-gray-400">Estimated · {perCup}mg × {cups}</span>
          )}
          {caffeineManual && (
            <button
              type="button"
              onClick={() => { setCaffeineManual(false) }}
              className="text-xs text-amber-600 hover:text-amber-700"
            >
              Reset to estimate
            </button>
          )}
        </div>
        <input
          type="number"
          value={caffeineInput}
          onChange={e => handleCaffeineChange(e.target.value)}
          placeholder={perCup != null ? String(perCup) : 'Unknown'}
          min="0"
          max="1000"
          className="w-full h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Pre-workout, afternoon pick-me-up"
          rows={2}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none placeholder:text-gray-400"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full h-12 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : '☕ Save coffee'}
      </button>
    </div>
  )
}
