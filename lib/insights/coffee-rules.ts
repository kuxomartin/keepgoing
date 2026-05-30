/**
 * Coffee-specific insight rules.
 * These run on today's real-time coffee data rather than historical trends.
 */

import type { Insight } from './types'

export interface CoffeeToday {
  totalCaffeineMg:      number | null
  lastCoffeeHour:       number | null  // local-naive hour (0–23)
  /** From personal_context_facts — coffee flagged in IgG test. Never alarmist. */
  hasCoffeeSensitivity?: boolean
}

const IGG_NOTE =
  'Your profile also notes coffee in your uploaded IgG context (2022). ' +
  'You reported no clear perceived reaction — treat this as monitoring context, not a restriction.'

export function generateCoffeeInsights(coffee: CoffeeToday): Insight[] {
  const { totalCaffeineMg, lastCoffeeHour, hasCoffeeSensitivity } = coffee
  const insights: Insight[] = []

  const highCaffeine = totalCaffeineMg != null && totalCaffeineMg > 400
  const lateCoffee   = lastCoffeeHour  != null && lastCoffeeHour  >= 15
  const iggNote      = hasCoffeeSensitivity ? ` ${IGG_NOTE}` : ''

  // Combined: both high AND late — strongest warning
  if (highCaffeine && lateCoffee) {
    insights.push({
      id:          'coffee-high-and-late',
      type:        'warning',
      category:    'recovery',
      headline:    'High and late caffeine — sleep tonight may be affected',
      explanation: `You've had ${totalCaffeineMg}mg of caffeine today, with the last coffee after 15:00. This combination is likely to delay sleep onset and reduce sleep quality.${iggNote}`,
      confidence:  'high',
      severity:    'high',
    })
    return insights
  }

  if (highCaffeine) {
    insights.push({
      id:          'coffee-high-caffeine',
      type:        'warning',
      category:    'recovery',
      headline:    `High caffeine today — ${totalCaffeineMg}mg total`,
      explanation: `You've exceeded the typical 400mg daily threshold. Consider switching to water or herbal tea for the rest of the day.${iggNote}`,
      confidence:  'high',
      severity:    'medium',
    })
  }

  if (lateCoffee && !highCaffeine) {
    insights.push({
      id:          'coffee-late',
      type:        'warning',
      category:    'sleep',
      headline:    'Late coffee may affect sleep tonight',
      explanation: 'Your last coffee was after 15:00. Caffeine has a 5–6 hour half-life — consider switching to decaf or herbal tea for the remainder of the day.',
      confidence:  'high',
      severity:    'medium',
    })
  }

  return insights
}
