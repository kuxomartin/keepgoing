'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { COFFEE_TYPES, estimateCaffeine, coffeeLabel } from '@/lib/coffee/types'
import type { CoffeeLog } from '@/types/database'
import { cn } from '@/lib/utils'

interface Props {
  log: CoffeeLog
}

export function EditCoffeeForm({ log }: Props) {
  const router = useRouter()

  // Pre-fill from existing log
  const initialDate = log.consumed_at.slice(0, 10)
  const initialTime = log.consumed_at.slice(11, 16)

  const [coffeeType, setCoffeeType]           = useState(log.coffee_type)
  const [cups, setCups]                       = useState(log.cups)
  const [date, setDate]                       = useState(initialDate)
  const [time, setTime]                       = useState(initialTime)
  const [caffeineInput, setCaffeineInput]     = useState<string>(log.caffeine_mg != null ? String(log.caffeine_mg) : '')
  const [caffeineManual, setCaffeineManual]   = useState(true) // pre-filled = manual
  const [notes, setNotes]                     = useState(log.notes ?? '')
  const [saving, setSaving]                   = useState(false)
  const [deleting, setDeleting]               = useState(false)
  const [confirmDelete, setConfirmDelete]     = useState(false)
  const [error, setError]                     = useState<string | null>(null)

  useEffect(() => {
    if (caffeineManual) return
    const est = estimateCaffeine(coffeeType, cups)
    setCaffeineInput(est != null ? String(est) : '')
  }, [coffeeType, cups, caffeineManual])

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

      const { error: dbErr } = await supabase
        .from('coffee_logs')
        .update({
          consumed_at,
          date,
          coffee_type: coffeeType,
          cups,
          caffeine_mg: isNaN(caffeine_mg as number) ? null : caffeine_mg,
          notes:       notes.trim() || null,
        })
        .eq('id', log.id)
        .eq('user_id', user.id)

      if (dbErr) throw dbErr
      router.push('/food')
      router.refresh()
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to save')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('coffee_logs').delete().eq('id', log.id).eq('user_id', user.id)
      router.push('/food')
      router.refresh()
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to delete')
      setDeleting(false)
    }
  }

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
          {caffeineManual && (
            <button
              type="button"
              onClick={() => setCaffeineManual(false)}
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
          placeholder="Unknown"
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

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className={cn(
            'w-full h-12 text-sm font-semibold rounded-xl border transition-colors',
            confirmDelete
              ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
              : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
          )}
        >
          {deleting ? 'Deleting…' : confirmDelete ? 'Tap again to confirm delete' : 'Delete coffee log'}
        </button>

        {confirmDelete && !deleting && (
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="w-full text-sm text-gray-400 hover:text-gray-600 py-1"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
