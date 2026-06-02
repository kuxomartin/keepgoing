'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { estimateCaffeine } from '@/lib/coffee/types'
import { cn } from '@/lib/utils'

// ── Coffee options — hardware controls ────────────────────────────────────────
const COFFEE_OPTIONS = [
  { key: 'filter_225',           label: 'FILTER 225',  mg: 165 },
  { key: 'filter_300',           label: 'FILTER 300',  mg: 220 },
  { key: 'espresso_office',      label: 'ESPRESSO',    mg: 75  },
  { key: 'espresso_home_double', label: 'DOUBLE',      mg: 150 },
  { key: 'capsule',              label: 'CAPSULE',     mg: 60  },
  { key: 'decaf',                label: 'DECAF',       mg: 5   },
] as const

// ── Meal types ─────────────────────────────────────────────────────────────────
const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch',     label: 'Lunch'     },
  { key: 'dinner',    label: 'Dinner'    },
  { key: 'snack',     label: 'Snack'     },
]

// ── Mobile tab type ────────────────────────────────────────────────────────────
type MobileTab = 'food' | 'coffee' | 'weight'

// ═════════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════════

export function LoggingConsole({ currentWeight }: { currentWeight?: number | null }) {
  const router = useRouter()

  // Mobile tab
  const [mobileTab, setMobileTab] = useState<MobileTab>('coffee')

  // ── Food ──────────────────────────────────────────────────────────────────
  const [mealType,   setMealType]   = useState('breakfast')
  const [foodDesc,   setFoodDesc]   = useState('')
  const [estimating, setEstimating] = useState(false)
  const [estimate,   setEstimate]   = useState<{ calories: number; protein: number } | null>(null)
  const [foodStatus, setFoodStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

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
    if (!foodDesc.trim()) return
    setFoodStatus('saving')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setFoodStatus('idle'); return }
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('food_logs').insert({
      user_id: user.id,
      date: today,
      meal_type: mealType,
      description: foodDesc,
      estimated_calories: estimate?.calories ?? null,
      protein_g: estimate?.protein ?? null,
      eaten_at: new Date().toISOString(),
    })
    setFoodStatus('saved')
    setFoodDesc('')
    setEstimate(null)
    setTimeout(() => { setFoodStatus('idle'); router.refresh() }, 1800)
  }

  // ── Coffee ─────────────────────────────────────────────────────────────────
  const [coffeeLogged, setCoffeeLogged] = useState<string | null>(null)

  async function logCoffee(key: string, mg: number) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const pad  = (n: number) => String(n).padStart(2, '0')
    const consumed_at = `${date}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`
    await supabase.from('coffee_logs').insert({
      user_id: user.id,
      date,
      consumed_at,
      coffee_type: key,
      cups: 1,
      caffeine_mg: mg,
      notes: null,
    })
    setCoffeeLogged(key)
    router.refresh()
    setTimeout(() => setCoffeeLogged(null), 2500)
  }

  // ── Weight ─────────────────────────────────────────────────────────────────
  const [weightEditing, setWeightEditing] = useState(false)
  const [weightVal,     setWeightVal]     = useState(currentWeight ? currentWeight.toFixed(1) : '')
  const [weightStatus,  setWeightStatus]  = useState<'idle' | 'saved'>('idle')
  const weightInputRef = useRef<HTMLInputElement>(null)

  function openWeightEdit() {
    setWeightEditing(true)
    setWeightStatus('idle')
    setTimeout(() => {
      weightInputRef.current?.focus()
      weightInputRef.current?.select()
    }, 30)
  }

  async function saveWeight() {
    const kg = parseFloat(weightVal)
    if (isNaN(kg) || kg < 20 || kg > 400) { setWeightEditing(false); return }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setWeightEditing(false); return }
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('weight_logs').insert({ user_id: user.id, date: today, weight_kg: kg })
    setWeightEditing(false)
    setWeightStatus('saved')
    setTimeout(() => { setWeightStatus('idle'); router.refresh() }, 2000)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Column renderers (shared between desktop grid and mobile tabs)
  // ═══════════════════════════════════════════════════════════════════════════

  const FoodColumn = () => (
    <div className="flex flex-col">
      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-6">
        + Food
      </p>

      {/* Meal type — text toggles, no borders, no pills */}
      <div className="flex gap-5 mb-7">
        {MEAL_TYPES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMealType(key)}
            className={cn(
              'text-sm transition-colors',
              mealType === key
                ? 'text-white font-semibold'
                : 'text-white/35 hover:text-white/60',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Ghost textarea — bottom rule only */}
      <textarea
        value={foodDesc}
        onChange={e => { setFoodDesc(e.target.value); setEstimate(null) }}
        placeholder="What did you eat?"
        rows={3}
        className={cn(
          'w-full bg-transparent text-base text-white placeholder-white/25',
          'border-0 border-b border-white/15 focus:border-white/40 focus:outline-none',
          'resize-none pb-2 transition-colors leading-relaxed',
        )}
      />

      {/* Estimate / result */}
      <div className="mt-3 mb-6 h-4">
        {estimate ? (
          <p className="text-xs text-white/50">
            {estimate.calories} kcal · {estimate.protein}g protein
          </p>
        ) : (
          <button
            onClick={runEstimate}
            disabled={!foodDesc.trim() || estimating}
            className="text-xs text-white/35 hover:text-white/60 transition-colors disabled:opacity-20"
          >
            {estimating ? 'Estimating…' : 'Estimate calories →'}
          </button>
        )}
      </div>

      {/* Log Entry — text action, not a button shape */}
      {foodStatus === 'saved' ? (
        <p className="text-xs font-bold text-[#16A34A] uppercase tracking-[0.15em]">Logged ✓</p>
      ) : (
        <button
          onClick={logFood}
          disabled={!foodDesc.trim() || foodStatus === 'saving'}
          className={cn(
            'text-xs font-bold uppercase tracking-[0.15em] transition-colors text-left',
            'text-white/60 hover:text-white disabled:opacity-20',
          )}
        >
          {foodStatus === 'saving' ? 'Logging…' : 'Log Entry'}
        </button>
      )}
    </div>
  )

  const CoffeeColumn = () => (
    <div className="flex flex-col">
      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-6">
        + Coffee
      </p>

      {coffeeLogged ? (
        <div className="flex items-center gap-3">
          <p className="text-base font-semibold text-white">
            ☕ {COFFEE_OPTIONS.find(o => o.key === coffeeLogged)?.label}
          </p>
          <p className="text-xs text-[#16A34A] font-bold uppercase tracking-widest">logged ✓</p>
        </div>
      ) : (
        /* Hardware-like controls — 2 per row */
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          {COFFEE_OPTIONS.map(({ key, label, mg }) => (
            <button
              key={key}
              onClick={() => logCoffee(key, mg)}
              className={cn(
                'text-left text-sm font-medium transition-all py-1.5 px-2',
                'text-white/45 hover:bg-white hover:text-[#0D0D0D]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* More options link */}
      {!coffeeLogged && (
        <a
          href="/coffee/add?from=today"
          className="mt-5 text-xs text-white/25 hover:text-white/50 transition-colors"
        >
          More options →
        </a>
      )}
    </div>
  )

  const WeightColumn = () => (
    <div className="flex flex-col">
      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-6">
        + Weight
      </p>

      {weightStatus === 'saved' ? (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-white font-mono tabular-nums leading-none"
                  style={{ fontSize: '3rem' }}>
              {weightVal}
            </span>
            <span className="text-sm text-white/30">kg</span>
          </div>
          <p className="text-xs font-bold text-[#16A34A] uppercase tracking-[0.12em] mt-3">Saved ✓</p>
        </div>
      ) : weightEditing ? (
        <div>
          <div className="flex items-baseline gap-2 border-b border-white/25 pb-1">
            <input
              ref={weightInputRef}
              type="number"
              step="0.1"
              value={weightVal}
              onChange={e => setWeightVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveWeight()
                if (e.key === 'Escape') setWeightEditing(false)
              }}
              onBlur={saveWeight}
              className={cn(
                'font-bold text-white font-mono tabular-nums leading-none',
                'bg-transparent border-0 focus:outline-none w-32',
              )}
              style={{ fontSize: '3rem' }}
            />
            <span className="text-sm text-white/30">kg</span>
          </div>
          <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mt-3">
            Enter to save · Esc to cancel
          </p>
        </div>
      ) : (
        <button onClick={openWeightEdit} className="text-left group">
          <div className="flex items-baseline gap-2">
            <span
              className="font-bold font-mono tabular-nums leading-none transition-colors group-hover:text-white/60"
              style={{ fontSize: '3rem', color: weightVal ? 'white' : 'rgba(255,255,255,0.2)' }}
            >
              {weightVal || '——'}
            </span>
            <span className="text-sm text-white/30">kg</span>
          </div>
          <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mt-3 group-hover:text-white/40 transition-colors">
            KG · Tap to edit
          </p>
        </button>
      )}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="bg-[#20252B] border-t border-white/8">

      {/* ── MOBILE: tab switcher ─────────────────────────────────────────── */}
      <div className="lg:hidden">
        {/* Tab strip */}
        <div className="flex border-b border-white/8">
          {(['food', 'coffee', 'weight'] as MobileTab[]).map(tab => (
            <button
              key={tab}
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
        {/* Active tab content */}
        <div className="px-5 py-7">
          {mobileTab === 'food'   && <FoodColumn />}
          {mobileTab === 'coffee' && <CoffeeColumn />}
          {mobileTab === 'weight' && <WeightColumn />}
        </div>
      </div>

      {/* ── DESKTOP: three-column console ────────────────────────────────── */}
      <div className="hidden lg:grid grid-cols-3">
        <div className="px-10 py-10 border-r border-white/8">
          <FoodColumn />
        </div>
        <div className="px-10 py-10 border-r border-white/8">
          <CoffeeColumn />
        </div>
        <div className="px-10 py-10">
          <WeightColumn />
        </div>
      </div>

    </div>
  )
}
