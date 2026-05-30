/**
 * Transforms martin_health_profile_v2.json into PersonalContextFactInput[].
 *
 * Import rules:
 * - food_sensitivities: include where app_action != no_known_issue, OR
 *   user_observation exists, OR confidence == 'high'
 * - genetic_predispositions: only the 9 traits listed in INCLUDE_TRAITS
 * - Skip: metadata, app_policy, igg_class_reference, data_sources (reference only)
 * - Skip: profile.name (PII), profile.age (derived from dob)
 *
 * All DNA findings are stored with notes: "Predisposition only — not a confirmed condition."
 * All IgG findings are stored with notes: "IgG context only — not a diagnosis."
 */

import type { PersonalContextFactInput } from './types'

// The 9 genetic traits we store (celiac excluded per spec)
const INCLUDE_TRAITS = new Set([
  'lactose_intolerance_predisposition',
  'histamine_intolerance_predisposition',
  'salt_sensitivity_predisposition',
  'mthfr_folate_metabolism',
  'omega3_intake_relevance',
  'vitamin_B6_predisposition',
  'sports_profile_genetic',
  'acl_injury_predisposition',
  'achilles_tendinopathy_predisposition',
])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>

export function transformHealthProfile(raw: unknown): PersonalContextFactInput[] {
  const hp = raw as AnyObj
  const facts: PersonalContextFactInput[] = []

  // ── Profile ─────────────────────────────────────────────────────────────────
  const p: AnyObj = hp.profile ?? {}

  const profileFields: Array<[string, unknown]> = [
    ['height_cm',        p.height_cm],
    ['gender',           p.gender],
    ['activity_level',   p.activity_level],
    ['occupation_type',  p.occupation_type],
    ['primary_sports',   p.primary_sports],
    ['dob',              p.dob],
  ]
  for (const [key, val] of profileFields) {
    if (val == null) continue
    facts.push({
      category: 'profile',
      key,
      value: { value: val },
      source: 'self_reported',
    })
  }

  // ── Goals ────────────────────────────────────────────────────────────────────
  if (p.weight_kg_current != null) {
    facts.push({
      category: 'goal',
      key: 'weight_kg_current',
      value: { value: p.weight_kg_current, unit: 'kg' },
      source: 'user_goal',
    })
  }
  if (p.weight_kg_goal != null) {
    facts.push({
      category: 'goal',
      key: 'weight_kg_goal',
      value: { value: p.weight_kg_goal, unit: 'kg' },
      source: 'user_goal',
    })
  }
  if (p.weight_kg_current != null && p.weight_kg_goal != null) {
    const direction = p.weight_kg_goal < p.weight_kg_current ? 'lose' : 'gain'
    facts.push({
      category: 'goal',
      key: 'weight_direction',
      value: {
        direction,
        delta_kg: Math.abs(p.weight_kg_goal - p.weight_kg_current),
      },
      source: 'user_goal',
    })
  }

  // ── Food sensitivities ────────────────────────────────────────────────────────
  for (const s of hp.food_sensitivities ?? []) {
    const hasUserObs   = s.user_observation != null
    const isActionable = s.app_action && s.app_action !== 'no_known_issue'
    const isHighConf   = s.confidence === 'high'

    if (!isActionable && !hasUserObs && !isHighConf) continue

    // Determine primary source
    const source = s.lab_result ? 'lab_igg_context' : 'self_reported'

    facts.push({
      category: 'food_sensitivity',
      key: s.item,
      value: {
        label:            s.label,
        food_category:    s.category,
        app_action:       s.app_action,
        confidence:       s.confidence,
        lab_result:       s.lab_result ?? null,
        user_observation: s.user_observation ?? null,
        genetic_context:  s.genetic_context ?? null,
        ui_message:       s.ui_message ?? null,
      },
      source,
      source_detail:  s.lab_result?.source_id ?? null,
      confidence:     s.confidence ?? null,
      notes:          [
        'IgG context only — not a diagnosis.',
        s.note ?? null,
      ].filter(Boolean).join(' ') || undefined,
    })
  }

  // ── Genetic context ───────────────────────────────────────────────────────────
  for (const g of hp.genetic_predispositions ?? []) {
    if (!g.trait || !INCLUDE_TRAITS.has(g.trait)) continue

    facts.push({
      category: 'genetic_context',
      key: g.trait,
      value: {
        category:       g.category,
        result:         g.result,
        gene:           g.gene ?? null,
        finding:        g.finding,
        app_behavior:   g.app_behavior,
        good_sources:   g.good_sources ?? null,
        nutrition_note: g.nutrition_note ?? null,
        high_histamine_foods_reference: g.high_histamine_foods_reference ?? null,
      },
      source:        'dna_predisposition',
      source_detail: g.source_id ?? null,
      confidence:    g.confidence ?? null,
      notes:         'Predisposition only — not a confirmed condition.',
    })
  }

  // ── Nutrition context ─────────────────────────────────────────────────────────
  const nc: AnyObj = hp.nutrition_context ?? {}

  if (nc.protein_context) {
    facts.push({
      category:     'nutrition_context',
      key:          'protein_target',
      value: {
        g_per_kg:          nc.protein_context.indicative_target_g_per_kg,
        preferred_sources: nc.protein_context.preferred_sources_no_known_issue ?? [],
        note:              nc.protein_context.note ?? null,
      },
      source:     'lab_igg_context',
      confidence: 'medium',
    })
  }

  for (const n of nc.nutrients_worth_tracking ?? []) {
    facts.push({
      category:      'nutrition_context',
      key:           `nutrient_${n.nutrient}`,
      value: {
        nutrient:     n.nutrient,
        reason:       n.reason,
        food_sources: n.food_sources ?? [],
      },
      source:     'dna_predisposition',
      confidence: 'medium',
      notes:      n.note ?? undefined,
    })
  }

  const notes: Array<[string, string, 'lab_igg_context' | 'dna_predisposition' | 'self_reported']> = [
    ['cooking_oils_note',  nc.cooking_oils_note,  'lab_igg_context'],
    ['sodium_note',        nc.sodium_note,        'dna_predisposition'],
    ['evening_fruit_note', nc.evening_fruit_note, 'self_reported'],
  ]
  for (const [key, note, src] of notes) {
    if (!note) continue
    facts.push({
      category: 'nutrition_context',
      key,
      value:    { note },
      source:   src,
    })
  }

  // Safe foods — stored as a single searchable fact
  if (hp.safe_foods) {
    const sf: AnyObj = hp.safe_foods
    facts.push({
      category:  'nutrition_context',
      key:       'safe_foods',
      value: {
        meat:               sf.meat ?? [],
        fish:               sf.fish ?? [],
        dairy_alternatives: sf.dairy_alternatives ?? [],
        grains:             sf.grains ?? [],
        vegetables:         sf.vegetables ?? [],
        fruits:             sf.fruits ?? [],
        nuts:               sf.nuts ?? [],
        fats:               sf.fats ?? [],
        other:              sf.other ?? [],
      },
      source:     'lab_igg_context',
      confidence: 'high',
      notes:      'Foods with no significant IgG reaction (class 0). Based on 2022 Unilabs test.',
    })
  }

  // ── Training context ──────────────────────────────────────────────────────────
  const tp: AnyObj = hp.training_plan ?? {}

  if (tp.daily_targets) {
    facts.push({
      category: 'training_context',
      key:      'daily_targets',
      value:    tp.daily_targets as Record<string, unknown>,
      source:   'self_reported',
    })
  }
  if (tp.weekly_schedule) {
    facts.push({
      category: 'training_context',
      key:      'weekly_schedule',
      value:    { schedule: tp.weekly_schedule },
      source:   'self_reported',
    })
  }
  if (tp.warmup_note) {
    facts.push({
      category: 'training_context',
      key:      'warmup_note',
      value:    { note: tp.warmup_note },
      source:   'dna_predisposition',
      notes:    'Based on ACL and Achilles predisposition in uploaded DNA report.',
    })
  }
  if (tp.home_circuit_exercises) {
    facts.push({
      category: 'training_context',
      key:      'home_circuit_exercises',
      value:    { exercises: tp.home_circuit_exercises },
      source:   'self_reported',
    })
  }

  // ── Bike fit ──────────────────────────────────────────────────────────────────
  const bf: AnyObj = hp.bike_fitting ?? {}

  if (bf.body_measurements) {
    facts.push({
      category:      'bike_fit',
      key:           'body_measurements',
      value:         bf.body_measurements as Record<string, unknown>,
      source:        'physical_assessment',
      source_detail: 'bikefitting_2025',
    })
  }

  if (bf.fit_parameters) {
    const fp: AnyObj = bf.fit_parameters
    facts.push({
      category: 'bike_fit',
      key:      'fit_parameters',
      value: {
        saddle_height_mm:              fp.saddle_height_mm,
        saddle_handlebar_distance_mm:  fp.saddle_handlebar_distance_mm,
        saddle_handlebar_drop_mm:      fp.saddle_handlebar_drop_mm,
        stack_mm:                      fp.stack_mm,
        reach_mm:                      fp.reach_mm,
        crank_length_mm:               fp.crank_length_mm,
        seat_tube_angle_deg:           fp.seat_tube_angle_deg,
      },
      source:        'physical_assessment',
      source_detail: 'bikefitting_2025',
    })
  }

  if (bf.current_bike) {
    facts.push({
      category:      'bike_fit',
      key:           'current_bike',
      value:         bf.current_bike as Record<string, unknown>,
      source:        'physical_assessment',
      source_detail: 'bikefitting_2025',
    })
  }

  if (bf.hardware || bf.power_meter || bf.heart_rate_monitor || bf.bike_computer) {
    facts.push({
      category: 'bike_fit',
      key:      'hardware',
      value: {
        pedals:             bf.hardware?.pedals ?? null,
        power_meter:        bf.power_meter ?? null,
        heart_rate_monitor: bf.heart_rate_monitor ?? null,
        bike_computer:      bf.bike_computer ?? null,
      },
      source:        'physical_assessment',
      source_detail: 'bikefitting_2025',
    })
  }

  if (bf.flexibility_assessment) {
    facts.push({
      category:      'bike_fit',
      key:           'flexibility_assessment',
      value:         bf.flexibility_assessment as Record<string, unknown>,
      source:        'physical_assessment',
      source_detail: 'bikefitting_2025',
    })
  }

  return facts
}
