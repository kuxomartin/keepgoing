'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { SOURCE_LABELS, SOURCE_COLORS } from '@/lib/profile/types'
import type { PersonalContextFact, ContextSource } from '@/lib/profile/types'

/** Derive a human-readable one-line value summary from the fact's jsonb value. */
function summarise(fact: PersonalContextFact): string {
  const v = fact.value as Record<string, unknown>

  switch (fact.category) {
    case 'profile':
      if (Array.isArray(v.value)) return (v.value as string[]).join(', ')
      return String(v.value ?? '—')

    case 'goal':
      if (v.value != null) return `${v.value} ${v.unit ?? ''}`.trim()
      if (v.direction) return `${v.direction} ${v.delta_kg} kg`
      return '—'

    case 'food_sensitivity': {
      const action = v.app_action as string ?? '—'
      const labVal = (v.lab_result as Record<string, unknown> | null)?.original_value
      return labVal != null
        ? `${action} · ${labVal} RU`
        : action
    }

    case 'food_observation':
      return `${v.severity ?? '?'} · ${String(v.symptom ?? '').replace(/_/g, ' ')}`

    case 'food_preference':
      return String(v.preference_type ?? '—').replace(/_/g, ' ')

    case 'nutrition_context':
      if (v.note) return String(v.note).slice(0, 80)
      if (v.g_per_kg) return `${v.g_per_kg} g/kg protein target`
      if (v.nutrient) return String(v.nutrient).replace(/_/g, ' ')
      if (v.description) return String(v.description).slice(0, 80)
      if (v.insight) return String(v.insight).replace(/_/g, ' ')
      if (v.meat) return 'Safe food list'
      return '—'

    case 'genetic_context':
      return String(v.category ?? '').replace(/_/g, ' ')

    case 'training_context':
      if (v.note) return String(v.note).slice(0, 80)
      if (v.schedule) return `${(v.schedule as unknown[]).length} day schedule`
      if (v.exercises) return `${(v.exercises as unknown[]).length} exercises`
      if (typeof v.steps === 'number') return `${v.steps} steps/day target`
      return '—'

    case 'bike_fit': {
      const bv = v as Record<string, number | string | unknown>
      if (bv.saddle_height_mm) return `saddle ${bv.saddle_height_mm}mm · reach ${bv.reach_mm}mm`
      if (bv.height_mm) return `height ${bv.height_mm}mm`
      if (bv.name) return String(bv.name)
      if (bv.power_meter) return 'power meter + computer'
      if (bv.hamstrings) return `hamstrings: ${bv.hamstrings}`
      return '—'
    }

    default:
      return JSON.stringify(v).slice(0, 60)
  }
}

function formatKey(key: string): string {
  return key
    .replace(/^(aversion_|tolerated_|nutrient_|insight_)/, '')
    .replace(/_/g, ' ')
}

interface Props {
  fact: PersonalContextFact
}

export function ContextFactRow({ fact }: Props) {
  const [active, setActive] = useState(fact.is_active)
  const [saving, setSaving] = useState(false)

  async function toggleActive() {
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('personal_context_facts')
      .update({ is_active: !active, updated_at: new Date().toISOString() })
      .eq('id', fact.id)
    setActive(a => !a)
    setSaving(false)
  }

  const srcLabel  = SOURCE_LABELS[fact.source as ContextSource] ?? fact.source
  const srcColor  = SOURCE_COLORS[fact.source as ContextSource] ?? 'bg-gray-100 text-gray-500'
  const summary   = summarise(fact)

  return (
    <div className={cn(
      'flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100 last:border-0',
      !active && 'opacity-40',
    )}>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-gray-800 capitalize leading-snug">
          {formatKey(fact.key)}
        </p>
        <p className="text-xs text-gray-500 truncate">{summary}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', srcColor)}>
            {srcLabel}
          </span>
          {fact.confidence && fact.confidence !== 'self_reported' && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              {fact.confidence}
            </span>
          )}
        </div>
      </div>

      {/* Active toggle */}
      <button
        type="button"
        onClick={toggleActive}
        disabled={saving}
        aria-label={active ? 'Deactivate' : 'Activate'}
        className={cn(
          'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors mt-0.5',
          active ? 'bg-blue-600' : 'bg-gray-200',
          saving && 'opacity-50',
        )}
      >
        <span className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
          active ? 'translate-x-4' : 'translate-x-0',
        )} />
      </button>
    </div>
  )
}
