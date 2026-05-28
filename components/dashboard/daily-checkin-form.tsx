'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ClipboardList } from 'lucide-react'

const FIELDS = [
  { key: 'energy', label: 'Energy', low: 'Exhausted', high: 'Energized' },
  { key: 'mood', label: 'Mood', low: 'Low', high: 'Great' },
  { key: 'stress', label: 'Stress', low: 'None', high: 'High stress' },
  { key: 'soreness', label: 'Soreness', low: 'None', high: 'Very sore' },
  { key: 'motivation', label: 'Motivation', low: 'None', high: 'High' },
  { key: 'digestion', label: 'Digestion', low: 'Poor', high: 'Great' },
] as const

type CheckinField = (typeof FIELDS)[number]['key']

export function DailyCheckinForm({ onSuccess }: { onSuccess?: () => void }) {
  const [scores, setScores] = useState<Record<CheckinField, number>>({
    energy: 7, mood: 7, stress: 3, soreness: 3, motivation: 7, digestion: 7,
  })
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  function handleSlider(field: CheckinField, value: number) {
    setScores((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('daily_checkins').upsert(
      {
        user_id: user.id,
        date: today,
        ...scores,
        notes: notes || null,
      },
      { onConflict: 'user_id,date' }
    )

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('Check-in saved!')
      onSuccess?.()
      setTimeout(() => setMessage(''), 2500)
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-gray-400" />
          <CardTitle>Daily Check-in</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {FIELDS.map(({ key, label, low, high }) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">{label}</label>
                <span className="text-sm font-bold text-blue-600 w-6 text-center">
                  {scores[key]}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={scores[key]}
                onChange={(e) => handleSlider(key, parseInt(e.target.value))}
                className="w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>{low}</span>
                <span>{high}</span>
              </div>
            </div>
          ))}

          <div className="space-y-1 pt-1">
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How do you feel today? Anything notable?"
              rows={2}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 resize-none"
            />
          </div>

          <div className="space-y-2">
            <Button type="submit" size="md" className="w-full sm:w-auto" disabled={loading}>
              {loading ? 'Saving…' : 'Submit check-in'}
            </Button>
            {message && (
              <p className="text-sm text-green-600 font-medium">{message}</p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
