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

// ── Form ──────────────────────────────────────────────────────────────────────

export function DailyCheckinForm({ onSuccess }: { onSuccess?: () => void }) {
  const [feelingIdx,   setFeelingIdx]   = useState(2)   // 😐 default
  const [bodyIdx,      setBodyIdx]      = useState(1)   // 🙂 default
  const [digestionIdx, setDigestionIdx] = useState(1)   // 🙂 default
  const [notes,   setNotes]   = useState('')
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const [skipped, setSkipped] = useState(false)

  // Dismissed for this session
  if (skipped) return null

  // Saved state
  if (done) {
    return (
      <div className="border-t border-gray-100 dark:border-zinc-800 pt-5">
        <p className="text-xs text-gray-400 dark:text-zinc-600">
          Morning check-in saved ✓
        </p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('daily_checkins').upsert(
      {
        user_id:    user.id,
        date:       today,
        energy:     FEELING[feelingIdx].value,
        soreness:   BODY[bodyIdx].value,
        digestion:  DIGESTION[digestionIdx].value,
        mood:       null,
        stress:     null,
        motivation: null,
        notes:      notes || null,
      },
      { onConflict: 'user_id,date' },
    )

    setLoading(false)
    if (!error) {
      setDone(true)
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
          <button
            type="button"
            onClick={() => setSkipped(true)}
            className="text-sm text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors"
          >
            Skip today
          </button>
        </div>
      </form>
    </div>
  )
}
