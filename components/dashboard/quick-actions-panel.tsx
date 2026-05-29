'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Utensils, Scale, ClipboardList, Activity, Coffee } from 'lucide-react'

type ActivePanel = 'weight' | 'checkin' | 'activity' | null

// ── Weight ──────────────────────────────────────────────────────────────────
function WeightForm({ onDone }: { onDone: () => void }) {
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const kg = parseFloat(weight)
    if (isNaN(kg) || kg <= 0) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('weight_logs').insert({ user_id: user.id, date: today, weight_kg: kg, notes: notes || null })
    setSaved(true)
    setLoading(false)
    setTimeout(onDone, 800)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        id="qa-weight" type="number" label="Weight (kg)"
        value={weight} onChange={e => setWeight(e.target.value)}
        placeholder="85.5" step="0.1" min="30" max="300" required
        autoFocus
      />
      <Input
        id="qa-weight-notes" label="Notes (optional)"
        value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Morning, before breakfast"
      />
      <Button type="submit" size="lg" className="w-full" disabled={loading || saved}>
        {saved ? '✓ Saved!' : loading ? 'Saving…' : 'Save weight'}
      </Button>
    </form>
  )
}

// ── Activity ─────────────────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value: 'ride',   label: 'Bike Ride' },
  { value: 'run',    label: 'Run' },
  { value: 'walk',   label: 'Walk' },
  { value: 'gym',    label: 'Gym' },
  { value: 'hike',   label: 'Hike' },
  { value: 'other',  label: 'Other' },
]

function ActivityForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [activityType, setActivityType] = useState('ride')
  const [duration, setDuration] = useState('')
  const [distance, setDistance] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !duration) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    await supabase.from('activities').insert({
      user_id: user.id, source: 'manual',
      activity_type: activityType,
      title: title.trim(),
      start_time: new Date().toISOString(),
      duration_minutes: parseFloat(duration),
      distance_km: distance ? parseFloat(distance) : null,
    })
    setSaved(true)
    setLoading(false)
    setTimeout(onDone, 800)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Select
        id="qa-act-type" label="Type" value={activityType}
        onChange={e => setActivityType(e.target.value)} options={TYPE_OPTIONS}
      />
      <Input
        id="qa-act-title" label="Title"
        value={title} onChange={e => setTitle(e.target.value)}
        placeholder="Morning ride" required autoFocus
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="qa-act-dur" type="number" label="Duration (min)"
          value={duration} onChange={e => setDuration(e.target.value)}
          placeholder="60" min="1" required
        />
        <Input
          id="qa-act-dist" type="number" label="Distance (km)"
          value={distance} onChange={e => setDistance(e.target.value)}
          placeholder="30" step="0.1" min="0"
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={loading || saved}>
        {saved ? '✓ Saved!' : loading ? 'Saving…' : 'Save activity'}
      </Button>
    </form>
  )
}

// ── Check-in (quick 3-slider version) ────────────────────────────────────────
const QUICK_FIELDS = [
  { key: 'energy',   label: 'Energy',   low: 'Exhausted', high: 'Energized' },
  { key: 'stress',   label: 'Stress',   low: 'None',      high: 'High' },
  { key: 'soreness', label: 'Soreness', low: 'None',      high: 'Sore' },
] as const

type QuickField = (typeof QUICK_FIELDS)[number]['key']

function CheckinForm({ onDone }: { onDone: () => void }) {
  const [scores, setScores] = useState<Record<QuickField, number>>({
    energy: 7, stress: 3, soreness: 3,
  })
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('daily_checkins').upsert(
      { user_id: user.id, date: today, ...scores, notes: notes || null },
      { onConflict: 'user_id,date' }
    )
    setSaved(true)
    setLoading(false)
    setTimeout(onDone, 800)
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {QUICK_FIELDS.map(({ key, label, low, high }) => (
        <div key={key} className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-gray-700">{label}</label>
            <span className="text-sm font-bold text-blue-600 w-6 text-center">{scores[key]}</span>
          </div>
          <input
            type="range" min={1} max={10} value={scores[key]}
            onChange={e => setScores(p => ({ ...p, [key]: parseInt(e.target.value) }))}
            className="w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{low}</span><span>{high}</span>
          </div>
        </div>
      ))}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Note</label>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="How do you feel today?"
          rows={2}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 resize-none"
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={loading || saved}>
        {saved ? '✓ Saved!' : loading ? 'Saving…' : 'Save check-in'}
      </Button>
    </form>
  )
}

// ── Panel (mobile-only, hidden on lg+) ───────────────────────────────────────

type PanelButton =
  | { id: 'meal';     label: string; icon: typeof Utensils;      href: string }
  | { id: 'coffee';   label: string; icon: typeof Coffee;        href: string }
  | { id: 'weight';   label: string; icon: typeof Scale;         href?: undefined }
  | { id: 'checkin';  label: string; icon: typeof ClipboardList; href?: undefined }
  | { id: 'activity'; label: string; icon: typeof Activity;      href?: undefined }

const PANEL_BUTTONS: PanelButton[] = [
  { id: 'meal',     label: 'Meal',     icon: Utensils,      href: '/food/add?from=today' },
  { id: 'coffee',   label: 'Coffee',   icon: Coffee,        href: '/coffee/add?from=today' },
  { id: 'weight',   label: 'Weight',   icon: Scale },
  { id: 'checkin',  label: 'Check-in', icon: ClipboardList },
  { id: 'activity', label: 'Activity', icon: Activity },
]

export function QuickActionsPanel() {
  const [active, setActive] = useState<ActivePanel>(null)

  function toggle(panel: ActivePanel) {
    setActive(p => (p === panel ? null : panel))
  }

  return (
    <div className="lg:hidden space-y-3">
      {/* Action strip */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-4 px-4 sm:mx-0 sm:px-0">
        {PANEL_BUTTONS.map(({ id, label, icon: Icon, href }) => {
          const isActive = active === id

          // Meal → navigate to dedicated page
          if (href) {
            return (
              <Link
                key={id}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium',
                  'whitespace-nowrap flex-shrink-0 transition-colors border min-h-[44px]',
                  'bg-white border-gray-200 text-gray-700 active:scale-95'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>+ {label}</span>
              </Link>
            )
          }

          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id as ActivePanel)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium',
                'whitespace-nowrap flex-shrink-0 transition-colors border',
                'min-h-[44px]',
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-700 active:scale-95'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>+ {label}</span>
            </button>
          )
        })}
      </div>

      {/* Expanded form panel */}
      {active && (
        <Card>
          <CardContent className="py-5">
            {active === 'weight'   && <WeightForm   onDone={() => setActive(null)} />}
            {active === 'checkin'  && <CheckinForm  onDone={() => setActive(null)} />}
            {active === 'activity' && <ActivityForm onDone={() => setActive(null)} />}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
