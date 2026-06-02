// KeepGoing — TypeScript database types
// Hand-written to match supabase/migrations/001-006

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other'
export type ConfidenceLevel = 'low' | 'medium' | 'high'
export type DataSourceStatus = 'active' | 'inactive' | 'error'
export type ImportStatus = 'success' | 'partial' | 'error'
export type RecoveryStatus = 'green' | 'yellow' | 'orange' | 'red'
export type SupportedDataType = 'health_metrics' | 'weight_logs' | 'strava_activities' | 'apple_sleep'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  created_at: string
}

export interface DailyCheckin {
  id: string
  user_id: string
  date: string // 'YYYY-MM-DD'
  energy: number | null
  mood: number | null
  stress: number | null
  soreness: number | null
  motivation: number | null
  digestion: number | null
  notes: string | null
  created_at: string
}

export interface WeightLog {
  id: string
  user_id: string
  date: string
  weight_kg: number
  waist_cm: number | null
  body_fat_percent: number | null
  notes: string | null
  created_at: string
}

export interface CoffeeLog {
  id: string
  user_id: string
  consumed_at: string       // ISO timestamptz
  date: string              // YYYY-MM-DD
  coffee_type: string
  cups: number
  caffeine_mg: number | null
  notes: string | null
  created_at: string
}

export interface FoodLog {
  id: string
  user_id: string
  date: string
  /** ISO timestamp of when the meal was eaten (migration 007) */
  eaten_at: string | null
  meal_type: MealType
  description: string
  estimated_calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  confidence: ConfidenceLevel | null
  digestion_note: string | null
  image_url: string | null
  /** Data source identifier, e.g. 'historical_import' (migration 009) */
  source: string | null
  created_at: string
}

export interface Activity {
  id: string
  user_id: string
  source: string
  external_id: string | null
  activity_type: string
  title: string
  start_time: string
  duration_minutes: number | null
  distance_km: number | null
  elevation_gain_m: number | null
  avg_hr: number | null
  max_hr: number | null
  avg_power: number | null
  calories: number | null
  perceived_effort: number | null
  difficulty_note: string | null
  weather_temp_c: number | null
  weather_wind_kph: number | null
  source_payload: Record<string, unknown> | null
  created_at: string
}

export interface HealthMetrics {
  id: string
  user_id: string
  date: string
  sleep_minutes: number | null
  deep_sleep_minutes: number | null
  rem_sleep_minutes: number | null
  resting_hr: number | null
  hrv_ms: number | null
  vo2max: number | null
  steps: number | null
  active_energy_kcal: number | null
  /** Resting / basal metabolic energy expenditure (migration 008) */
  resting_energy_kcal: number | null
  respiratory_rate: number | null
  source: string
  source_payload: Record<string, unknown> | null
  created_at: string
}

export interface GolfRound {
  id: string
  user_id: string
  date: string
  course_name: string
  holes: number
  score: number | null
  stableford_points: number | null
  walking: boolean
  duration_minutes: number | null
  perceived_focus: number | null
  perceived_fatigue: number | null
  notes: string | null
  linked_activity_id: string | null
  created_at: string
}

export interface AiInsight {
  id: string
  user_id: string
  insight_type: string
  title: string
  body: string
  related_date: string | null
  related_activity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface WeeklyReport {
  id: string
  user_id: string
  week_start: string
  week_end: string
  summary: string | null
  training_summary: string | null
  nutrition_summary: string | null
  recovery_summary: string | null
  recommendations: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface DataSource {
  id: string
  user_id: string
  source: string
  status: DataSourceStatus
  last_sync_at: string | null
  config: Record<string, unknown> | null
  created_at: string
}

/** New multi-import config record (migration 005) */
export interface GoogleSheetImport {
  id: string
  user_id: string
  name: string
  spreadsheet_id: string
  sheet_name: string
  data_type: SupportedDataType
  enabled: boolean
  import_priority: number
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

export interface DataImportLog {
  id: string
  user_id: string
  import_id: string | null   // references google_sheet_imports.id (migration 005)
  source: string
  status: ImportStatus
  rows_read: number
  rows_imported: number
  rows_skipped: number
  error_message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface SleepRecord {
  id: string
  user_id: string
  date: string              // YYYY-MM-DD (morning wake-up date)
  start_time: string | null // ISO timestamptz — sleep onset
  end_time: string | null   // ISO timestamptz — wake time
  in_bed_minutes: number | null
  asleep_minutes: number | null
  awake_minutes: number | null
  rem_minutes: number | null
  core_minutes: number | null
  deep_minutes: number | null
  wake_count: number | null
  efficiency_pct: number | null  // 0–100
  fall_asleep_minutes: number | null
  avg_respiration_rate: number | null
  wrist_temperature: number | null
  low_spo2: number | null
  high_spo2: number | null
  avg_spo2: number | null
  low_hrv: number | null
  high_hrv: number | null
  avg_hrv: number | null
  source: string
  created_at: string
  updated_at: string
}

// ============================================================
// Utility / computed types
// ============================================================

export interface ImportSummary {
  rows_read: number
  rows_imported: number
  rows_skipped: number
  duplicates_removed: number
  errors: string[]
}

export interface RecoveryResult {
  score: number // 0–100
  status: RecoveryStatus
  issues: string[]
}

/** Kept for backward-compat with existing data_sources rows */
export interface GoogleSheetsConfig {
  spreadsheetId: string
  sheetName: string
  dataType: SupportedDataType
}

export interface SheetPreview {
  detectedHeaders: string[]
  resolvedMap: Record<string, number>
  missingRequired: string[]
  sampleRows: string[][]
}
