'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

const TYPE_OPTIONS = [
  { value: 'ride',      label: 'Bike Ride' },
  { value: 'run',       label: 'Run' },
  { value: 'walk',      label: 'Walk' },
  { value: 'hike',      label: 'Hike' },
  { value: 'gym',       label: 'Strength / Gym' },
  { value: 'swim',      label: 'Swimming' },
  { value: 'badminton', label: 'Badminton' },
  { value: 'golf',      label: 'Golf' },
  { value: 'tennis',    label: 'Tennis' },
  { value: 'other',     label: 'Other' },
]

export default function AddActivityPage() {
  const router = useRouter()

  const [title,        setTitle]        = useState('')
  const [activityType, setActivityType] = useState('ride')
  const [duration,     setDuration]     = useState('')
  const [distance,     setDistance]     = useState('')
  const [effort,       setEffort]       = useState('')
  const [note,         setNote]         = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !duration) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); setError('Not authenticated'); return }

    const { error: err } = await supabase.from('activities').insert({
      user_id:          user.id,
      source:           'manual',
      activity_type:    activityType,
      title:            title.trim(),
      start_time:       new Date().toISOString(),
      duration_minutes: parseFloat(duration),
      distance_km:      distance ? parseFloat(distance) : null,
      perceived_effort: effort ? parseInt(effort) : null,
      difficulty_note:  note.trim() || null,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push('/activities')
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 lg:py-10">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/activities"
          className="p-2 -ml-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Add activity manually</h1>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select
              id="act-type"
              label="Activity type"
              value={activityType}
              onChange={e => setActivityType(e.target.value)}
              options={TYPE_OPTIONS}
            />
            <Input
              id="act-title"
              label="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Morning gym session"
              required
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="act-duration"
                type="number"
                label="Duration (min)"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                placeholder="60"
                min="1"
                required
              />
              <Input
                id="act-distance"
                type="number"
                label="Distance (km)"
                value={distance}
                onChange={e => setDistance(e.target.value)}
                placeholder="optional"
                step="0.1"
                min="0"
              />
            </div>
            <Input
              id="act-effort"
              type="number"
              label="Perceived effort (1–10)"
              value={effort}
              onChange={e => setEffort(e.target.value)}
              placeholder="optional"
              min="1"
              max="10"
            />
            <div className="space-y-1.5">
              <label htmlFor="act-note" className="text-sm font-medium text-gray-700">
                Note (optional)
              </label>
              <textarea
                id="act-note"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="How did it feel? Any details..."
                rows={2}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-300 resize-y"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Saving…' : 'Save activity'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
