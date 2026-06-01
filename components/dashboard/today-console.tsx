'use client'

/**
 * TodayConsole — unified 4-column dark control console for Today page.
 *
 * CRITICAL: All column JSX is rendered INLINE — never as inner function components.
 * Inner function components cause unmount/remount on parent re-renders → focus loss.
 *
 * TIME PATTERN — same everywhere:
 *   If untouched → log with current timestamp.
 *   Click "TIME" → show datetime-local picker → user can choose any date/time.
 *   Same control in Food, Coffee, Weight.
 */

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const COFFEE_OPTIONS = [
  { key: 'filter_225',           label: 'FILTER 225',   mg: 165 },
  { key: 'filter_300',           label: 'FILTER 300',   mg: 220 },
  { key: 'espresso_office',      label: 'ESPRESSO',     mg: 75  },
  { key: 'espresso_home_single', label: 'HOME SINGLE',  mg: 75  },
  { key: 'espresso_home_double', label: 'HOME DOUBLE',  mg: 150 },
  { key: 'capsule',              label: 'CAPSULE',      mg: 60  },
  { key: 'decaf',                label: 'DECAF',        mg: 5   },
] as const

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch',     label: 'Lunch'     },
  { key: 'dinner',    label: 'Dinner'    },
  { key: 'snack',     label: 'Snack'     },
]

const TREND_DIR_CLS: Record<string, string> = {
  good:    'text-[#16A34A]',
  bad:     'text-[#D97706]',
  neutral: 'text-[#888888]',
}
const TREND_DIR_ICON: Record<string, string> = { up: '↑', down: '↓', stable: '→' }

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrendItem { label: string; direction: string; sentiment: string; value: string }

export interface TodayConsoleProps {
  todayCalories:        number | null
  todayProtein:         number | null
  actMinsToday:         number
  coffeeCups:           number
  coffeeMg:             number
  lastCoffeeTime:       string | null
  currentWeight:        number | null
  ydayCalories:         number | null
  ydayBalance:          number | null
  ydayProtein:          number | null
  ydayActivityMinutes:  number
  trendItems:           TrendItem[]
  trendSummaryText:     string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns "YYYY-MM-DDTHH:MM" for the current local time — used to pre-fill the picker */
function nowLocal(): string {
  const n   = new Date()
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}`
}

/**
 * Resolve a timeValue ("YYYY-MM-DDTHH:MM" or "") into { date, isoStr }.
 * Empty → current timestamp. Non-empty → selected value.
 */
function resolveTimestamp(timeValue: string): { date: string; isoStr: string } {
  if (timeValue) {
    return {
      date:   timeValue.slice(0, 10),
      isoStr: `${timeValue}:00`,
    }
  }
  const n   = new Date()
  const pad = (x: number) => String(x).padStart(2, '0')
  const d   = n.toISOString().slice(0, 10)
  return {
    date:   d,
    isoStr: `${d}T${pad(n.getHours())}:${pad(n.getMinutes())}:00`,
  }
}

/** Format "YYYY-MM-DDTHH:MM" → "1 Jun · 14:30" for compact display */
function fmtTimeVal(v: string): string {
  if (!v) return ''
  try {
    const d = new Date(v + ':00')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const pad = (x: number) => String(x).padStart(2, '0')
    return `${d.getDate()} ${months[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return v
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TodayConsole(props: TodayConsoleProps) {
  const router = useRouter()

  // Mobile tab
  type MobileTab = 'intake' | 'coffee' | 'weight'
  const [mobileTab, setMobileTab] = useState<MobileTab>('coffee')

  // ── Food state ────────────────────────────────────────────────────────────
  const [mealType,     setMealType]     = useState('breakfast')
  const [foodDesc,     setFoodDesc]     = useState('')
  const [estimating,   setEstimating]   = useState(false)
  const [estimate,     setEstimate]     = useState<{ calories: number; protein: number } | null>(null)
  const [foodStatus,   setFoodStatus]   = useState<'idle' | 'saving' | 'saved'>('idle')
  // Time control — food
  const [foodTimeVal,  setFoodTimeVal]  = useState('')   // '' = use current time
  const [foodTimeOpen, setFoodTimeOpen] = useState(false)

  async function runEstimate() {
    if (!foodDesc.trim()) return
    setEstimating(true)
    try {
      const res = await fetch('/api/food/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: foodDesc }),
      })
      if (res.ok) {
        const data = await res.json()
        setEstimate({ calories: data.estimated_calories ?? 0, protein: data.protein_g ?? 0 })
      }
    } finally {
      setEstimating(false)
    }
  }

  async function logFood() {
    if (!foodDesc.trim() || foodStatus !== 'idle') return
    setFoodStatus('saving')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setFoodStatus('idle'); return }
      const { date, isoStr } = resolveTimestamp(foodTimeVal)
      await supabase.from('food_logs').insert({
        user_id:            user.id,
        date,
        meal_type:          mealType,
        description:        foodDesc,
        estimated_calories: estimate?.calories ?? null,
        protein_g:          estimate?.protein  ?? null,
        eaten_at:           isoStr,
      })
      setFoodStatus('saved')
      setFoodDesc('')
      setEstimate(null)
      setFoodTimeVal('')
      setFoodTimeOpen(false)
      setTimeout(() => { setFoodStatus('idle'); router.refresh() }, 1800)
    } catch {
      setFoodStatus('idle')
    }
  }

