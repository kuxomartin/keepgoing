'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ── Emoji scales ───────────────────────────────────────────────────────────────
const FEELING_OPTS = [
  { emoji: '😫', label: 'Rough',  value: 2  },
  { emoji: '😕', label: 'Low',    value: 4  },
  { emoji: '😐', label: 'Okay',   value: 6  },
  { emoji: '🙂', label: 'Good',   value: 8  },
  { emoji: '🚀', label: 'Great',  value: 10 },
]
const BODY_OPTS = [
  { emoji: '😌', label: 'Fresh',   value: 1  },
  { emoji: '🙂', label: 'Good',    value: 3  },
  { emoji: '😐', label: 'Okay',    value: 5  },
  { emoji: '😖', label: 'Sore',    value: 7  },
  { emoji: '🪵', label: 'Wrecked', value: 10 },
]
const DIGESTION_OPTS = [
  { emoji: '😌', label: 'Great', value: 10 },
  { emoji: '🙂', label: 'Good',  value: 8  },
  { emoji: '😐', label: 'Okay',  value: 6  },
  { emoji: '😖', label: 'Off',   value: 3  },
  { emoji: '🤢', label: 'Poor',  value: 1  },
]

function closestIdx(opts: { value: number }[], dbVal: number | null): number {
  if (dbVal == null) return 2
  let best = 0, bestDist = Infinity
  opts.forEach((o, i) => {
    const d = Math.abs(o.value - dbVal)
    if (d < bestDist) { bestDist = d; best = i }
  })
  return best
}

function labelFrom(opts: { emoji: string; label: string; value: number }[], dbVal: number | null) {
  if (dbVal == null) return '—'
  const opt = opts[closestIdx(opts, dbVal)]
  return `${opt.emoji} ${opt.label}`
}

interface ExistingCheckin {
  energy: number | null
  soreness: number | null
  digestion: number | null
  notes: string | null
}

interface Props {
  existingCheckin: ExistingCheckin | null
}

export function CheckinPanel({ existingCheckin }: Props) {
  const router = useRouter()

  const [view,    setView]    = useState<'summary' | 'form'>(existingCheckin ? 'summary' : 'summary')
  const [saving,  setSaving]  = useState(false)
  const [feelIdx, setFeelIdx] = useState(closestIdx(FEELING_OPTS,   existingCheckin?.energy    ?? null))
  const [bodyIdx, setBodyIdx] = useState(closestIdx(BODY_OPTS,      existingCheckin?.soreness  ?? null))
  const [digIdx,  setDigIdx]  = useState(closestIdx(DIGESTION_OPTS, existingCheckin?.digestion ?? null))
  const [notes,   setNotes]   = useState(existingCheckin?.notes ?? '')

  // Track saved values for summary display
  const [savedEnergy,  setSavedEnergy]  = useState(existingCheckin?.energy    ?? null)
  const [savedSore,    setSavedSore]    = useState(existingCheckin?.soreness  ?? null)
  const [savedDig,     setSavedDig]     = useState(existingCheckin?.digestion ?? null)

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const today = new Date().toISOString().slice(0, 10)
      const energy    = FEELING_OPTS[feelIdx].value
      const soreness  = BODY_OPTS[bodyIdx].value
      const digestion = DIGESTION_OPTS[digIdx].value

      await supabase.from('daily_checkins').upsert(
        { user_id: user.id, date: today, energy, soreness, digestion, notes: notes || null },
        { onConflict: 'user_id,date' }
      )

      setSavedEnergy(energy)
      setSavedSore(soreness)
      setSavedDig(digestion)
      setView('summary')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  // ── SUMMARY VIEW ─────────────────────────────────────────────────────────────
  if (view === 'summary') {
    const hasData = savedEnergy != null || savedSore != null || savedDig != null
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.12em]">Check-in</p>
          <button
            onClick={() => setView('form')}
            className="text-[10px] text-white/30 hover:text-white/60 uppercase tracking-[0.12em] transition-colors"
          >
            {hasData ? 'Edit' : 'Log →'}
          </button>
        </div>

        {hasData ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/25 uppercase tracking-[0.1em] w-16">Feeling</span>
              <span className="text-sm text-white/70">{labelFrom(FEELING_OPTS, savedEnergy)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/25 uppercase tracking-[0.1em] w-16">Body</span>
              <span className="text-sm text-white/70">{labelFrom(BODY_OPTS, savedSore)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/25 uppercase tracking-[0.1em] w-16">Digestion</span>
              <span className="text-sm text-white/70">{labelFrom(DIGESTION_OPTS, savedDig)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/25 italic">Not logged yet</p>
        )}
      </div>
    )
  }

  // ── FORM VIEW ─────────────────────────────────────────────────────────────────
  function EmojiRow({
    label, opts, selectedIdx, onSelect,
  }: {
    label: string
    opts: { emoji: string; label: string; value: number }[]
    selectedIdx: number
    onSelect: (i: number) => void
  }) {
    return (
      <div className="mb-3">
        <p className="text-[9px] text-white/25 uppercase tracking-[0.1em] mb-1.5">{label}</p>
        <div className="flex gap-1">
          {opts.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              title={opt.label}
              className={cn(
                'flex-1 text-center py-1 text-base transition-all',
                selectedIdx === i ? 'opacity-100' : 'opacity-25 hover:opacity-60',
              )}
            >
              {opt.emoji}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-white/30 text-center mt-0.5">{opts[selectedIdx].label}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.12em]">Check-in</p>
        <button
          onClick={() => setView('summary')}
          className="text-[10px] text-white/30 hover:text-white/60 uppercase tracking-[0.12em] transition-colors"
        >
          Cancel
        </button>
      </div>

      <EmojiRow label="Feeling"   opts={FEELING_OPTS}   selectedIdx={feelIdx} onSelect={setFeelIdx} />
      <EmojiRow label="Body"      opts={BODY_OPTS}       selectedIdx={bodyIdx} onSelect={setBodyIdx} />
      <EmojiRow label="Digestion" opts={DIGESTION_OPTS}  selectedIdx={digIdx}  onSelect={setDigIdx}  />

      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full bg-transparent text-xs text-white/60 placeholder-white/20 border-0 border-b border-white/10 focus:border-white/30 focus:outline-none resize-none pb-1 mt-1 mb-3"
      />

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="text-[10px] font-bold text-white/60 hover:text-white uppercase tracking-[0.15em] transition-colors disabled:opacity-30"
      >
        {saving ? 'Saving…' : 'Save check-in'}
      </button>
    </div>
  )
}
