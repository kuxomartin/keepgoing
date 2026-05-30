/**
 * Food-observation context helpers.
 *
 * Keyword matching for detecting personal-context-flagged foods in today's
 * food log. Generates self-attributed, cautious contextual insights.
 *
 * Principles:
 * - Never diagnose. Use "You previously noted…" framing.
 * - Only fire when the trigger food is actually logged today.
 * - No trigger food = silence.
 * - Max 2 food-observation insights per day.
 */

import type { Insight } from '@/lib/insights/types'
import type { PersonalContextSummary } from './context-loader'

// ── Protein target ─────────────────────────────────────────────────────────────

export interface ProteinTarget {
  grams: number
  source: 'profile' | 'default'
  gPerKg?: number      // the ratio from profile, for display
  weightKg?: number    // weight used to compute
}

/**
 * Compute dynamic protein target from personal context + latest weight log.
 * Falls back to defaultG if context or weight is missing.
 */
export function computeProteinTarget(
  context: PersonalContextSummary | undefined,
  latestWeightKg: number | null,
  defaultG = 140,
): ProteinTarget {
  if (!context?.proteinGPerKg || !latestWeightKg) {
    return { grams: defaultG, source: 'default' }
  }
  return {
    grams:    Math.round(context.proteinGPerKg * latestWeightKg),
    source:   'profile',
    gPerKg:   context.proteinGPerKg,
    weightKg: latestWeightKg,
  }
}

// ── Duck meat detection ────────────────────────────────────────────────────────

const DUCK_KEYWORDS = ['duck', 'kačka', 'kačacie', 'kačacieho', 'kačaciu', 'kačicu', 'kačica']

/** Returns true if any food description contains a duck keyword (case-insensitive). */
export function detectDuckMeat(descriptions: string[]): boolean {
  return descriptions.some(d =>
    DUCK_KEYWORDS.some(kw => d.toLowerCase().includes(kw))
  )
}

// ── Evening fruit detection ────────────────────────────────────────────────────

const EVENING_FRUIT_KEYWORDS = [
  'apple', 'jablko',
  'orange', 'pomaranč', 'pomaranc',
  'pomelo',
  'grapefruit',
]

/** Evening starts at 18:00 (hour stored as local-naive HH from ISO string). */
const EVENING_HOUR = 18

/**
 * Returns true if any food entry after 18:00 contains an evening-fruit keyword.
 * eaten_at is stored as local-naive ISO string (e.g. "2024-01-15T19:30:00").
 */
export function detectEveningFruit(
  logs: Array<{ description: string; eaten_at: string | null }>
): boolean {
  return logs.some(log => {
    if (!log.eaten_at) return false
    const hour = parseInt(log.eaten_at.slice(11, 13), 10)
    if (hour < EVENING_HOUR) return false
    const desc = log.description.toLowerCase()
    return EVENING_FRUIT_KEYWORDS.some(kw => desc.includes(kw))
  })
}

// ── Insight generation ─────────────────────────────────────────────────────────

/**
 * Generate food-observation contextual insights.
 * Max 2 returned. Duck has higher priority than evening fruit.
 */
export function generateFoodObservationInsights(opts: {
  duckFound:          boolean
  eveningFruitFound:  boolean
}): Insight[] {
  const insights: Insight[] = []

  if (opts.duckFound) {
    insights.push({
      id:          'food-obs-duck',
      type:        'warning',
      category:    'nutrition',
      headline:    'Duck meat logged — monitor fatigue today',
      explanation: 'You previously noted a strong adverse reaction to duck meat (self-reported). Monitor your energy and fullness over the next few hours.',
      confidence:  'low',
      severity:    'high',
    })
  }

  if (opts.eveningFruitFound && insights.length < 2) {
    insights.push({
      id:          'food-obs-evening-fruit',
      type:        'recommendation',
      category:    'nutrition',
      headline:    'Evening fruit logged — monitor bloating tomorrow',
      explanation: 'You previously noted overnight bloating after eating fruit in the evening (self-reported). Monitor how you feel tomorrow morning.',
      confidence:  'low',
      severity:    'medium',
    })
  }

  return insights
}
