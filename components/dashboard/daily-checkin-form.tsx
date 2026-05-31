'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ── Emoji scales — each maps to a DB numeric value ────────────────────────────

const FEELING = [
  { emoji: '😫', value: 2,  label: 'Rough' },
  { emoji: '😕', value: 4,  label: 'Low'   },
  { emoji: '😐', value: 6,  label: 'Okay'  },
  { emoji: '🙂', value: 8,  label: 'Good'  },
  { emoji: '🚀', value: 10, label: 'Great' },
] as const

const BODY = [
  { emoji: '😌', value: 1,  label: 'Fresh'   },
  { emoji: '🙂', value: 3,  label: 'Good'    },
  { emoji: '😐', value: 5,  label: 'Okay'    },
  { emoji: '😖', value: 7,  label: 'Sore'    },
  { emoji: '🪵', value: 10, label: 'Wrecked' },
] as const

const DIGESTION = [
  { emoji: '😌', value: 10, label: 'Great' },
  { emoji: '🙂', value: 8,  label: 'Good'  },
  { emoji: '😐', value: 6,  label: 'Okay'  },
  { emoji: '😖', value: 3,  label: 'Off'   },
  { emoji: '🤢', value: 1,  label: 'Poor'  },
] as const

type Scale = typeof FEELING | typeof BODY | typeof DIGESTION

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find closest item in scale to a stored DB value. */
function closestIndex(scale: Scale, dbValue: number | null): number {
  if (dbValue == null) return Math.floor(scale.length / 2)
  let best = 0
  let bestDist = Infinity
  scale.forEach((item, i) => {
    const dist = Math.abs(item.value - dbValue)
    if (dist < bestDist) { bestDist = dist; best = i }
  })
  return best
}

function labelFor(scale: Scale, dbValue: number | null): string {
  if (dbValue == null) return '—'
  return scale[closestIndex(scale, dbValue)].label
}

function emojiFor(scale: Scale, dbValue: number | null): string {
  if (dbValue == null) return '—'
  return scale[closestIndex(scale, dbValue)].emoji
}

// ── Emoji row ─────────────────────────────────────────────────────────────────

function EmojiRow({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string
  items: readonly { emoji: string; value: number; label: string }[]
  selected: number
  onSelect: (idx: number) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
        {label}
      </p>
      <div className="flex items-end gap-1">
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={item.label}
            aria-pressed={selected === i}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-2xl transition-all duration-100',
              selected === i
                ? 'bg-gray-100 dark:bg-zinc-800'
                : 'opacity-40 hover:opacity-70 hover:bg-gray-50 dark:hover:bg-zinc-900',
            )}
          >
            <span>{item.emoji}</span>
            <span className={cn(
              'text-[9px] font-semibold uppercase tracking-widest transition-opacity',
              selected === i
                ? 'text-gray-500 dark:text-zinc-400 opacity-100'
                : 'opacity-0',
            )}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Summary (read-only completed state) ───────────────────────────────────────

function CheckinSummary({
  energy,
  soreness,
  digestion,
  onEdit,
}: {
  energy:    number | null
  soreness:  number | null
  digestion: number | null
  onEdit: () => void
}) {
  return (
    <div className="border-t border-gray-100 dark:border-zinc-800 pt-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
          Morning Check-in
        </p>
        <span className="text-[10px] font-semibold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest">
          Logged today ✓
        </span>
      </div>

      <div className="space-y-1.5 mb-4">
        <SummaryRow label="Feeling"   emoji={emojiFor(FEELING,   energy)}    value={labelFor(FEELING,   energy)}    />
        <SummaryRow label="Body"      emoji={emojiFor(BODY,      soreness)}  value={labelFor(BODY,      soreness)}  />
        <SummaryRow label="Digestion" emoji={emojiFor(DIGESTION, digestion)} value={labelFor(DIGESTION, digestion)} />
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="text-sm text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors"
      >
        Edit check-in
      </button>
    </div>
  )
}

