'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ChevronDown, ChevronUp, RotateCcw, Clock,
  Sparkles, Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react'
import type { FoodLog, MealType, ConfidenceLevel } from '@/types/database'
import type { EstimateResponse } from '@/app/api/food/estimate/route'
import { format } from 'date-fns'

// ── helpers ────────────────────────────────────────────────────────────────

function defaultMealType(): MealType {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 14) return 'lunch'
  if (h < 18) return 'dinner'
  if (h < 22) return 'dinner'
  return 'snack'
}

const MEAL_TYPES: { value: MealType; label: string; emoji: string }[] = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { value: 'lunch',     label: 'Lunch',     emoji: '☀️' },
  { value: 'dinner',    label: 'Dinner',    emoji: '🌙' },
  { value: 'snack',     label: 'Snack',     emoji: '🍎' },
  { value: 'other',     label: 'Other',     emoji: '🍽️' },
]

const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
  high:   'bg-green-50  text-green-700  border-green-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low:    'bg-orange-50 text-orange-700 border-orange-200',
}

// ── types ──────────────────────────────────────────────────────────────────

type AiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: EstimateResponse }
  | { status: 'error'; message: string }

interface Props {
  recentMeals: FoodLog[]
  yesterdayMeals: FoodLog[]
  /** Where to go after saving. Default: /food */
  returnTo?: string
}

// ── component ──────────────────────────────────────────────────────────────

