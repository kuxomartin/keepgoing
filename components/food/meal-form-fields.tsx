'use client'

/**
 * Shared form fields used by both /food/add and /food/[id]/edit.
 * The parent component manages all state and passes setters down.
 */

import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { MealType, ConfidenceLevel } from '@/types/database'
import type { EstimateResponse } from '@/app/api/food/estimate/route'

// ── Types ──────────────────────────────────────────────────────────────────

export type AiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: EstimateResponse }
  | { status: 'error'; message: string }

export const MEAL_TYPES: { value: MealType; label: string; emoji: string }[] = [
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

interface Props {
  // Core
  mealType: MealType
  setMealType: (v: MealType) => void
  date: string
  setDate: (v: string) => void
  time: string
  setTime: (v: string) => void
  description: string
  setDescription: (v: string) => void

  // Nutrition
  calories: string
  setCalories: (v: string) => void
  protein: string
  setProtein: (v: string) => void
  carbs: string
  setCarbs: (v: string) => void
  fat: string
  setFat: (v: string) => void
  digestionNote: string
  setDigestionNote: (v: string) => void

  // UI toggles
  showMacros: boolean
  setShowMacros: (v: boolean) => void
  showDigestion: boolean
  setShowDigestion: (v: boolean) => void

  // AI
  ai: AiState
  onEstimate: () => void

  // Refs
  descRef: React.RefObject<HTMLTextAreaElement | null>

  // Error
  formError?: string
}

export function MealFormFields({
  mealType, setMealType,
  date, setDate,
  time, setTime,
  description, setDescription,
  calories, setCalories,
  protein, setProtein,
  carbs, setCarbs,
  fat, setFat,
  digestionNote, setDigestionNote,
  showMacros, setShowMacros,
  showDigestion, setShowDigestion,
  ai, onEstimate,
  descRef,
  formError,
}: Props) {
  const aiLoading = ai.status === 'loading'
  const canEstimate = description.trim().length >= 3 && !aiLoading
  const hasMacros = protein || carbs || fat

  return (
    <div className="space-y-5">
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

      {/* ── Date + Time ──────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* ── Description ─────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          What did you eat? <span className="text-red-500">*</span>
        </label>
        <textarea
          ref={descRef}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="3 eggs, bread, butter, tomato, coffee with milk"
          rows={4}
          className={cn(
            'w-full rounded-xl border bg-white px-4 py-3 text-base leading-relaxed',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[180px] overflow-auto placeholder:text-gray-300',
            formError && !description.trim() ? 'border-red-400' : 'border-gray-200'
          )}
        />
        {formError && <p className="text-xs text-red-600">{formError}</p>}

        {/* Estimate button */}
        <button
          type="button"
          onClick={onEstimate}
          disabled={!canEstimate}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            ai.status === 'done'
              ? 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100'
              : 'bg-white border-gray-200 text-gray-700 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50'
          )}
        >
          {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {aiLoading ? 'Estimating…' : ai.status === 'done' ? 'Re-estimate with AI' : 'Estimate with AI'}
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
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', CONFIDENCE_STYLES[ai.result.confidence])}>
              {ai.result.confidence} confidence
            </span>
          </div>
          <p className="text-xs text-violet-700 leading-relaxed">{ai.result.explanation}</p>
          <p className="text-xs text-violet-500">Edit freely before saving.</p>
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
              ai.status === 'done' && calories ? 'border-violet-300 bg-violet-50' : 'border-gray-200'
            )}
          />
          <span className="text-sm text-gray-400">kcal</span>
        </div>
      </div>

      {/* ── Macros (expandable) ─────────────────────────── */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMacros(!showMacros)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <span className="flex items-center gap-2">
            Macros (optional)
            {hasMacros && (
              <span className={cn('text-xs font-normal px-1.5 py-0.5 rounded',
                ai.status === 'done' ? 'text-violet-600 bg-violet-100' : 'text-blue-600'
              )}>
                P:{protein}g · C:{carbs}g · F:{fat}g
              </span>
            )}
          </span>
          {showMacros ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
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
                    'h-11 w-full rounded-lg border bg-white px-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-blue-500',
                    ai.status === 'done' && value ? 'border-violet-300 bg-violet-50' : 'border-gray-200'
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
          onClick={() => setShowDigestion(!showDigestion)}
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
          {showDigestion ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>
        {showDigestion && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <textarea
              value={digestionNote}
              onChange={e => setDigestionNote(e.target.value)}
              placeholder="Felt heavy, bloating, felt great..."
              rows={2}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[80px] overflow-auto placeholder:text-gray-300"
            />
          </div>
        )}
      </div>
    </div>
  )
}
