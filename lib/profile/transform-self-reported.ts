/**
 * Transforms martin_self_reported.json into PersonalContextFactInput[].
 *
 * Self-reported observations are labelled source='self_reported' and
 * confidence='self_reported'. They reflect lived experience and can be
 * used more directly in insights than lab or DNA data — but must always
 * be attributed ("You previously noted…").
 */

import type { PersonalContextFactInput } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>

export function transformSelfReported(raw: unknown): PersonalContextFactInput[] {
  const facts: PersonalContextFactInput[] = []
  const sr: AnyObj =
    (raw as AnyObj).user_self_reported_observations ?? (raw as AnyObj)

  // ── Confirmed reactions → food_observation ────────────────────────────────────
  for (const r of sr.confirmed_reactions ?? []) {
    if (!r.item || !r.user_confirmed) continue

    facts.push({
      category: 'food_observation',
      key:      r.item,
      value: {
        label:              r.label,
        symptom:            r.symptom,
        severity:           r.severity,
        threshold:          r.threshold ?? null,
        trigger_conditions: r.trigger_conditions ?? null,
        user_description:   r.user_description,
        user_confirmed:     r.user_confirmed,
        note:               r.note ?? null,
      },
      source:     'self_reported',
      confidence: 'self_reported',
    })
  }

  // ── Natural aversions → food_preference ──────────────────────────────────────
  for (const a of sr.natural_aversions ?? []) {
    if (!a.item) continue

    facts.push({
      category: 'food_preference',
      key:      `aversion_${a.item}`,
      value: {
        item:             a.item,
        label:            a.label,
        preference_type:  'natural_aversion',
        user_description: a.user_description,
        note:             a.note ?? null,
      },
      source:     'self_reported',
      confidence: 'self_reported',
    })
  }

  // ── Tolerated items → food_preference ────────────────────────────────────────
  for (const t of sr.tolerated_items ?? []) {
    if (!t.item) continue

    facts.push({
      category: 'food_preference',
      key:      `tolerated_${t.item}`,
      value: {
        item:             t.item,
        label:            t.label,
        preference_type:  'tolerated',
        user_description: t.user_description,
        note:             t.note ?? null,
      },
      source:     'self_reported',
      confidence: 'self_reported',
    })
  }

  // ── Key insights → nutrition_context ──────────────────────────────────────────
  for (const i of sr.key_insights_from_conversation ?? []) {
    if (!i.insight) continue

    facts.push({
      category: 'nutrition_context',
      key:      `insight_${i.insight}`,
      value: {
        insight:     i.insight,
        description: i.description,
        user_quote:  i.user_quote ?? null,
      },
      source: 'self_reported',
      notes:  'Insight from user self-reported conversation.',
    })
  }

  return facts
}
