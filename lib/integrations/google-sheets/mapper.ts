// SERVER-ONLY — column alias resolution for all data types

// ============================================================
// HEALTH METRICS
// ============================================================

export const HEALTH_METRICS_ALIASES: Record<string, string[]> = {
  date: ['date', 'day', 'Date', 'Day', 'datum'],
  sleep_minutes: [
    'sleep_minutes', 'sleep', 'Sleep', 'Sleep Duration', 'Sleep (min)',
    'sleep_duration', 'total_sleep', 'Total Sleep', 'TotalSleep', 'sleep duration (min)',
  ],
  deep_sleep_minutes: [
    'deep_sleep_minutes', 'deep_sleep', 'Deep Sleep', 'Deep Sleep (min)', 'deep sleep', 'DeepSleep',
  ],
  rem_sleep_minutes: [
    'rem_sleep_minutes', 'rem_sleep', 'REM Sleep', 'REM Sleep (min)', 'rem sleep', 'REMSleep', 'REM',
  ],
  resting_hr: [
    'resting_hr', 'resting_heart_rate', 'RHR', 'Resting HR', 'Resting Heart Rate',
    'resting heart rate', 'RestingHR', 'resting_heartrate',
  ],
  hrv_ms: [
    'hrv_ms', 'hrv', 'HRV', 'Heart Rate Variability', 'heart rate variability', 'HRV (ms)', 'hrv ms',
  ],
  vo2max: [
    'vo2max', 'VO2 Max', 'vo2_max', 'VO2Max', 'vo2 max', 'VO2max', 'Cardio Fitness', 'cardio_fitness',
  ],
  steps: ['steps', 'Steps', 'step_count', 'Step Count', 'StepCount', 'daily_steps', 'Daily Steps'],
  active_energy_kcal: [
    'active_energy_kcal', 'active_calories', 'Active Energy (kcal)', 'Active Calories',
    'active energy', 'ActiveEnergy', 'active_energy', 'calories_burned', 'Calories Burned',
  ],
  resting_energy_kcal: [
    'resting_energy_kcal', 'resting_calories', 'Resting Energy (kcal)', 'Resting Calories',
    'resting energy', 'RestingEnergy', 'resting_energy', 'basal_energy', 'Basal Energy',
    'bmr', 'BMR', 'basal metabolic rate', 'Basal Metabolic Rate',
  ],
  respiratory_rate: [
    'respiratory_rate', 'Respiratory Rate', 'resp_rate', 'breathing_rate', 'Breathing Rate',
    'breaths_per_min', 'Breaths/min',
  ],
}

export const HEALTH_METRICS_REQUIRED = ['date']

// ============================================================
// WEIGHT LOGS
// ============================================================

export const WEIGHT_LOGS_ALIASES: Record<string, string[]> = {
  date: ['date', 'day', 'Date', 'Day', 'datum', 'Datum'],
  weight_kg: [
    'weight_kg', 'weight', 'Weight', 'Weight (kg)', 'Body Mass', 'Body Weight',
    'body_weight', 'bodyweight', 'Bodyweight', 'waga', 'Waga', 'kg',
  ],
  body_fat_percent: [
    'body_fat_percent', 'body_fat', 'Body Fat', 'Body Fat %', 'bodyfat',
    'fat_percent', 'fat%', 'Fat %', 'bf%', 'BF%', 'body fat %', 'tuk', 'Tuk', 'tuk %',
  ],
  waist_cm: [
    'waist_cm', 'waist', 'Waist', 'Waist (cm)', 'waist_circumference', 'obwod_pasa', 'pas', 'Pas',
  ],
}

export const WEIGHT_LOGS_REQUIRED = ['date', 'weight_kg']

// ============================================================
// STRAVA ACTIVITIES (Google Sheets export — Slovak column names)
// ============================================================