function SummaryRow({ label, emoji, value }: { label: string; emoji: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 text-xs text-gray-400 dark:text-zinc-500">{label}</span>
      <span>{emoji}</span>
      <span className="text-gray-700 dark:text-zinc-300">{value}</span>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ExistingCheckin {
  energy:    number | null
  soreness:  number | null
  digestion: number | null
  notes:     string | null
}

// ── Form ──────────────────────────────────────────────────────────────────────

export function DailyCheckinForm({
  existingCheckin,
  onSuccess,
}: {
  existingCheckin?: ExistingCheckin | null
  onSuccess?: () => void
}) {
  // Determine initial indices from existing check-in or defaults
  const initFeelingIdx   = existingCheckin ? closestIndex(FEELING,   existingCheckin.energy)    : 2
  const initBodyIdx      = existingCheckin ? closestIndex(BODY,      existingCheckin.soreness)  : 1
  const initDigestionIdx = existingCheckin ? closestIndex(DIGESTION, existingCheckin.digestion) : 1
  const initNotes        = existingCheckin?.notes ?? ''

  // View state: 'summary' | 'form' | 'skipped'
  // If check-in already exists → start in summary
  const [view,         setView]         = useState<'summary' | 'form' | 'skipped'>(
    existingCheckin ? 'summary' : 'form'
  )
  const [feelingIdx,   setFeelingIdx]   = useState(initFeelingIdx)
  const [bodyIdx,      setBodyIdx]      = useState(initBodyIdx)
  const [digestionIdx, setDigestionIdx] = useState(initDigestionIdx)
  const [notes,        setNotes]        = useState(initNotes)
  const [loading,      setLoading]      = useState(false)
  // Snapshot of last-saved values to show in summary
  const [savedEnergy,    setSavedEnergy]    = useState<number | null>(existingCheckin?.energy    ?? null)
  const [savedSoreness,  setSavedSoreness]  = useState<number | null>(existingCheckin?.soreness  ?? null)
  const [savedDigestion, setSavedDigestion] = useState<number | null>(existingCheckin?.digestion ?? null)

  // Dismissed for this session
  if (view === 'skipped') return null

  // Show read-only summary
  if (view === 'summary') {
    return (
      <CheckinSummary
        energy={savedEnergy}
        soreness={savedSoreness}
        digestion={savedDigestion}
        onEdit={() => setView('form')}
      />
    )
  }

  // ── Form view ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const today = new Date().toISOString().slice(0, 10)
    const energyVal    = FEELING[feelingIdx].value
    const sorenessVal  = BODY[bodyIdx].value
    const digestionVal = DIGESTION[digestionIdx].value

    const { error } = await supabase.from('daily_checkins').upsert(
      {
        user_id:    user.id,
        date:       today,
        energy:     energyVal,
        soreness:   sorenessVal,
        digestion:  digestionVal,
        mood:       null,
        stress:     null,
        motivation: null,
        notes:      notes || null,
      },
      { onConflict: 'user_id,date' },
    )

    setLoading(false)
    if (!error) {
      // Persist saved values so summary can display them without a page reload
      setSavedEnergy(energyVal)
      setSavedSoreness(sorenessVal)
      setSavedDigestion(digestionVal)
      setView('summary')
      onSuccess?.()
    }
  }

  return (
    <div className="border-t border-gray-100 dark:border-zinc-800 pt-5">
      <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-5">
        Morning Check-in
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <EmojiRow
          label="How do you feel?"
          items={FEELING}
          selected={feelingIdx}
          onSelect={setFeelingIdx}
        />
        <EmojiRow
          label="Body"
          items={BODY}
          selected={bodyIdx}
          onSelect={setBodyIdx}
        />
        <EmojiRow
          label="Digestion"
          items={DIGESTION}
          selected={digestionIdx}
          onSelect={setDigestionIdx}
        />

        {/* Optional note */}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes? (optional)"
          rows={2}
          className="w-full rounded-xl border border-gray-100 dark:border-zinc-800 bg-transparent px-4 py-3 text-sm text-gray-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 placeholder:text-gray-300 dark:placeholder:text-zinc-600 resize-none"
        />

        {/* Actions */}
        <div className="flex items-center gap-5">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold rounded-xl hover:bg-gray-700 dark:hover:bg-zinc-200 transition-colors disabled:opacity-40"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
          {/* Only show Skip if there's no existing check-in being edited */}
          {!existingCheckin && (
            <button
              type="button"
              onClick={() => setView('skipped')}
              className="text-sm text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors"
            >
              Skip today
            </button>
          )}
          {/* When editing existing, show cancel instead */}
          {existingCheckin && (
            <button
              type="button"
              onClick={() => setView('summary')}
              className="text-sm text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