export function AddMealForm({ recentMeals, yesterdayMeals, returnTo = '/food' }: Props) {
  const router = useRouter()
  const descRef = useRef<HTMLTextAreaElement>(null)

  // Core state
  const [mealType, setMealType] = useState<MealType>(defaultMealType)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [description, setDescription] = useState('')

  // Nutrition fields (user-editable, may be pre-filled by AI)
  const [calories, setCalories] = useState('')
  const [protein, setProtein]   = useState('')
  const [carbs, setCarbs]       = useState('')
  const [fat, setFat]           = useState('')
  const [digestionNote, setDigestionNote] = useState('')

  // AI estimation state
  const [ai, setAi] = useState<AiState>({ status: 'idle' })

  // UI toggles
  const [showMacros, setShowMacros]       = useState(false)
  const [showDigestion, setShowDigestion] = useState(false)
  const [showYesterday, setShowYesterday] = useState(false)

  // Submission
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => { descRef.current?.focus() }, [])

  // Pre-fill from a FoodLog (repeat / same-as-yesterday)
  function fillFrom(meal: FoodLog) {
    setDescription(meal.description)
    setMealType(meal.meal_type)
    setCalories(meal.estimated_calories?.toString() ?? '')
    setProtein(meal.protein_g?.toString()           ?? '')
    setCarbs(meal.carbs_g?.toString()               ?? '')
    setFat(meal.fat_g?.toString()                   ?? '')
    setDigestionNote('')
    setAi({ status: 'idle' })
    if (meal.protein_g || meal.carbs_g || meal.fat_g) setShowMacros(true)
    setShowYesterday(false)
    setTimeout(() => descRef.current?.focus(), 50)
  }

  // Apply AI result to form fields (always overwrites on re-estimate)
  function applyEstimate(result: EstimateResponse) {
    setCalories(result.estimated_calories.toString())
    setProtein(result.protein_g.toString())
    setCarbs(result.carbs_g.toString())
    setFat(result.fat_g.toString())
    setShowMacros(true)   // auto-expand macros so user sees the values
  }

  // Call the estimate endpoint
  async function handleEstimate() {
    if (!description.trim()) return
    setAi({ status: 'loading' })

    try {
      const res = await fetch('/api/food/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setAi({ status: 'error', message: data.error ?? `Server error ${res.status}` })
        return
      }

      const result = await res.json() as EstimateResponse
      setAi({ status: 'done', result })
      applyEstimate(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setAi({ status: 'error', message: msg })
    }
  }

  // Quick snack shortcut
  function quickSnack() {
    setMealType('snack')
    descRef.current?.focus()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) {
      setFormError('Description is required.')
      descRef.current?.focus()
      return
    }

    setLoading(true)
    setFormError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); setFormError('Not signed in.'); return }

    const { error: dbError } = await supabase.from('food_logs').insert({
      user_id: user.id,
      date,
      meal_type: mealType,
      description: description.trim(),
      estimated_calories: calories ? parseInt(calories)    : null,
      protein_g:          protein  ? parseFloat(protein)  : null,
      carbs_g:            carbs    ? parseFloat(carbs)     : null,
      fat_g:              fat      ? parseFloat(fat)       : null,
      digestion_note:     digestionNote.trim() || null,
      confidence:         ai.status === 'done' ? ai.result.confidence : null,
    })

    setLoading(false)

    if (dbError) {
      setFormError(dbError.message)
    } else {
      router.push(returnTo)
      router.refresh()
    }
  }

  const hasMacros = protein || carbs || fat
  const canSave   = description.trim().length > 0
  const canEstimate = description.trim().length >= 3 && ai.status !== 'loading'
  const aiLoading = ai.status === 'loading'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Meal type pills ──────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Meal type</label>
        <div className="flex gap-2 flex-wrap">
          {MEAL_TYPES.map(({ value, label, emoji }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMealType(value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border transition-all min-h-[40px] whitespace-nowrap',
                mealType === value
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-200 hover:text-blue-600 active:scale-95'
              )}
            >
              <span>{emoji}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Date ────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {date === format(new Date(), 'yyyy-MM-dd') && (
          <span className="text-sm text-gray-400">Today</span>
        )}
      </div>

      {/* ── Description (primary) ───────────────────────── */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          What did you eat? <span className="text-red-500">*</span>
        </label>
        <textarea
          ref={descRef}
          value={description}
          onChange={e => {
            setDescription(e.target.value)
            // Reset AI state when description changes so stale results aren't shown
            if (ai.status === 'done') setAi({ status: 'idle' })
          }}
          placeholder="3 eggs, bread, butter, tomato, coffee with milk"
          rows={4}
          className={cn(
            'w-full rounded-xl border bg-white px-4 py-3 text-base leading-relaxed',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none',
            'placeholder:text-gray-300',
            formError && !description.trim()
              ? 'border-red-400 focus:ring-red-400'
              : 'border-gray-200'
          )}
        />
        {formError && (
          <p className="text-xs text-red-600">{formError}</p>
        )}

        {/* Estimate with AI button — below the textarea */}
        <button
          type="button"
          onClick={handleEstimate}
          disabled={!canEstimate}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            ai.status === 'done'
              ? 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100'
              : 'bg-white border-gray-200 text-gray-700 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50'
          )}
        >
          {aiLoading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Sparkles className="h-4 w-4" />
          }
          {aiLoading
            ? 'Estimating…'
            : ai.status === 'done'
              ? 'Re-estimate with AI'
              : 'Estimate with AI'
          }
        </button>
      </div>

      {/* ── AI result panel ──────────────────────────────── */}
      {ai.status === 'error' && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Estimation failed</p>
            <p className="text-xs text-red-500 mt-0.5">{ai.message}</p>
          </div>
        </div>
      )}

      {ai.status === 'done' && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-medium text-violet-800">AI estimate applied</span>
            </div>
            <span className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full border',
              CONFIDENCE_STYLES[ai.result.confidence]
            )}>
              {ai.result.confidence} confidence
            </span>
          </div>
          <p className="text-xs text-violet-700 leading-relaxed">{ai.result.explanation}</p>
          <p className="text-xs text-violet-500">Values filled below — edit freely before saving.</p>
        </div>
      )}

      {/* ── Calories ────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 w-28 flex-shrink-0">Calories</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={calories}
            onChange={e => setCalories(e.target.value)}
            placeholder="380"
            min="0"
            max="5000"
            className={cn(
              'h-11 w-28 rounded-lg border bg-white px-3 text-base text-center',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              ai.status === 'done' && calories
                ? 'border-violet-300 bg-violet-50'
                : 'border-gray-200'
            )}
          />
          <span className="text-sm text-gray-400">kcal</span>
        </div>
      </div>

      {/* ── Macros (expandable) ─────────────────────────── */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMacros(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <span className="flex items-center gap-2">
            Macros (optional)
            {hasMacros && (
              <span className={cn(
                'text-xs font-normal px-1.5 py-0.5 rounded',
                ai.status === 'done'
                  ? 'text-violet-600 bg-violet-100'
                  : 'text-blue-600'
              )}>
                P:{protein}g · C:{carbs}g · F:{fat}g
              </span>
            )}
          </span>
          {showMacros
            ? <ChevronUp   className="h-4 w-4 text-gray-400" />
            : <ChevronDown className="h-4 w-4 text-gray-400" />
          }
        </button>
        {showMacros && (
          <div className="px-4 pb-4 grid grid-cols-3 gap-3 border-t border-gray-100 pt-3">
            {([
              { key: 'protein', label: 'Protein', value: protein, set: setProtein, color: 'text-blue-600' },
              { key: 'carbs',   label: 'Carbs',   value: carbs,   set: setCarbs,   color: 'text-yellow-600' },
              { key: 'fat',     label: 'Fat',     value: fat,     set: setFat,     color: 'text-orange-600' },
            ] as const).map(({ key, label, value, set, color }) => (
              <div key={key} className="space-y-1 text-center">
                <label className={cn('text-xs font-medium', color)}>{label}</label>
                <input
                  type="number"
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.5"
                  className={cn(
                    'h-11 w-full rounded-lg border bg-white px-2 text-base text-center',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500',
                    ai.status === 'done' && value
                      ? 'border-violet-300 bg-violet-50'
                      : 'border-gray-200'
                  )}
                />
                <span className="text-xs text-gray-400">g</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Digestion note (expandable) ─────────────────── */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDigestion(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <span>
            Digestion note
            {digestionNote && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                {digestionNote.slice(0, 30)}{digestionNote.length > 30 ? '…' : ''}
              </span>
            )}
          </span>
          {showDigestion
            ? <ChevronUp   className="h-4 w-4 text-gray-400" />
            : <ChevronDown className="h-4 w-4 text-gray-400" />
          }
        </button>
        {showDigestion && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <textarea
              value={digestionNote}
              onChange={e => setDigestionNote(e.target.value)}
              placeholder="Felt heavy, had bloating, felt great..."
              rows={2}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-300"
            />
          </div>
        )}
      </div>

      {/* ── Submit ──────────────────────────────────────── */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={loading || !canSave}
      >
        {loading ? 'Saving…' : 'Add Meal'}
      </Button>

      {/* ── Quick shortcuts ─────────────────────────────── */}
      <div className="flex gap-2 flex-wrap pt-1">
        <button
          type="button"
          onClick={quickSnack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600 transition-colors active:scale-95"
        >
          🍎 Quick snack
        </button>

        {yesterdayMeals.length > 0 && (
          <button
            type="button"
            onClick={() => setShowYesterday(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border transition-colors active:scale-95',
              showYesterday
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Same as yesterday
          </button>
        )}
      </div>

      {/* ── Yesterday's meals ───────────────────────────── */}
      {showYesterday && yesterdayMeals.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 overflow-hidden">
          <p className="px-4 py-2.5 text-xs font-semibold text-blue-700 uppercase tracking-wide border-b border-blue-100">
            Yesterday's meals
          </p>
          <ul className="divide-y divide-blue-100">
            {yesterdayMeals.map(meal => (
              <li key={meal.id}>
                <button
                  type="button"
                  onClick={() => fillFrom(meal)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-100 transition-colors active:bg-blue-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{meal.description}</p>
                      <p className="text-xs text-blue-600 mt-0.5 capitalize">
                        {meal.meal_type}
                        {meal.estimated_calories ? ` · ${meal.estimated_calories} kcal` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-blue-500 flex-shrink-0 mt-0.5">Use →</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Recent meals ────────────────────────────────── */}
      {recentMeals.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <p className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            Repeat recent meal
          </p>
          <ul className="divide-y divide-gray-100">
            {recentMeals.map(meal => (
              <li key={meal.id}>
                <button
                  type="button"
                  onClick={() => fillFrom(meal)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors active:bg-gray-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 line-clamp-2">{meal.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5 capitalize">
                        {meal.meal_type}
                        {meal.estimated_calories ? ` · ${meal.estimated_calories} kcal` : ''}
                      </p>
                    </div>
                    <RotateCcw className="h-4 w-4 text-gray-300 flex-shrink-0 mt-0.5" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  )
}
