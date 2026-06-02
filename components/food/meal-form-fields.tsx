'use client'

/**
 * Shared form fields used by both /food/add and /food/[id]/edit.
 * Dark-themed to match the slate-blue design system.
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
  high:   'bg-[#12B76A]/10 text-[#12B76A] border-[#12B76A]/20',
  medium: 'bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/20',
  low:    'bg-[#FF8A00]/10 text-[#FF8A00] border-[#FF8A00]/20',
}

// ── Decimal helpers ─────────────────────────────────────────────────────────

/**
 * Normalise a raw macro input string.
 * - Replaces comma decimal separator with dot ("1,7" → "1.7")
 * - Strips any character that is not a digit or dot
 * - Prevents multiple dots (keeps only the first)
 * Does NOT remove a trailing dot so typing "1." mid-entry is allowed.
 */
function normalizeDecimal(raw: string): string {
  let v = raw.replace(',', '.')                  // comma → dot
  v = v.replace(/[^0-9.]/g, '')                  // digits and dot only
  const parts = v.split('.')
  if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('')  // one dot max
  return v
}

/**
 * Format a macro value string for display — removes unnecessary trailing zeros.
 * "1.0" → "1", "1.50" → "1.5", "1.75" → "1.75", "0.3" → "0.3"
 */
function fmtMacroDisplay(v: string): string {
  const n = parseFloat(v.replace(',', '.'))
  return isNaN(n) ? v : String(n)
}

// ── Shared input classes ─────────────────────────────────────────────────────

const inputBase =
  'h-11 w-full rounded-lg border border-white/[0.08] bg-[#272D35] px-3 ' +
  'text-base text-[#E7EDF2] placeholder:text-white/30 ' +
  'focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-colors'

const textareaBase =
  'w-full rounded-xl border border-white/[0.08] bg-[#272D35] px-4 py-3 ' +
  'text-base text-[#E7EDF2] leading-relaxed placeholder:text-white/30 ' +
  'focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 resize-y overflow-auto transition-colors'

