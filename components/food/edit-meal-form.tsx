'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import type { FoodLog, MealType } from '@/types/database'
import type { EstimateResponse } from '@/app/api/food/estimate/route'
import { MealFormFields, type AiState } from '@/components/food/meal-form-fields'

interface Props {
  meal: FoodLog
}

function eatenAtToDate(meal: FoodLog): string {
  if (meal.eaten_at) return format(new Date(meal.eaten_at), 'yyyy-MM-dd')
  return meal.date
}

function eatenAtToTime(meal: FoodLog): string {
  if (meal.eaten_at) {
    const d = new Date(meal.eaten_at)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return '12:00'
}

export function EditMealForm({ meal }: Props) {
  const router = useRouter()
  const descRef = useRef<HTMLTextAreaElement>(null)

  const [mealType, setMealType] = useState<MealType>(meal.meal_type)
  const [date, setDate]         = useState(eatenAtToDate(meal))
  const [time, setTime]         = useState(eatenAtToTime(meal))

  const [description, setDescription] = useState(meal.description)
  const [calories, setCalories]       = useState(meal.estimated_calories?.toString() ?? '')
  const [protein, setProtein]         = useState(meal.protein_g?.toString()          ?? '')
  const [carbs, setCarbs]             = useState(meal.carbs_g?.toString()             ?? '')
  const [fat, setFat]                 = useState(meal.fat_g?.toString()               ?? '')
  const [digestionNote, setDigestionNote] = useState(meal.digestion_note ?? '')

  const [showMacros, setShowMacros]       = useState(!!(meal.protein_g || meal.carbs_g || meal.fat_g))
  const [showDigestion, setShowDigestion] = useState(!!meal.digestion_note)

  const [ai, setAi]             = useState<AiState>({ status: 'idle' })
  const [loading, setLoading]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { descRef.current?.focus() }, [])

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

    const eaten_at = new Date(`${date}T${time}:00`).toISOString()

    const { error: dbError } = await supabase.from('food_logs').update({
      date,
      eaten_at,
      meal_type: mealType,
      description: description.trim(),
      estimated_calories: calories ? Math.round(parseFloat(calories.replace(',', '.'))) || null : null,
      protein_g:          protein  ? parseFloat(protein.replace(',', '.'))  || null : null,
      carbs_g:            carbs    ? parseFloat(carbs.replace(',', '.'))    || null : null,
      fat_g:              fat      ? parseFloat(fat.replace(',', '.'))      || null : null,
      digestion_note:     digestionNote.trim() || null,
      confidence:         ai.status === 'done' ? ai.result.confidence : (meal.confidence ?? null),
    }).eq('id', meal.id).eq('user_id', user.id)

    setLoading(false)
    if (dbError) { setFormError(dbError.message) } else { router.push('/food'); router.refresh() }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }

    setDeleting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDeleting(false); return }

    const { error } = await supabase.from('food_logs').delete().eq('id', meal.id).eq('user_id', user.id)
    setDeleting(false)
    if (!error) { router.push('/food'); router.refresh() }
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

      {/* Sticky action area */}
      <div className="pt-2 space-y-3">
        {/* Save */}
        <Button type="submit" size="lg" className="w-full" disabled={loading || !description.trim()}>
          {loading ? 'Saving…' : 'Save changes'}
        </Button>

        {/* Delete */}
        {confirmDelete ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
            <p className="text-sm font-medium text-red-700 text-center">Delete this meal entry?</p>
            <p className="text-xs text-red-500 text-center">This cannot be undone.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDelete(false)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={handleDelete}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 border border-red-200 bg-white hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete this meal
          </button>
        )}
      </div>
    </form>
  )
}
