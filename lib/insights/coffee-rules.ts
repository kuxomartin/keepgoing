/**
 * Coffee-specific insight rules.
 * These run on today's real-time coffee data rather than historical trends.
 */

import type { Insight } from './types'

export interface CoffeeToday {
  totalCaffeineMg: number | null
  lastCoffeeHour: number | null // parsed from consumed_at as local-naive hour (0–23)
}

export function generateCoffeeInsights(coffee: CoffeeToday): Insight[] {
  const { totalCaffeineMg, lastCoffeeHour } = coffee
  const insights: Insight[] = []

  const highCaffeine = totalCaffeineMg != null && totalCaffeineMg > 400
  const lateCoffee   = lastCoffeeHour != null && lastCoffeeHour >= 15

  // Combined: both high AND late — stronger warning
  if (highCaffeine && lateCoffee) {
    insights.push({
      id: 'coffee-high-and-late',
      type: 'warning',
      category: 'recovery',
      headline: 'High and late caffeine — sleep tonight may be affected',
      explanation: `You've had ${totalCaffeineMg}mg of caffeine today, with the last coffee after 15:00. This combination is likely to delay sleep onset and reduce sleep quality.`,
      confidence: 'high',
      severity: 'high',
    })
    return insights // don't emit the two individual warnings as well
  }

  if (highCaffeine) {
    insights.push({
      id: 'coffee-high-caffeine',
      type: 'warning',
      category: 'recovery',
      headline: `High caffeine today — ${totalCaffeineMg}mg total`,
      explanation: `You've exceeded the typical 400mg daily threshold. Consider switching to water or herbal tea for the rest of the day.`,
      confidence: 'high',
      severity: 'medium',
    })
  }

  if (lateCoffee && !highCaffeine) {
    insights.push({
      id: 'coffee-late',
      type: 'warning',
      category: 'sleep',
      headline: 'Late coffee may affect sleep tonight',
      explanation: `Your last coffee was after 15:00. Caffeine has a 5–6 hour half-life — consider switching to decaf or herbal tea for the remainder of the day.`,
      confidence: 'high',
      severity: 'medium',
    })
  }

  return insights
}