export const STRAVA_ACTIVITIES_ALIASES: Record<string, string[]> = {
  external_id: ['ID', 'id', 'activity_id', 'Activity ID'],
  start_time: ['Dátum', 'Datum', 'datum', 'Date', 'date', 'start_time', 'Start Time'],
  activity_type: ['Typ', 'typ', 'Type', 'type', 'activity_type', 'Activity Type', 'Sport'],
  title: ['Názov', 'Nazov', 'nazov', 'Name', 'name', 'title', 'Title', 'Meno'],
  distance_km: [
    'Vzdialenosť (km)', 'Vzdialenost (km)', 'vzdialenost_km', 'Distance (km)',
    'distance_km', 'distance', 'Distance',
  ],
  duration_minutes: [
    'Čas moving (min)', 'Cas moving (min)', 'cas_moving_min', 'Moving Time (min)',
    'duration_minutes', 'moving_time', 'Moving Time',
  ],
  elapsed_minutes: [
    'Čas elapsed (min)', 'Cas elapsed (min)', 'cas_elapsed_min',
    'Elapsed Time (min)', 'elapsed_time', 'Elapsed Time',
  ],
  elevation_gain_m: [
    'Prevýšenie (m)', 'Prevysenie (m)', 'prevysenie_m', 'Elevation Gain (m)',
    'elevation_gain_m', 'elevation', 'Elevation',
  ],
  avg_hr: ['Priem. tep', 'priem_tep', 'Avg Heart Rate', 'avg_hr', 'average_hr', 'Avg HR'],
  max_hr: ['Max tep', 'max_tep', 'Max Heart Rate', 'max_hr', 'Max HR'],
  avg_power: [
    'Priem. výkon (W)', 'Priem. vykon (W)', 'priem_vykon_w',
    'Avg Power (W)', 'avg_power', 'average_power', 'Avg Power',
  ],
  max_power: ['Max výkon (W)', 'Max vykon (W)', 'max_vykon_w', 'Max Power (W)', 'max_power'],
  normalized_power: ['Normalized Power (W)', 'normalized_power', 'NP (W)', 'NP', 'np'],
  avg_cadence: ['Kadencia', 'kadencia', 'Cadence', 'avg_cadence', 'cadence'],
  calories: ['Kalórie', 'Kalorie', 'kalorie', 'Calories', 'calories'],
  suffer_score: ['Suffer score', 'Suffer Score', 'suffer_score'],
  avg_speed_kmh: [
    'Priem. rýchlosť (km/h)', 'Priem. rychlost (km/h)', 'priem_rychlost_kmh',
    'Avg Speed (km/h)', 'avg_speed', 'Avg Speed',
  ],
  max_speed_kmh: [
    'Max rýchlosť (km/h)', 'Max rychlost (km/h)', 'max_rychlost_kmh',
    'Max Speed (km/h)', 'max_speed', 'Max Speed',
  ],
  kilojoules: ['Kilojoules', 'kilojoules', 'kJ', 'energy_kj'],
  gear_id: ['Gear ID', 'gear_id', 'gear', 'Gear'],
  start_latlng: ['Start latlng', 'start_latlng', 'Start LatLng'],
  trainer: ['Trainer', 'trainer', 'Trenažér', 'Trenazer', 'trenazer'],
  commute: ['Commute', 'commute', 'Dochádzka', 'Dochadzka', 'dochadzka'],
  perceived_effort: [
    'Pocit celkovo (1-5)', 'pocit_celkovo', 'Overall feeling', 'perceived_effort', 'Pocit',
  ],
  legs_feeling: ['Nohy (1-5)', 'nohy_1_5', 'Legs feeling', 'legs_feeling', 'Nohy'],
  sleep_previous_night: [
    'Spánok noc predtým', 'Spanok noc predtym', 'spanok_predtym', 'Sleep previous night',
  ],
  difficulty_note: ['Poznámka', 'Poznamka', 'poznamka', 'Note', 'notes', 'Notes', 'difficulty_note'],
}

export const STRAVA_ACTIVITIES_REQUIRED = ['external_id', 'start_time', 'activity_type', 'title']

// ============================================================
// Generic helpers
// ============================================================

/**
 * Resolves a raw header array to a map of { internalFieldName: columnIndex }.
 * Matching is: exact first, then case-insensitive trimmed.
 */
export function resolveColumnMap(
  headers: string[],
  aliases: Record<string, string[]>
): Record<string, number> {
  const result: Record<string, number> = {}
  const trimmed = headers.map((h) => String(h).trim())

  for (const [field, aliasList] of Object.entries(aliases)) {
    // 1. Exact match
    let idx = trimmed.findIndex((h) => aliasList.includes(h))
    if (idx === -1) {
      // 2. Case-insensitive match
      const lowerAliases = aliasList.map((a) => a.toLowerCase())
      idx = trimmed.findIndex((h) => lowerAliases.includes(h.toLowerCase()))
    }
    if (idx !== -1) {
      result[field] = idx
    }
  }

  return result
}

/**
 * Returns a list of required fields that are missing from the resolved column map.
 */
export function getMissingRequired(
  columnMap: Record<string, number>,
  required: string[]
): string[] {
  return required.filter((field) => !(field in columnMap))
}

/**
 * Returns headers that didn't match any known alias (unrecognized columns).
 */
export function getUnrecognizedHeaders(
  headers: string[],
  columnMap: Record<string, number>
): string[] {
  const usedIndices = new Set(Object.values(columnMap))
  return headers
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => !usedIndices.has(i))
    .map(({ h }) => h)
}