interface Props {
  mealType: MealType;    setMealType: (v: MealType) => void
  date: string;          setDate: (v: string) => void
  time: string;          setTime: (v: string) => void
  description: string;   setDescription: (v: string) => void
  calories: string;      setCalories: (v: string) => void
  protein: string;       setProtein: (v: string) => void
  carbs: string;         setCarbs: (v: string) => void
  fat: string;           setFat: (v: string) => void
  digestionNote: string; setDigestionNote: (v: string) => void
  showMacros: boolean;   setShowMacros: (v: boolean) => void
  showDigestion: boolean; setShowDigestion: (v: boolean) => void
  ai: AiState;           onEstimate: () => void
  descRef: React.RefObject<HTMLTextAreaElement | null>
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
        <label className="text-[11px] font-bold text-white/40 uppercase tracking-[0.12em]">
          Meal type
        </label>
        <div className="flex gap-2 flex-wrap">
          {MEAL_TYPES.map(({ value, label, emoji }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMealType(value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border transition-all min-h-[36px] whitespace-nowrap',
                mealType === value
                  ? 'bg-white text-[#0D0D0D] border-white'
                  : 'bg-transparent text-white/45 border-white/[0.08] hover:border-white/20 hover:text-white/65'
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
          className={cn(inputBase, 'w-auto')}
        />
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className={cn(inputBase, 'w-auto')}
        />
      </div>

      {/* ── Description ─────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-white/40 uppercase tracking-[0.12em]">
          What did you eat? <span className="text-[#E5173F]">*</span>
        </label>
        <textarea
          ref={descRef}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="3 eggs, bread, butter, tomato, coffee with milk"
          rows={4}
          className={cn(
            textareaBase, 'min-h-[160px]',
            formError && !description.trim() ? 'border-[#E5173F]/50' : ''
          )}
        />
        {formError && <p className="text-xs text-[#E5173F]">{formError}</p>}

        {/* Estimate button */}
        <button
          type="button"
          onClick={onEstimate}
          disabled={!canEstimate}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-semibold border transition-all',
            'disabled:opacity-30 disabled:cursor-not-allowed',
            ai.status === 'done'
              ? 'border-white/20 text-white/60 hover:text-white/80 hover:border-white/30'
              : 'border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white/65'
          )}
        >
          {aiLoading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Sparkles className="h-4 w-4" />}
          {aiLoading ? 'Estimating…' : ai.status === 'done' ? 'Re-estimate with AI' : 'Estimate with AI'}
        </button>
      </div>

      {/* ── AI result panel ──────────────────────────────── */}
      {ai.status === 'error' && (
        <div className="flex items-start gap-2.5 border border-[#E5173F]/20 bg-[#E5173F]/[0.06] px-4 py-3">
          <AlertCircle className="h-4 w-4 text-[#E5173F] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#E5173F]">Estimation failed</p>
            <p className="text-xs text-white/40 mt-0.5">{ai.message}</p>
          </div>
        </div>
      )}

      {ai.status === 'done' && (
        <div className="border border-white/[0.08] bg-white/[0.03] px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-white/50" />
              <span className="text-sm font-medium text-white/70">AI estimate applied</span>
            </div>
            <span className={cn('text-xs font-semibold px-2 py-0.5 border', CONFIDENCE_STYLES[ai.result.confidence])}>
              {ai.result.confidence}
            </span>
          </div>
          <p className="text-xs text-white/45 leading-relaxed">{ai.result.explanation}</p>
          <p className="text-xs text-white/25">Edit freely before saving.</p>
        </div>
      )}

      {/* ── Calories ────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <label className="text-[11px] font-bold text-white/40 uppercase tracking-[0.12em] w-24 flex-shrink-0">
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
            className={cn(
              inputBase, 'w-28 text-center',
              ai.status === 'done' && calories ? 'border-white/20' : ''
            )}
          />
          <span className="text-sm text-white/30">kcal</span>
        </div>
      </div>

      {/* ── Macros (expandable) ─────────────────────────── */}
      <div className="border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMacros(!showMacros)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-white/45 hover:text-white/70 transition-colors"
        >
          <span className="flex items-center gap-2">
            Macros (optional)
            {hasMacros && (
              <span className="text-xs font-mono text-white/30">
                P:{fmtMacroDisplay(protein)}g · C:{fmtMacroDisplay(carbs)}g · F:{fmtMacroDisplay(fat)}g
              </span>
            )}
          </span>
          {showMacros
            ? <ChevronUp className="h-4 w-4 text-white/25" />
            : <ChevronDown className="h-4 w-4 text-white/25" />}
        </button>
        {showMacros && (
          <div className="px-4 pb-4 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3">
            {([
              { key: 'protein', label: 'Protein', value: protein, set: setProtein },
              { key: 'carbs',   label: 'Carbs',   value: carbs,   set: setCarbs   },
              { key: 'fat',     label: 'Fat',     value: fat,     set: setFat     },
            ] as const).map(({ key, label, value, set }) => (
              <div key={key} className="space-y-1 text-center">
                <label className="text-[10px] font-bold text-white/35 uppercase tracking-[0.1em]">
                  {label}
                </label>
                {/* type="text" + inputMode="decimal" accepts any decimal (including comma separator).
                    step="any" would still trigger browser validation; text avoids it entirely. */}
                <input
                  type="text"
                  inputMode="decimal"
                  value={value}
                  onChange={e => set(normalizeDecimal(e.target.value))}
                  placeholder="0"
                  className={cn(inputBase, 'px-2 text-center')}
                />
                <span className="text-xs text-white/25">g</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Digestion note (expandable) ─────────────────── */}
      <div className="border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDigestion(!showDigestion)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-white/45 hover:text-white/70 transition-colors"
        >
          <span>
            Digestion note
            {digestionNote && (
              <span className="ml-2 text-xs font-normal text-white/30">
                {digestionNote.slice(0, 30)}{digestionNote.length > 30 ? '…' : ''}
              </span>
            )}
          </span>
          {showDigestion
            ? <ChevronUp className="h-4 w-4 text-white/25" />
            : <ChevronDown className="h-4 w-4 text-white/25" />}
        </button>
        {showDigestion && (
          <div className="px-4 pb-4 border-t border-white/[0.06] pt-3">
            <textarea
              value={digestionNote}
              onChange={e => setDigestionNote(e.target.value)}
              placeholder="Felt heavy, bloating, felt great..."
              rows={2}
              className={cn(textareaBase, 'min-h-[72px]')}
            />
          </div>
        )}
      </div>

    </div>
  )
}
