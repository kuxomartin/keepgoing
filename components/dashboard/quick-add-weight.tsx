'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Scale } from 'lucide-react'

export function QuickAddWeight({ onSuccess }: { onSuccess?: () => void }) {
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const kg = parseFloat(weight)
    if (isNaN(kg) || kg <= 0) return

    setLoading(true)
    setMessage('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('weight_logs').insert({
      user_id: user.id,
      date: today,
      weight_kg: kg,
      notes: notes || null,
    })

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('Saved!')
      setWeight('')
      setNotes('')
      onSuccess?.()
      setTimeout(() => setMessage(''), 2000)
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-gray-400" />
          <CardTitle>Log Weight</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            id="weight-kg"
            type="number"
            label="Weight (kg)"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="82.5"
            step="0.1"
            min="30"
            max="300"
            required
          />
          <Input
            id="weight-notes"
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Morning, before breakfast"
          />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </Button>
            {message && <span className="text-xs text-green-600">{message}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
