'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  COFFEE_TYPE_ORDER, COFFEE_SPECS,
  customFilterCaffeine, estimateCaffeine,
} from '@/lib/coffee/types'
import { cn } from '@/lib/utils'

interface Props {
  returnTo?: string
}

function nowDateTime(): { date: string; time: string } {
  const d = new Date()
  return {
    date: d.toISOString().slice(0, 10),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  }
}

export function AddCoffeeForm({ returnTo = '/today' }: Props) {
  const router = useRouter()
  const { date: defaultDate, time: defaultTime } = nowDateTime()

  const [coffeeType, setCoffeeType]         = useState<string>('filter_225')
  const [cups, setCups]                     = useState(1)
  const [volumeMl, setVolumeMl]             = useState('')           // custom_filter only
  const [date, setDate]                     = useState(defaultDate)
  const [time, setTime]                     = useState(defaultTime)
  const [caffeineInput, setCaffeineInput]   = useState<string>('165')
  const [caffeineManual, setCaffeineManual] = useState(false)
  const [notes, setNotes]                   = useState('')
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState<string | null>(null)

  const isCustom = COFFEE_SPECS[coffeeType as keyof typeof COFFEE_SPECS]?.isCustom ?? false

  // Auto-update caffeine when type, cups, or custom volume changes
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
    // Reset cups to 1 when switching type
    setCups(1)
  }

  function handleCaffeineChange(val: string) {
    setCaffeineManual(true)
    setCaffeineInput(val)
  }

  function adjustCups(delta: number) {
    setCups(prev => Math.max(1, prev + delta))
  }

  // Custom filter derived values for display
  const customMl = parseFloat(volumeMl)
  const customCalc = !isNaN(customMl) && customMl > 0
    ? customFilterCaffeine(customMl)
    : null

  async function handleSave() {
    if (isCustom && (!volumeMl || isNaN(customMl) || customMl <= 0)) {
      setError('Enter a volume to calculate caffeine.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not signed in'); setSaving(false); return }

      const consumed_at = `${date}T${time}:00`
      const caffeine_raw = parseInt(caffeineInput, 10)
      const caffeine_mg  = caffeineInput && !isNaN(caffeine_raw) ? caffeine_raw : null

      const { error: dbErr } = await supabase.from('coffee_logs').insert({
        user_id:     user.id,
        consumed_at,
        date,
        coffee_type: coffeeType,
        cups,
        caffeine_mg,
        notes: notes.trim() || null,
      })
      if (dbErr) throw dbErr

      router.push(returnTo)
      router.refresh()
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Coffee type — one-tap grid ───────────────────────────── */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">What did you have?</p>
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
                  'flex flex-col items-start px-4 py-3.5 rounded-xl border text-left transition-all',
                  'min-h-[68px]',
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

      {/* ── Custom filter volume input ───────────────────────────── */}
      {isCustom && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Volume (ml)
            </label>
            <input
              type="number"
              value={volumeMl}
              onChange={e => { setVolumeMl(e.target.value); setCaffeineManual(false) }}
              placeholder="e.g. 250"
              min="50"
              max="800"
              step="25"
              autoFocus
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

      {/* ── Cups (hidden when 1 to reduce friction; tap to show) ── */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">
          Servings
        </p>
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
          {cups > 1 && (
            <span className="text-sm text-gray-400">× {COFFEE_SPECS[coffeeType as keyof typeof COFFEE_SPECS]?.label ?? coffeeType}</span>
          )}
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

      {/* ── Caffeine override ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-gray-700">Caffeine (mg)</label>
          {caffeineManual ? (
            <button
              type="button"
              onClick={() => setCaffeineManual(false)}
              className="text-xs text-amber-600 hover:text-amber-700"
            >
              Reset to estimate
            </button>
          ) : (
            <span className="text-xs text-gray-400">Estimated · tap to override</span>
          )}
        </div>
        <input
          type="number"
          value={caffeineInput}
          onChange={e => handleCaffeineChange(e.target.value)}
          placeholder={isCustom ? 'Enter volume above' : '—'}
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

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full h-12 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm"
      >
        {saving ? 'Saving…' : '☕ Save coffee'}
      </button>
    </div>
  )
}
