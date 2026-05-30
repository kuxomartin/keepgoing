'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  COFFEE_TYPE_ORDER, COFFEE_SPECS,
  customFilterCaffeine, estimateCaffeine, coffeeLabel,
} from '@/lib/coffee/types'
import type { CoffeeLog } from '@/types/database'
import { cn } from '@/lib/utils'

interface Props {
  log: CoffeeLog
}

export function EditCoffeeForm({ log }: Props) {
  const router = useRouter()

  const initialDate = log.consumed_at.slice(0, 10)
  const initialTime = log.consumed_at.slice(11, 16)

  // If the stored type is a legacy type not in our new list, keep it as-is
  const isLegacyType = !COFFEE_TYPE_ORDER.includes(log.coffee_type as never)

  const [coffeeType, setCoffeeType]         = useState(log.coffee_type)
  const [cups, setCups]                     = useState(log.cups)
  const [volumeMl, setVolumeMl]             = useState('')
  const [date, setDate]                     = useState(initialDate)
  const [time, setTime]                     = useState(initialTime)
  const [caffeineInput, setCaffeineInput]   = useState<string>(log.caffeine_mg != null ? String(log.caffeine_mg) : '')
  const [caffeineManual, setCaffeineManual] = useState(true) // pre-filled = manual
  const [notes, setNotes]                   = useState(log.notes ?? '')
  const [saving, setSaving]                 = useState(false)
  const [deleting, setDeleting]             = useState(false)
  const [confirmDelete, setConfirmDelete]   = useState(false)
  const [error, setError]                   = useState<string | null>(null)

  const isCustom = COFFEE_SPECS[coffeeType as keyof typeof COFFEE_SPECS]?.isCustom ?? false

  useEffect(() => {
    if (caffeineManual) return
    if (isCustom) {
      const ml = parseFloat(volumeMl)
      if (!isNaN(ml) && ml > 0) {
        const { caffeineMg } = customFilterCaffeine(ml)
        setCaffeineInput(String(caffeineMg * cups))
      } else {
        setCaffeineInput('')
      }
    } else {
      const est = estimateCaffeine(coffeeType, cups)
      setCaffeineInput(est != null ? String(est) : '')
    }
  }, [coffeeType, cups, volumeMl, caffeineManual, isCustom])

  function handleTypeSelect(type: string) {
    setCoffeeType(type)
    setCaffeineManual(false)
    setVolumeMl('')
  }

  function handleCaffeineChange(val: string) {
    setCaffeineManual(true)
    setCaffeineInput(val)
  }

  function adjustCups(delta: number) {
    setCups(prev => Math.max(1, prev + delta))
  }

  const customMl   = parseFloat(volumeMl)
  const customCalc = !isNaN(customMl) && customMl > 0 ? customFilterCaffeine(customMl) : null

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not signed in'); setSaving(false); return }

      const consumed_at  = `${date}T${time}:00`
      const caffeine_raw = parseInt(caffeineInput, 10)
      const caffeine_mg  = caffeineInput && !isNaN(caffeine_raw) ? caffeine_raw : null

      const { error: dbErr } = await supabase
        .from('coffee_logs')
        .update({ consumed_at, date, coffee_type: coffeeType, cups, caffeine_mg, notes: notes.trim() || null })
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

      {/* ── Legacy type notice ───────────────────────────────────── */}
      {isLegacyType && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-500">
          Currently logged as <strong className="text-gray-700">{coffeeLabel(log.coffee_type)}</strong>.
          {' '}Select a new type below to update.
        </div>
      )}

      {/* ── Coffee type — one-tap grid ───────────────────────────── */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">Coffee type</p>
        <div className="grid grid-cols-2 gap-2.5">
          {COFFEE_TYPE_ORDER.map(type => {
            const spec     = COFFEE_SPECS[type]
            const selected = coffeeType === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeSelect(type)}
                className={cn(
                  'flex flex-col items-start px-4 py-3.5 rounded-xl border text-left transition-all min-h-[68px]',
                  selected
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-white text-gray-800 border-gray-200 hover:border-amber-300 hover:bg-amber-50 active:scale-[0.97]'
                )}
              >
                <span className={cn('text-sm font-semibold leading-snug', selected ? 'text-white' : 'text-gray-900')}>
                  {spec.label}
                </span>
                <span className={cn('text-xs mt-0.5 leading-none', selected ? 'text-amber-200' : 'text-gray-400')}>
                  {spec.sublabel}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Custom filter volume ─────────────────────────────────── */}
      {isCustom && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Volume (ml)</label>
            <input
              type="number"
              value={volumeMl}
              onChange={e => { setVolumeMl(e.target.value); setCaffeineManual(false) }}
              placeholder="e.g. 250"
              min="50"
              max="800"
              step="25"
              className="w-full h-11 rounded-xl border border-amber-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          {customCalc && (
            <div className="flex gap-4 text-sm text-amber-800">
              <span>☕ <strong>{customCalc.coffeeG} g</strong> coffee</span>
              <span>⚡ <strong>~{customCalc.caffeineMg} mg</strong> caffeine</span>
            </div>
          )}
        </div>
      )}

      {/* ── Servings ─────────────────────────────────────────────── */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">Servings</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => adjustCups(-1)}
            disabled={cups <= 1}
            className="w-11 h-11 rounded-xl border border-gray-200 bg-white text-xl font-medium text-gray-700 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30"
          >
            −
          </button>
          <span className="text-2xl font-bold text-gray-900 w-10 text-center">{cups}</span>
          <button
            type="button"
            onClick={() => adjustCups(1)}
            className="w-11 h-11 rounded-xl border border-gray-200 bg-white text-xl font-medium text-gray-700 flex items-center justify-center hover:bg-gray-50"
          >
            +
          </button>
        </div>
      </div>

      {/* ── Date + time ──────────────────────────────────────────── */}
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

      {/* ── Caffeine ─────────────────────────────────────────────── */}
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
          placeholder="—"
          min="0"
          max="2000"
          className={cn(
            'w-full h-11 rounded-xl border bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500',
            caffeineManual ? 'border-amber-400' : 'border-gray-300'
          )}
        />
      </div>

      {/* ── Notes ────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. pre-workout, afternoon, with oat milk"
          rows={2}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none placeholder:text-gray-400"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* ── Actions ──────────────────────────────────────────────── */}
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
