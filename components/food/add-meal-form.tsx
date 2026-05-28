'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { FoodLog, MealType } from '@/types/database'
import type { EstimateResponse } from '@/app/api/food/estimate/route'
import { MealFormFields, type AiState } from '@/components/food/meal-form-fields'

// ── helpers ────────────────────────────────────────────────────────────────

function defaultMealType(): MealType {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 14) return 'lunch'
  if (h < 22) return 'dinner'
  return 'snack'
}

function nowTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// ── props ──────────────────────────────────────────────────────────────────

interface Props {
  recentMeals: FoodLog[]
  yesterdayMeals: FoodLog[]
  returnTo?: string
}

// ── component ──────────────────────────────────────────────────────────────

export function AddMealForm({ recentMeals, yesterdayMeals, returnTo = '/food' }: Props) {
  const router = useRouter()
  const descRef = useRef<HTMLTextAreaElement>(null)

  const [mealType, setMealType] = useState<MealType>(defaultMealType)
  const [date, setDate]         = useState(format(new Date(), 'yyyy-MM-dd'))
  const [time, setTime]         = useState(nowTime)

  const [description, setDescription] = useState('')
  const [calories, setCalories]       = useState('')
  const [protein, setProtein]         = useState('')
  const [carbs, setCarbs]             = useState('')
  const [fat, setFat]                 = useState('')
  const [digestionNote, setDigestionNote] = useState('')

  const [showMacros, setShowMacros]       = useState(false)
  const [showDigestion, setShowDigestion] = useState(false)
  const [showYesterday, setShowYesterday] = useState(false)

  const [ai, setAi]           = useState<AiState>({ status: 'idle' })
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => { descRef.current?.focus() }, [])

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
        const d = await res.json() as { error?: string }
        setAi({ status: 'error', message: d.error ?? `Error ${res.status}` })
        return
      }
      const result = await res.json() as EstimateResponse
      setAi({ status: 'done', result })
      setCalories(result.estimated_calories.toString())
      setProtein(result.protein_g.toString())
      setCarbs(result.carbs_g.toString())
      setFat(result.fat_g.toString())
      setShowMacros(true)
    } catch (err) {
      setAi({ status: 'error', message: err instanceof Error ? err.message : 'Network error' })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) { setFormError('Description is required.'); descRef.current?.focus(); return }

    setLoading(true)
    setFormError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); setFormError('Not signed in.'); return }

    // Build eaten_at from date + time inputs
    const eaten_at = new Date(`${date}T${time}:00`).toISOString()

    const { error: dbError } = await supabase.from('food_logs').insert({
      user_id: user.id,
      date,
      eaten_at,
      meal_type: mealType,
      description: description.trim(),
      estimated_calories: calories ? parseInt(calories)   : null,
      protein_g:          protein  ? parseFloat(protein)  : null,
      carbs_g:            carbs    ? parseFloat(carbs)     : null,
      fat_g:              fat      ? parseFloat(fat)       : null,
      digestion_note:     digestionNote.trim() || null,
      confidence:         ai.status === 'done' ? ai.result.confidence : null,
    })

    setLoading(false)
    if (dbError) { setFormError(dbError.message) } else { router.push(returnTo); router.refresh() }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <MealFormFields
        mealType={mealType}        setMealType={v => { setMealType(v); if (ai.status === 'done') setAi({ status: 'idle' }) }}
        date={date}                setDate={setDate}
        time={time}                setTime={setTime}
        description={description}  setDescription={v => { setDescription(v); if (ai.status === 'done') setAi({ status: 'idle' }) }}
        calories={calories}        setCalories={setCalories}
        protein={protein}          setProtein={setProtein}
        carbs={carbs}              setCarbs={setCarbs}
        fat={fat}                  setFat={setFat}
        digestionNote={digestionNote} setDigestionNote={setDigestionNote}
        showMacros={showMacros}    setShowMacros={setShowMacros}
        showDigestion={showDigestion} setShowDigestion={setShowDigestion}
        ai={ai}
        onEstimate={handleEstimate}
        descRef={descRef}
        formError={formError}
      />

      {/* Submit */}
      <Button type="submit" size="lg" className="w-full" disabled={loading || !description.trim()}>
        {loading ? 'Saving…' : 'Add Meal'}
      </Button>

      {/* Quick shortcuts */}
      <div className="flex gap-2 flex-wrap pt-1">
        <button type="button"
          onClick={() => { setMealType('snack'); descRef.current?.focus() }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600 transition-colors active:scale-95"
        >
          🍎 Quick snack
        </button>
        {yesterdayMeals.length > 0 && (
          <button type="button"
            onClick={() => setShowYesterday(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border transition-colors active:scale-95',
              showYesterday ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Same as yesterday
          </button>
        )}
      </div>

      {/* Yesterday */}
      {showYesterday && yesterdayMeals.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 overflow-hidden">
          <p className="px-4 py-2.5 text-xs font-semibold text-blue-700 uppercase tracking-wide border-b border-blue-100">Yesterday's meals</p>
          <ul className="divide-y divide-blue-100">
            {yesterdayMeals.map(meal => (
              <li key={meal.id}>
                <button type="button" onClick={() => fillFrom(meal)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-100 transition-colors active:bg-blue-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{meal.description}</p>
                      <p className="text-xs text-blue-600 mt-0.5 capitalize">
                        {meal.meal_type}{meal.estimated_calories ? ` · ${meal.estimated_calories} kcal` : ''}
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

      {/* Recent meals */}
      {recentMeals.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <p className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">Repeat recent meal</p>
          <ul className="divide-y divide-gray-100">
            {recentMeals.map(meal => (
              <li key={meal.id}>
                <button type="button" onClick={() => fillFrom(meal)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors active:bg-gray-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 line-clamp-2">{meal.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5 capitalize">
                        {meal.meal_type}{meal.estimated_calories ? ` · ${meal.estimated_calories} kcal` : ''}
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
