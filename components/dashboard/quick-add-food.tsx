'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Utensils } from 'lucide-react'

const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
  { value: 'other', label: 'Other' },
]

export function QuickAddFood({ onSuccess }: { onSuccess?: () => void }) {
  const [mealType, setMealType] = useState('breakfast')
  const [description, setDescription] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return

    setLoading(true)
    setMessage('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('food_logs').insert({
      user_id: user.id,
      date: today,
      meal_type: mealType,
      description: description.trim(),
      estimated_calories: calories ? parseInt(calories) : null,
      protein_g: protein ? parseFloat(protein) : null,
    })

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('Saved!')
      setDescription('')
      setCalories('')
      setProtein('')
      onSuccess?.()
      setTimeout(() => setMessage(''), 2000)
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Utensils className="h-4 w-4 text-gray-400" />
          <CardTitle>Log Food</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Select
            id="meal-type"
            label="Meal"
            value={mealType}
            onChange={(e) => setMealType(e.target.value)}
            options={MEAL_OPTIONS}
          />
          <Input
            id="food-desc"
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Oats with banana and honey"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              id="food-cal"
              type="number"
              label="Calories"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="380"
              min="0"
            />
            <Input
              id="food-protein"
              type="number"
              label="Protein (g)"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              placeholder="12"
              min="0"
              step="0.5"
            />
          </div>
          <div className="space-y-2">
            <Button type="submit" size="md" className="w-full sm:w-auto" disabled={loading}>
              {loading ? 'Saving…' : 'Save meal'}
            </Button>
            {message && <p className="text-sm text-green-600">{message}</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
