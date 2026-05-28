'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, RotateCcw, Clock } from 'lucide-react'
import type { FoodLog, MealType } from '@/types/database'
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

// ── props ──────────────────────────────────────────────────────────────────

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

  // Optional fields
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [digestionNote, setDigestionNote] = useState('')

  // UI toggles
  const [showMacros, setShowMacros] = useState(false)
  const [showDigestion, setShowDigestion] = useState(false)
  const [showYesterday, setShowYesterday] = useState(false)

  // Submission state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-focus description on mount
  useEffect(() => {
    descRef.current?.focus()
  }, [])

  // Pre-fill form from a FoodLog (for repeat / same-as-yesterday)
  function fillFrom(meal: FoodLog) {
    setDescription(meal.description)
    setMealType(meal.meal_type)
    setCalories(meal.estimated_calories?.toString() ?? '')
    setProtein(meal.protein_g?.toString() ?? '')
    setCarbs(meal.carbs_g?.toString() ?? '')
    setFat(meal.fat_g?.toString() ?? '')
    setDigestionNote('')
    if (meal.protein_g || meal.carbs_g || meal.fat_g) setShowMacros(true)
    setShowYesterday(false)
    setTimeout(() => descRef.current?.focus(), 50)
  }

  // Quick: set type to snack and focus description
  function quickSnack() {
    setMealType('snack')
    descRef.current?.focus()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) {
      setError('Description is required.')
      descRef.current?.focus()
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); setError('Not signed in.'); return }

    const { error: dbError } = await supabase.from('food_logs').insert({
      user_id: user.id,
      date,
      meal_type: mealType,
      description: description.trim(),
      estimated_calories: calories ? parseInt(calories) : null,
      protein_g: protein ? parseFloat(protein) : null,
      carbs_g: carbs ? parseFloat(carbs) : null,
      fat_g: fat ? parseFloat(fat) : null,
      digestion_note: digestionNote.trim() || null,
    })

    setLoading(false)

    if (dbError) {
      setError(dbError.message)
    } else {
      router.push(returnTo)
      router.refresh()
    }
  }

  const hasMacros = protein || carbs || fat
  const canSave = description.trim().length > 0

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
                'flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border transition-all',
                'min-h-[40px] whitespace-nowrap',
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
        <span className="text-sm text-gray-400">
          {date === format(new Date(), 'yyyy-MM-dd') ? 'Today' : ''}
        </span>
      </div>

      {/* ── Description (primary) ───────────────────────── */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">
          What did you eat? <span className="text-red-500">*</span>
        </label>
        <textarea
          ref={descRef}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={'3 eggs, bread, butter, tomato, coffee with milk'}
          rows={4}
          className={cn(
            'w-full rounded-xl border bg-white px-4 py-3 text-base leading-relaxed',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none',
            'placeholder:text-gray-300',
            error && !description.trim()
              ? 'border-red-400 focus:ring-red-400'
              : 'border-gray-200'
          )}
        />
        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}
      </div>

      {/* ── Calories ────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 w-28 flex-shrink-0">
          Calories
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={calories}
            onChange={e => setCalories(e.target.value)}
            placeholder="380"
            min="0"
            max="5000"
            className="h-11 w-28 rounded-lg border border-gray-200 bg-white px-3 text-base text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <span>
            Macros (optional)
            {hasMacros && (
              <span className="ml-2 text-xs font-normal text-blue-600">
                P:{protein}g C:{carbs}g F:{fat}g
              </span>
            )}
          </span>
          {showMacros
            ? <ChevronUp className="h-4 w-4 text-gray-400" />
            : <ChevronDown className="h-4 w-4 text-gray-400" />
          }
        </button>
        {showMacros && (
          <div className="px-4 pb-4 grid grid-cols-3 gap-3 border-t border-gray-100 pt-3">
            {[
              { label: 'Protein', value: protein, set: setProtein, color: 'text-blue-600' },
              { label: 'Carbs',   value: carbs,   set: setCarbs,   color: 'text-yellow-600' },
              { label: 'Fat',     value: fat,     set: setFat,     color: 'text-orange-600' },
            ].map(({ label, value, set, color }) => (
              <div key={label} className="space-y-1 text-center">
                <label className={cn('text-xs font-medium', color)}>{label}</label>
                <input
                  type="number"
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.5"
                  className="h-11 w-full rounded-lg border border-gray-200 bg-white px-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            Digestion note (optional)
            {digestionNote && (
              <span className="ml-2 text-xs font-normal text-gray-500 truncate max-w-[180px]">
                {digestionNote.slice(0, 30)}{digestionNote.length > 30 ? '…' : ''}
              </span>
            )}
          </span>
          {showDigestion
            ? <ChevronUp className="h-4 w-4 text-gray-400" />
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
      <div className="flex gap-2 pt-1">
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
