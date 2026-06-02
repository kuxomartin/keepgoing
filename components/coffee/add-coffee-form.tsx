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

// ── Shared input styles ────────────────────────────────────────────────────

const inputBase =
  'w-full h-11 border border-white/[0.08] bg-[#272D35] px-4 ' +
  'text-sm text-[#E7EDF2] placeholder:text-white/30 ' +
  'focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-colors'

export function AddCoffeeForm({ returnTo = '/today' }: Props) {
  const router = useRouter()
  const { date: defaultDate, time: defaultTime } = nowDateTime()

  const [coffeeType, setCoffeeType]         = useState<string>('filter_225')
  const [cups, setCups]                     = useState(1)
  const [volumeMl, setVolumeMl]             = useState('')
  const [date, setDate]                     = useState(defaultDate)
  const [time, setTime]                     = useState(defaultTime)
  const [caffeineInput, setCaffeineInput]   = useState<string>('165')
  const [caffeineManual, setCaffeineManual] = useState(false)
  const [notes, setNotes]                   = useState('')
  const [saving, setSaving]                 = useState(false)
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
    setCups(1)
  }

  function handleCaffeineChange(val: string) {
    setCaffeineManual(true)
    setCaffeineInput(val)
  }

  function adjustCups(delta: number) {
    setCups(prev => Math.max(1, prev + delta))
  }

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
        <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.12em] mb-3">
          What did you have?
        </p>
        <div className="grid grid-cols-2 gap-2">
          {COFFEE_TYPE_ORDER.map(type => {
            const spec     = COFFEE_SPECS[type]
            const selected = coffeeType === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeSelect(type)}
                className={cn(
                  'flex flex-col items-start px-4 py-3 border text-left transition-all min-h-[60px]',
                  selected
                    ? 'bg-[#D97706] text-white border-[#D97706]'
                    : 'bg-[#272D35] text-white/70 border-white/[0.08] hover:border-white/20 hover:text-white active:scale-[0.97]'
                )}
              >
                <span className={cn('text-sm font-semibold leading-snug', selected ? 'text-white' : 'text-[#E7EDF2]')}>
                  {spec.label}
                </span>
                <span className={cn('text-xs mt-0.5 leading-none', selected ? 'text-amber-200' : 'text-white/30')}>
                  {spec.sublabel}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Custom filter volume input ───────────────────────────── */}
      {isCustom && (
        <div className="border border-white/[0.08] bg-[#D97706]/[0.06] px-4 py-4 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-white/40 uppercase tracking-[0.12em] mb-2">
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
              className={cn(inputBase, 'border-[#D97706]/30 focus:border-[#D97706]/50')}
            />
          </div>
          {customCalc && (
            <div className="flex gap-4 text-sm text-amber-400">
              <span>☕ <strong>{customCalc.coffeeG} g</strong> coffee</span>
              <span>⚡ <strong>~{customCalc.caffeineMg} mg</strong> caffeine</span>
            </div>
          )}
        </div>
      )}

      {/* ── Servings ─────────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.12em] mb-3">
          Servings
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => adjustCups(-1)}
            disabled={cups <= 1}
            className="w-11 h-11 border border-white/[0.08] bg-[#272D35] text-xl font-medium text-white/70 flex items-center justify-center hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
          >
            −
          </button>
          <span className="text-2xl font-bold text-white font-mono w-10 text-center tabular-nums">{cups}</span>
          <button
            type="button"
            onClick={() => adjustCups(1)}
            className="w-11 h-11 border border-white/[0.08] bg-[#272D35] text-xl font-medium text-white/70 flex items-center justify-center hover:bg-white/[0.06] transition-colors"
          >
            +
          </button>
          {cups > 1 && (
            <span className="text-sm text-white/30">
              × {COFFEE_SPECS[coffeeType as keyof typeof COFFEE_SPECS]?.label ?? coffeeType}
            </span>
          )}
        </div>
      </div>

      {/* ── Date + time ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-white/40 uppercase tracking-[0.12em] mb-2">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={inputBase}
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-white/40 uppercase tracking-[0.12em] mb-2">Time</label>
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className={inputBase}
          />
        </div>
      </div>

      {/* ── Caffeine override ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-bold text-white/40 uppercase tracking-[0.12em]">
            Caffeine (mg)
          </label>
          {caffeineManual ? (
            <button
              type="button"
              onClick={() => setCaffeineManual(false)}
              className="text-xs text-[#D97706] hover:text-amber-400 transition-colors"
            >
              Reset to estimate
            </button>
          ) : (
            <span className="text-xs text-white/25">Estimated · tap to override</span>
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
            inputBase,
            caffeineManual ? 'border-[#D97706]/40' : ''
          )}
        />
      </div>

      {/* ── Notes ────────────────────────────────────────────────── */}
      <div>
        <label className="block text-[11px] font-bold text-white/40 uppercase tracking-[0.12em] mb-2">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. pre-workout, afternoon, with oat milk"
          rows={2}
          className={
            'w-full border border-white/[0.08] bg-[#272D35] px-4 py-3 ' +
            'text-sm text-[#E7EDF2] placeholder:text-white/30 ' +
            'focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 resize-none transition-colors'
          }
        />
      </div>

      {error && <p className="text-sm text-[#E5173F]">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full h-12 bg-[#D97706] text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : '☕ Save coffee'}
      </button>
    </div>
  )
}
