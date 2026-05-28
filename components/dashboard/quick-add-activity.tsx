'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Activity } from 'lucide-react'

const TYPE_OPTIONS = [
  { value: 'ride', label: 'Bike Ride' },
  { value: 'run', label: 'Run' },
  { value: 'walk', label: 'Walk' },
  { value: 'badminton', label: 'Badminton' },
  { value: 'golf', label: 'Golf' },
  { value: 'gym', label: 'Strength / Gym' },
  { value: 'hike', label: 'Hike' },
  { value: 'other', label: 'Other' },
]

export function QuickAddActivity({ onSuccess }: { onSuccess?: () => void }) {
  const [title, setTitle] = useState('')
  const [activityType, setActivityType] = useState('ride')
  const [duration, setDuration] = useState('')
  const [distance, setDistance] = useState('')
  const [effort, setEffort] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !duration) return

    setLoading(true)
    setMessage('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { error } = await supabase.from('activities').insert({
      user_id: user.id,
      source: 'manual',
      activity_type: activityType,
      title: title.trim(),
      start_time: new Date().toISOString(),
      duration_minutes: parseFloat(duration),
      distance_km: distance ? parseFloat(distance) : null,
      perceived_effort: effort ? parseInt(effort) : null,
    })

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('Saved!')
      setTitle('')
      setDuration('')
      setDistance('')
      setEffort('')
      onSuccess?.()
      setTimeout(() => setMessage(''), 2000)
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-gray-400" />
          <CardTitle>Log Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            id="act-title"
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Morning ride"
            required
          />
          <Select
            id="act-type"
            label="Type"
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            options={TYPE_OPTIONS}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              id="act-duration"
              type="number"
              label="Duration (min)"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
              min="1"
              required
            />
            <Input
              id="act-distance"
              type="number"
              label="Distance (km)"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="30"
              step="0.1"
              min="0"
            />
            <Input
              id="act-effort"
              type="number"
              label="Effort (1–10)"
              value={effort}
              onChange={(e) => setEffort(e.target.value)}
              placeholder="7"
              min="1"
              max="10"
            />
          </div>
          <div className="space-y-2">
            <Button type="submit" size="md" className="w-full sm:w-auto" disabled={loading}>
              {loading ? 'Saving…' : 'Save activity'}
            </Button>
            {message && <p className="text-sm text-green-600">{message}</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