  // ── Coffee state ──────────────────────────────────────────────────────────
  const [coffeeLogged,    setCoffeeLogged]    = useState<string | null>(null)
  // Time control — coffee
  const [coffeeTimeVal,   setCoffeeTimeVal]   = useState('')
  const [coffeeTimeOpen,  setCoffeeTimeOpen]  = useState(false)

  async function logCoffee(key: string, mg: number) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { date, isoStr } = resolveTimestamp(coffeeTimeVal)
    await supabase.from('coffee_logs').insert({
      user_id:     user.id,
      date,
      consumed_at: isoStr,
      coffee_type: key,
      cups:        1,
      caffeine_mg: mg,
      notes:       null,
    })
    setCoffeeLogged(key)
    router.refresh()
    setTimeout(() => setCoffeeLogged(null), 2500)
  }

  // ── Weight state ──────────────────────────────────────────────────────────
  const [weightEditing,  setWeightEditing]  = useState(false)
  const [weightVal,      setWeightVal]      = useState(props.currentWeight ? props.currentWeight.toFixed(1) : '')
  const [weightStatus,   setWeightStatus]   = useState<'idle' | 'saved'>('idle')
  // Time control — weight
  const [weightTimeVal,  setWeightTimeVal]  = useState('')
  const [weightTimeOpen, setWeightTimeOpen] = useState(false)
  const weightInputRef = useRef<HTMLInputElement>(null)
  const weightSaving   = useRef(false)

  function openWeightEdit() {
    setWeightEditing(true)
    setWeightStatus('idle')
    setTimeout(() => { weightInputRef.current?.focus(); weightInputRef.current?.select() }, 30)
  }

  async function saveWeight() {
    if (weightSaving.current) return
    const kg = parseFloat(weightVal)
    if (isNaN(kg) || kg < 20 || kg > 400) { setWeightEditing(false); return }
    weightSaving.current = true
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setWeightEditing(false); return }
      const { date } = resolveTimestamp(weightTimeVal)
      await supabase.from('weight_logs').insert({ user_id: user.id, date, weight_kg: kg })
      setWeightEditing(false)
      setWeightTimeVal('')
      setWeightTimeOpen(false)
      setWeightStatus('saved')
      setTimeout(() => { setWeightStatus('idle'); router.refresh() }, 2000)
    } finally {
      weightSaving.current = false
    }
  }

  // ── Shared classes ────────────────────────────────────────────────────────
  const colClass     = 'px-8 lg:px-10 py-8 border-r border-white/8'
  const lastColClass = 'px-8 lg:px-10 py-8'
  const labelClass   = 'text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-5 block'

  // ── Shared TimeControl render helper (NOT a component — just a function returning JSX) ──
  // Must be called with unique state variables to avoid any cross-column interference.
  function renderTimeControl(
    timeVal: string,
    setTimeVal: (v: string) => void,
    timeOpen: boolean,
    setTimeOpen: (v: boolean) => void,
  ) {
    if (!timeOpen && !timeVal) {
      // Default state — show "TIME" link
      return (
        <button
          type="button"
          onClick={() => { setTimeOpen(true); setTimeVal(nowLocal()) }}
          className="text-[10px] font-medium text-white/25 uppercase tracking-[0.12em] hover:text-white/50 transition-colors"
        >
          Time
        </button>
      )
    }
    // Picker open or value selected
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="datetime-local"
          value={timeVal}
          onChange={e => setTimeVal(e.target.value)}
          className={cn(
            'bg-transparent text-xs text-white/60 pb-0.5',
            'border-b border-white/20 focus:border-white/50 focus:outline-none',
            '[color-scheme:dark]',
          )}
        />
        <button
          type="button"
          onClick={() => { setTimeVal(''); setTimeOpen(false) }}
          className="text-white/30 hover:text-white/60 text-sm leading-none"
          aria-label="Clear time"
        >
          ×
        </button>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTAKE column — all JSX inline
  // ═══════════════════════════════════════════════════════════════════════
  const intakeJSX = (
    <div className="flex flex-col h-full">
      <span className={labelClass}>Intake</span>

      {/* Today's logged state */}
      {(props.todayCalories != null || props.todayProtein != null || props.actMinsToday > 0) && (
        <div className="mb-5 pb-5 border-b border-white/8">
          {props.todayCalories != null && (
            <p className="text-2xl font-bold text-white tabular-nums leading-none mb-1">
              {props.todayCalories.toLocaleString()}
              <span className="text-sm font-normal text-white/30 ml-1.5">kcal</span>
            </p>
          )}
          {props.todayProtein != null && (
            <p className="text-sm text-white/40">{Math.round(props.todayProtein)}g protein</p>
          )}
          {props.actMinsToday > 0 && (
            <p className="text-sm text-white/40">{props.actMinsToday} min active</p>
          )}
        </div>
      )}

      {/* Meal type tabs */}
      <div className="flex gap-4 mb-5">
        {MEAL_TYPES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMealType(key)}
            className={cn(
              'text-sm transition-colors',
              mealType === key ? 'text-white font-semibold' : 'text-white/30 hover:text-white/60',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Ghost textarea — stable identity, no inner component = no focus loss */}
      <textarea
        value={foodDesc}
        onChange={e => { setFoodDesc(e.target.value); setEstimate(null) }}
        placeholder="What did you eat?"
        rows={3}
        className={cn(
          'w-full bg-transparent text-base text-white placeholder-white/20',
          'border-0 border-b border-white/15 focus:border-white/40 focus:outline-none',
          'resize-none pb-2 leading-relaxed transition-colors',
        )}
      />

      {/* Estimate / result */}
      <div className="mt-3 mb-4 min-h-[1rem]">
        {estimate ? (
          <p className="text-xs text-white/40">
            {estimate.calories} kcal · {estimate.protein}g protein
          </p>
        ) : (
          <button
            type="button"
            onClick={runEstimate}
            disabled={!foodDesc.trim() || estimating}
            className="text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-20"
          >
            {estimating ? 'Estimating…' : 'Estimate calories →'}
          </button>
        )}
      </div>

      {/* Time control */}
      <div className="mb-4">
        {renderTimeControl(foodTimeVal, setFoodTimeVal, foodTimeOpen, setFoodTimeOpen)}
      </div>

      {/* Primary action */}
      {foodStatus === 'saved' ? (
        <p className="text-xs font-bold text-[#16A34A] uppercase tracking-[0.15em]">Logged ✓</p>
      ) : (
        <button
          type="button"
          onClick={logFood}
          disabled={!foodDesc.trim() || foodStatus === 'saving'}
          className="text-xs font-bold text-white/50 hover:text-white uppercase tracking-[0.15em] transition-colors disabled:opacity-20 text-left"
        >
          {foodStatus === 'saving' ? 'Logging…' : 'Log Entry'}
        </button>
      )}

      <a href="/food" className="mt-auto pt-5 text-[10px] text-white/20 hover:text-white/40 transition-colors">
        Full intake page →
      </a>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════
  // COFFEE column — inline
  // ═══════════════════════════════════════════════════════════════════════
  const coffeeJSX = (
    <div className="flex flex-col h-full">
      <span className={labelClass}>Coffee</span>

      {/* Today's coffee summary */}
      {props.coffeeCups > 0 && (
        <div className="mb-5 pb-5 border-b border-white/8">
          <p className="text-2xl font-bold text-white tabular-nums leading-none mb-1">
            {props.coffeeCups % 1 === 0 ? props.coffeeCups : props.coffeeCups.toFixed(1)}
            <span className="text-sm font-normal text-white/30 ml-1.5">cup{props.coffeeCups !== 1 ? 's' : ''}</span>
          </p>
          {props.coffeeMg > 0 && <p className="text-sm text-white/40">{props.coffeeMg}mg caffeine</p>}
          {props.lastCoffeeTime && <p className="text-xs text-white/30 mt-0.5">last {props.lastCoffeeTime}</p>}
        </div>
      )}

      {/* Coffee buttons */}
      {coffeeLogged ? (
        <div className="flex items-center gap-3 mb-4">
          <p className="text-sm font-semibold text-white">
            ☕ {COFFEE_OPTIONS.find(o => o.key === coffeeLogged)?.label}
          </p>
          <p className="text-xs font-bold text-[#16A34A] uppercase tracking-widest">logged ✓</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-5">
          {COFFEE_OPTIONS.map(({ key, label, mg }) => (
            <button
              key={key}
              type="button"
              onClick={() => logCoffee(key, mg)}
              className="text-left text-sm text-white/40 hover:text-[#0D0D0D] hover:bg-white py-1.5 px-2 transition-all"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Time control */}
      <div className="mb-3">
        {renderTimeControl(coffeeTimeVal, setCoffeeTimeVal, coffeeTimeOpen, setCoffeeTimeOpen)}
      </div>

      <a href="/coffee/add?from=today" className="mt-auto pt-4 text-[10px] text-white/20 hover:text-white/40 transition-colors">
        More options →
      </a>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════
  // WEIGHT column — inline
  // ═══════════════════════════════════════════════════════════════════════
  const weightJSX = (
    <div className="flex flex-col h-full">
      <span className={labelClass}>Weight</span>

      {weightStatus === 'saved' ? (
        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display font-bold text-white tabular-nums leading-none" style={{ fontSize: '3rem' }}>
              {weightVal}
            </span>
            <span className="text-sm text-white/30">kg</span>
          </div>
          <p className="text-xs font-bold text-[#16A34A] uppercase tracking-[0.12em] mt-3">Saved ✓</p>
        </div>
      ) : weightEditing ? (
        <div className="mb-4">
          <div className="flex items-baseline gap-2 border-b border-white/25 pb-1 mb-3">
            <input
              ref={weightInputRef}
              type="number"
              step="0.1"
              value={weightVal}
              onChange={e => setWeightVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); saveWeight() }
                if (e.key === 'Escape') { setWeightEditing(false) }
              }}
              onBlur={() => { if (!weightSaving.current) saveWeight() }}
              className="font-display font-bold text-white tabular-nums leading-none bg-transparent border-0 focus:outline-none w-32"
              style={{ fontSize: '3rem' }}
            />
            <span className="text-sm text-white/30">kg</span>
          </div>
          {/* Time control */}
          <div className="mb-3">
            {renderTimeControl(weightTimeVal, setWeightTimeVal, weightTimeOpen, setWeightTimeOpen)}
          </div>
          <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-2">Enter to save</p>
          <button
            type="button"
            onClick={saveWeight}
            className="text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-[0.15em] transition-colors"
          >
            Log weight
          </button>
        </div>
      ) : (
        <div className="mb-4">
          <button type="button" onClick={openWeightEdit} className="text-left group mb-3">
            <div className="flex items-baseline gap-2">
              <span
                className="font-display font-bold tabular-nums leading-none transition-colors group-hover:text-white/60"
                style={{ fontSize: '3rem', color: weightVal ? 'white' : 'rgba(255,255,255,0.2)' }}
              >
                {weightVal || '——'}
              </span>
              <span className="text-sm text-white/30">kg</span>
            </div>
            <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mt-2 group-hover:text-white/40 transition-colors">
              Tap to edit
            </p>
          </button>

          {/* Time control shown even when not editing (for historical entries) */}
          {renderTimeControl(weightTimeVal, setWeightTimeVal, weightTimeOpen, setWeightTimeOpen)}
        </div>
      )}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════
  // YESTERDAY + TRAJECTORY — read-only, inline
  // ═══════════════════════════════════════════════════════════════════════
  const contextJSX = (
    <div className="flex flex-col h-full">
      <span className={labelClass}>Yesterday</span>

      {props.ydayCalories != null ? (
        <div className="mb-5">
          <p className="text-2xl font-bold text-white tabular-nums leading-none mb-1">
            {Math.round(props.ydayCalories).toLocaleString()}
            <span className="text-sm font-normal text-white/30 ml-1.5">kcal</span>
          </p>
          {props.ydayBalance != null && (
            <p className={cn('text-sm', props.ydayBalance > 300 ? 'text-[#D97706]' : 'text-white/40')}>
              {props.ydayBalance > 0 ? '+' : ''}{props.ydayBalance.toLocaleString()} balance
            </p>
          )}
          {props.ydayProtein != null && <p className="text-xs text-white/30">{Math.round(props.ydayProtein)}g protein</p>}
          {props.ydayActivityMinutes > 0 && <p className="text-xs text-white/30">{Math.round(props.ydayActivityMinutes)} min active</p>}
        </div>
      ) : (
        <p className="text-sm text-white/25 mb-5">No data</p>
      )}

      {props.trendItems.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-3">Trajectory</p>
          <div className="space-y-1.5 mb-3">
            {props.trendItems.map((item: TrendItem) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className={cn('text-sm font-bold w-4 flex-shrink-0', TREND_DIR_CLS[item.sentiment])}>
                  {TREND_DIR_ICON[item.direction]}
                </span>
                <span className="text-sm text-white/50 truncate">{item.label}</span>
              </div>
            ))}
          </div>
          {props.trendSummaryText && (
            <p className="text-xs text-white/25 leading-relaxed line-clamp-2">{props.trendSummaryText}</p>
          )}
        </div>
      )}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="bg-[#0D0D0D] border-t border-white/8">

      {/* ── MOBILE: tab switcher ──────────────────────────────────────── */}
      <div className="lg:hidden">
        <div className="flex border-b border-white/8">
          {(['intake', 'coffee', 'weight'] as MobileTab[]).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              className={cn(
                'flex-1 py-3 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors',
                mobileTab === tab ? 'text-white' : 'text-white/30 hover:text-white/60',
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="px-5 py-7">
          {mobileTab === 'intake' && intakeJSX}
          {mobileTab === 'coffee' && coffeeJSX}
          {mobileTab === 'weight' && weightJSX}
        </div>
        <div className="px-5 pb-7 border-t border-white/8 pt-5">
          {contextJSX}
        </div>
      </div>

      {/* ── DESKTOP: 4-column console ─────────────────────────────────── */}
      <div className="hidden lg:grid grid-cols-4">
        <div className={colClass}>{intakeJSX}</div>
        <div className={colClass}>{coffeeJSX}</div>
        <div className={colClass}>{weightJSX}</div>
        <div className={lastColClass}>{contextJSX}</div>
      </div>

    </div>
  )
}
