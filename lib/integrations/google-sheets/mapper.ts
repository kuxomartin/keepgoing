// SERVER-ONLY — column alias resolution for all data types

// ============================================================
// HEALTH METRICS
// ============================================================

export const HEALTH_METRICS_ALIASES: Record<string, string[]> = {
  date: ['date', 'day', 'Date', 'Day', 'datum'],

  // Sleep — Apple Health / Health Auto Export column names.
  // Note: HAXE may export sleep duration in hours (e.g. "7.5") rather than minutes.
  // The parser handles hours→minutes conversion automatically (value < 24 → hours, ≥ 24 → minutes).
  sleep_minutes: [
    'sleep_minutes', 'Sleep Minutes',
    'sleep', 'Sleep',
    'Sleep Duration', 'sleep_duration', 'sleep duration',
    'Sleep Duration (hr)', 'Sleep Duration (min)',
    'Total Sleep', 'total_sleep', 'TotalSleep',
    'Asleep Duration', 'asleep_duration', 'asleep',
    'Time Asleep', 'time_asleep',
    'In Bed Duration', 'in_bed_duration', 'In Bed',
    'sleep duration (min)', 'sleep duration (hr)',
    'Spánok', 'spánok', 'Spánok (h)', 'Spánok (min)',  // Slovak
  ],
  deep_sleep_minutes: [
    'deep_sleep_minutes', 'Deep Sleep', 'Deep Sleep (min)', 'Deep Sleep (hr)',
    'deep_sleep', 'deep sleep', 'DeepSleep',
    'Deep Sleep Duration', 'deep_sleep_duration',
  ],
  rem_sleep_minutes: [
    'rem_sleep_minutes', 'REM Sleep', 'REM Sleep (min)', 'REM Sleep (hr)',
    'rem_sleep', 'rem sleep', 'REMSleep', 'REM',
    'REM Duration', 'rem_duration',
  ],
  resting_hr: [
    'resting_hr', 'resting_heart_rate', 'RHR', 'Resting HR', 'Resting Heart Rate',
    'resting heart rate', 'RestingHR', 'resting_heartrate',
    'Resting',  // Apple Health / Health Auto Export uses bare "Resting" for resting heart rate
    'resting',
  ],
  hrv_ms: [
    'hrv_ms', 'hrv', 'HRV', 'Heart Rate Variability', 'heart rate variability', 'HRV (ms)', 'hrv ms',
  ],
  vo2max: [
    'vo2max', 'VO2 Max', 'vo2_max', 'VO2Max', 'vo2 max', 'VO2max', 'Cardio Fitness', 'cardio_fitness',
    'VO₂ max', 'VO₂ Max', 'VO₂max',  // Apple Health uses unicode subscript ₂
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

// ============================================================
// APPLE HEALTH SLEEP SHEET
// ============================================================
// Handles the dedicated Sleep sheet from Health Auto Export.
// Apple Watch sleep stage column names as exported by HAXE.

// Full column alias map for Apple Health / Health Auto Export Sleep sheet.
// Covers all columns: Date, Main, Start, End, InBed, Asleep, Awake, REM, Core,
// Deep, Wake Count, Efficiency, Fall Asleep, Respiration, SpO2, HRV, Data Source.
export const SLEEP_SHEET_ALIASES: Record<string, string[]> = {
  date: ['date', 'Date', 'day', 'Day', 'datum', 'Datum'],

  start_time: ['Start', 'start', 'start_time', 'Start Time', 'Bedtime', 'Sleep Start'],
  end_time:   ['End', 'end', 'end_time', 'End Time', 'Wake Time', 'Wake Up', 'Sleep End'],

  in_bed_minutes: [
    'InBed', 'In Bed', 'in_bed', 'inbed', 'In Bed Duration',
    'Time in Bed', 'time_in_bed', 'Bed Duration',
  ],
  asleep_minutes: [
    'Asleep', 'asleep', 'Asleep Duration',
    'Total Sleep', 'total_sleep', 'TotalSleep', 'Sleep Duration', 'Sleep',
    'Time Asleep', 'time_asleep', 'Spánok', 'spánok',
  ],
  awake_minutes: [
    'Awake', 'awake', 'Awake Duration', 'Time Awake', 'awake_duration',
  ],
  rem_minutes: [
    'REM', 'rem', 'REM Sleep', 'rem_sleep', 'REMSleep',
    'REM Duration', 'REM Sleep Duration',
  ],
  core_minutes: [
    'Core', 'core', 'Core Sleep', 'core_sleep', 'Core Duration',
    'Light Sleep', 'light_sleep', 'NREM Light',
  ],
  deep_minutes: [
    'Deep', 'deep', 'Deep Sleep', 'deep_sleep', 'DeepSleep',
    'Deep Sleep Duration', 'NREM Deep', 'deep_duration',
  ],
  wake_count: [
    'Wake Count', 'wake_count', 'Wakeups', 'Wakeup Count', 'Awakenings',
    'Number of Wakeups', 'wakeups', 'Počet prebudení',
  ],
  efficiency_pct: [
    'Efficiency', 'efficiency', 'Sleep Efficiency', 'sleep_efficiency',
    'Efektivita', 'efektivita',
  ],
  fall_asleep_minutes: [
    'Fall Asleep', 'fall_asleep', 'Time to Fall Asleep', 'Sleep Latency',
    'sleep_latency', 'Onset Latency', 'Zaspanie',
  ],
  avg_respiration_rate: [
    'Avg. Respiration Rate', 'Avg Respiration Rate', 'avg_respiration_rate',
    'Respiration Rate', 'Breathing Rate', 'avg_resp_rate',
  ],
  wrist_temperature: [
    'Wrist Temperature', 'wrist_temperature', 'Wrist Temp',
    'Skin Temperature', 'skin_temperature', 'Teplota zápästia',
  ],
  low_spo2:  ['Low SpO2', 'low_spo2', 'Min SpO2', 'SpO2 Low',  'Min. SpO2'],
  high_spo2: ['High SpO2', 'high_spo2', 'Max SpO2', 'SpO2 High', 'Max. SpO2'],
  avg_spo2:  ['Avg. SpO2', 'avg_spo2', 'SpO2', 'SpO2 Average', 'Avg SpO2'],
  low_hrv:   ['Low HRV', 'low_hrv', 'HRV Low', 'Min HRV', 'Min. HRV'],
  high_hrv:  ['High HRV', 'high_hrv', 'HRV High', 'Max HRV', 'Max. HRV'],
  avg_hrv:   ['Avg. HRV', 'avg_hrv', 'HRV Average', 'Avg HRV', 'HRV'],
  data_source: ['Data Source', 'data_source', 'Source', 'Device', 'Zariadenie'],
}

export const SLEEP_SHEET_REQUIRED = ['date']
