/**
 * Personal context types.
 *
 * Context facts are long-term stable profile data imported from DNA reports,
 * lab tests, bike fitting, and self-reported observations. They are NOT daily
 * log entries — they represent durable knowledge about the user.
 *
 * Source attribution is mandatory. The app never presents any finding as a
 * medical diagnosis.
 */

export type ContextCategory =
  | 'profile'
  | 'goal'
  | 'food_sensitivity'
  | 'food_observation'
  | 'food_preference'
  | 'nutrition_context'
  | 'genetic_context'
  | 'training_context'
  | 'bike_fit'

/**
 * Source labels are stored verbatim in the DB so the UI can always show
 * where a fact came from.
 */
export type ContextSource =
  | 'self_reported'    // user-stated observations
  | 'user_goal'        // user-stated goals (weight target etc.)
  | 'lab_igg_context'  // Unilabs IgG food intolerance test (NOT a diagnosis)
  | 'dna_predisposition' // DNAera genetic analysis (predisposition ONLY)
  | 'physical_assessment' // bike fitting by a certified fitter

export interface PersonalContextFact {
  id: string
  user_id: string
  category: ContextCategory
  key: string
  value: Record<string, unknown>
  source: ContextSource
  source_detail: string | null
  confidence: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Shape accepted by the upsert helper (no id, user_id, timestamps). */
export interface PersonalContextFactInput {
  category: ContextCategory
  key: string
  value: Record<string, unknown>
  source: ContextSource
  source_detail?: string
  confidence?: string
  notes?: string
}

export interface ImportSummary {
  success: boolean
  facts_imported: number
  facts_skipped: number
  categories: Partial<Record<ContextCategory, number>>
}

// ── Category display metadata ─────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<ContextCategory, string> = {
  profile:           'Profile',
  goal:              'Goals',
  food_sensitivity:  'Food Sensitivities',
  food_observation:  'Food Observations',
  food_preference:   'Food Preferences',
  nutrition_context: 'Nutrition Context',
  genetic_context:   'Genetic Context',
  training_context:  'Training Context',
  bike_fit:          'Bike Fit',
}

export const CATEGORY_ORDER: ContextCategory[] = [
  'profile',
  'goal',
  'food_sensitivity',
  'food_observation',
  'food_preference',
  'nutrition_context',
  'genetic_context',
  'training_context',
  'bike_fit',
]

export const SOURCE_LABELS: Record<ContextSource, string> = {
  self_reported:       'Self-reported',
  user_goal:           'User goal',
  lab_igg_context:     'IgG lab test',
  dna_predisposition:  'DNA predisposition',
  physical_assessment: 'Bike fitting',
}

export const SOURCE_COLORS: Record<ContextSource, string> = {
  self_reported:       'bg-blue-50 text-blue-700',
  user_goal:           'bg-purple-50 text-purple-700',
  lab_igg_context:     'bg-amber-50 text-amber-700',
  dna_predisposition:  'bg-teal-50 text-teal-700',
  physical_assessment: 'bg-orange-50 text-orange-700',
}
