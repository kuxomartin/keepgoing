/**
 * Loads a lightweight personal context summary for use in the insight engine.
 *
 * Returns nulls/false when no context has been imported — the engine degrades
 * gracefully without personal context.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface PersonalContextSummary {
  /** Goal weight in kg, or null if not set. */
  weightGoalKg:              number | null
  /** Current weight from health profile import (88 kg), or null. */
  weightCurrentKg:           number | null
  /** Protein target ratio from health profile (g per kg body weight). */
  proteinGPerKg:             number | null
  /** True if cow dairy (milk, yogurt) is flagged in food_sensitivity. */
  hasDairySensitivity:       boolean
  /** True if histamine intolerance predisposition is stored. */
  hasHistamineContext:        boolean
  /** True if ACL injury predisposition is stored. */
  hasAclPredisposition:      boolean
  /** True if Achilles tendinopathy predisposition is stored. */
  hasAchillesPredisposition: boolean
  /** True if coffee is flagged in food_sensitivity. */
  hasCoffeeSensitivity:      boolean
  /** True if duck meat adverse reaction is stored as food_observation. */
  hasDuckMeatReaction:       boolean
  /** True if evening fruit bloating pattern is stored. */
  eveningFruitContext:       boolean
}

export const EMPTY_CONTEXT: PersonalContextSummary = {
  weightGoalKg:              null,
  weightCurrentKg:           null,
  proteinGPerKg:             null,
  hasDairySensitivity:       false,
  hasHistamineContext:        false,
  hasAclPredisposition:      false,
  hasAchillesPredisposition: false,
  hasCoffeeSensitivity:      false,
  hasDuckMeatReaction:       false,
  eveningFruitContext:       false,
}

export async function loadPersonalContextSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<PersonalContextSummary> {
  const { data, error } = await supabase
    .from('personal_context_facts')
    .select('category, key, value')
    .eq('is_active', true)
    .in('category', [
      'goal',
      'food_sensitivity',
      'genetic_context',
      'food_observation',
      'nutrition_context',
    ])

  if (error || !data?.length) return EMPTY_CONTEXT

  type Row = { category: string; key: string; value: Record<string, unknown> }
  const rows = data as Row[]

  const find = (cat: string, key: string) =>
    rows.find(r => r.category === cat && r.key === key)

  const goalWeightFact    = find('goal', 'weight_kg_goal')
  const currentWeightFact = find('goal', 'weight_kg_current')
  const proteinFact       = find('nutrition_context', 'protein_target')

  return {
    weightGoalKg: goalWeightFact
      ? (goalWeightFact.value.value as number) ?? null
      : null,

    weightCurrentKg: currentWeightFact
      ? (currentWeightFact.value.value as number) ?? null
      : null,

    proteinGPerKg: proteinFact
      ? (proteinFact.value.g_per_kg as number) ?? null
      : null,

    hasDairySensitivity:
      !!(find('food_sensitivity', 'cow_milk') || find('food_sensitivity', 'yogurt_cow')),

    hasHistamineContext:
      !!find('genetic_context', 'histamine_intolerance_predisposition'),

    hasAclPredisposition:
      !!find('genetic_context', 'acl_injury_predisposition'),

    hasAchillesPredisposition:
      !!find('genetic_context', 'achilles_tendinopathy_predisposition'),

    hasCoffeeSensitivity:
      !!find('food_sensitivity', 'coffee'),

    hasDuckMeatReaction:
      !!find('food_observation', 'duck_meat'),

    eveningFruitContext:
      !!(find('food_observation', 'oranges_large_quantity_evening') ||
         find('food_observation', 'apple_evening')),
  }
}
