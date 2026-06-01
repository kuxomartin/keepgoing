// SERVER-ONLY — parses raw sheet rows into typed records for all data types

import { parse as dateParse, isValid, parseISO } from 'date-fns'
import type { HealthMetrics, WeightLog, Activity } from '@/types/database'

type PartialHealthMetrics = Omit<HealthMetrics, 'id' | 'user_id' | 'created_at'>
type PartialWeightLog    = Omit<WeightLog,    'id' | 'user_id' | 'created_at'>
type PartialActivity     = Omit<Activity,     'id' | 'user_id' | 'created_at'>

export interface ParseResult {
  records: PartialHealthMetrics[]
  skipped: number
  errors: string[]
}

export interface WeightParseResult {
  records: PartialWeightLog[]
  skipped: number
  errors: string[]
}

export interface ActivityParseResult {
  records: PartialActivity[]
  skipped: number
  errors: string[]
}

// ============================================================
// DATE PARSING
// ============================================================

/**
 * Attempts to parse a date string in multiple formats.
 * Returns ISO date string 'YYYY-MM-DD' or null on failure.
 */
export function parseFlexibleDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  // 1. ISO 8601 — most common from Apple Health exports
  const iso = parseISO(s)
  if (isValid(iso)) {
    return iso.toISOString().slice(0, 10)
  }

  // 2. DD/MM/YYYY (European)
  const dmy = dateParse(s, 'dd/MM/yyyy', new Date())
  if (isValid(dmy)) return dmy.toISOString().slice(0, 10)

  // 3. MM/DD/YYYY (US)
  const mdy = dateParse(s, 'MM/dd/yyyy', new Date())
  if (isValid(mdy)) return mdy.toISOString().slice(0, 10)

  // 4. DD.MM.YYYY (Central European)
  const dmy2 = dateParse(s, 'dd.MM.yyyy', new Date())
  if (isValid(dmy2)) return dmy2.toISOString().slice(0, 10)

  // 5. D.M.YYYY (short Central European)
  const dmy3 = dateParse(s, 'd.M.yyyy', new Date())
  if (isValid(dmy3)) return dmy3.toISOString().slice(0, 10)

  // 6. Excel serial number (days since 1900-01-01, with Lotus 1900 bug)
  const serial = parseFloat(s)
  if (!isNaN(serial) && serial > 1 && serial < 100000) {
    const excelEpoch = new Date(1899, 11, 30)
    const d = new Date(excelEpoch.getTime() + serial * 86400000)
    if (isValid(d)) return d.toISOString().slice(0, 10)
  }

  return null
}

/**
 * Parses a date/datetime string and returns a full ISO 8601 timestamp.
 * Falls back to midnight UTC if only a date is present.
 */
function parseFlexibleDateTime(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  // 1. Full ISO 8601 datetime
  const iso = parseISO(s)
  if (isValid(iso)) return iso.toISOString()

  // 2. DD.MM.YYYY HH:mm:ss
  const dtFull = dateParse(s, 'dd.MM.yyyy HH:mm:ss', new Date())
  if (isValid(dtFull)) return dtFull.toISOString()

  // 3. DD.MM.YYYY HH:mm
  const dtShort = dateParse(s, 'dd.MM.yyyy HH:mm', new Date())
  if (isValid(dtShort)) return dtShort.toISOString()

  // 4. Date only — use midnight UTC
  const dateOnly = parseFlexibleDate(s)
  if (dateOnly) return dateOnly + 'T00:00:00.000Z'

  return null
}

// ============================================================
// NUMERIC HELPERS
// ============================================================

function parseNum(raw: string | undefined): number | null {
  if (!raw || raw.trim() === '' || raw.trim() === '-') return null
  const cleaned = raw.trim().replace(/,/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseInt2(raw: string | undefined): number | null {
  const n = parseNum(raw)
  return n === null ? null : Math.round(n)
}

function isEmptyRow(row: string[]): boolean {
  return row.every((cell) => !cell || !cell.trim())
}

/**
 * Parses a sleep duration cell into minutes.
 *
 * Apple Health / Health Auto Export exports sleep in several formats:
 *  - "6h45m"  or "6h 45m" → 405 min   (Health Auto Export sleep sheet format)
 *  - "7h"                 → 420 min
 *  - "45m"                → 45 min
 *  - "7.5"                → 450 min   (decimal hours)
 *  - "7,5"                → 450 min   (European decimal)
 *  - "7:30"               → 450 min   (H:MM)
 *  - "450"                → 450 min   (plain minutes)
 *  - "7.5 hr", "450 min"  → with suffix
 *
 * Returns null for empty, zero, or unparseable input.
 */
function parseSleepMinutes(raw: string | undefined): number | null {
  if (!raw || raw.trim() === '' || raw.trim() === '-') return null
  let s = raw.trim()

  // "6h:45m" / "6h45m" / "6h 45m" / "6H:45M"
  // Health Auto Export uses "6h:45m" (colon-separated) format.
  const hmMatch = s.match(/^(\d+)\s*h\s*:?\s*(\d+)\s*m?$/i)
  if (hmMatch) {
    const minutes = parseInt(hmMatch[1], 10) * 60 + parseInt(hmMatch[2], 10)
    return minutes > 0 ? minutes : null
  }

  // "6h" — hours only
  const hOnly = s.match(/^(\d+)\s*h$/i)
  if (hOnly) {
    const minutes = parseInt(hOnly[1], 10) * 60
    return minutes > 0 ? minutes : null
  }

  // "45m" — minutes only
  const mOnly = s.match(/^(\d+)\s*m$/i)
  if (mOnly) {
    const minutes = parseInt(mOnly[1], 10)
    return minutes > 0 ? minutes : null
  }

  // Strip remaining unit suffixes for numeric parsing
  s = s.replace(/\s*(hours?|hrs?|h)\s*$/i, '')
       .replace(/\s*(minutes?|mins?|m)\s*$/i, '')
       .trim()

  // H:MM or HH:MM
  const colonMatch = s.match(/^(\d{1,2}):(\d{2})$/)
  if (colonMatch) {
    const minutes = parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10)
    return minutes > 0 ? minutes : null
  }

  // Normalize comma-as-decimal (European)
  const commas = (s.match(/,/g) ?? []).length
  const dots   = (s.match(/\./g) ?? []).length
  if (commas === 1 && dots === 0) {
    s = s.replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }

  const n = parseFloat(s)
  if (isNaN(n) || n <= 0) return null

  // If < 24 → almost certainly hours. If ≥ 24 → minutes.
  return n < 24 ? Math.round(n * 60) : Math.round(n)
}

/**
 * Parses a numeric value from a weight cell.
 * Handles: comma-as-decimal ("83,5"), kg/% /cm suffixes, empty → null.
 */
function parseWeightNum(raw: string | undefined): number | null {
  if (!raw || raw.trim() === '' || raw.trim() === '-') return null
  let s = raw.trim()

  // Strip common unit suffixes
  s = s.replace(/\s*kg\s*$/i, '')
       .replace(/\s*%\s*$/, '')
       .replace(/\s*cm\s*$/i, '')
       .trim()

  if (!s) return null

  // If exactly one comma and no dot → comma is the decimal separator
  const commas = (s.match(/,/g) ?? []).length
  const dots   = (s.match(/\./g) ?? []).length
  if (commas === 1 && dots === 0) {
    s = s.replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }

  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

/**
 * Parses Slovak/English boolean cell: "TRUE"/"1"/"yes"/"áno" → true, else false.
 */
function parseBool(raw: string | undefined): boolean {
  if (!raw) return false
  const s = raw.trim().toLowerCase()
  return s === 'true' || s === '1' || s === 'yes' || s === 'áno' || s === 'ano'
}

// ============================================================
// ACTIVITY TYPE NORMALIZER
// ============================================================

const ACTIVITY_TYPE_MAP: Record<string, string> = {
  // Slovak names from Strava export
  'jazda na bicykli': 'ride',
  'jazda': 'ride',
  'beh': 'run',
  'chôdza': 'walk',
  'prechádzka': 'walk',
  'turistika': 'hike',
  'plávanie': 'swim',
  'silový tréning': 'gym',
  'silove treningy': 'gym',
  'tenis': 'tennis',
  'badminton': 'badminton',
  'golf': 'golf',
  'spinning': 'spinning',
  'yoga': 'yoga',
  'jóga': 'yoga',
  'crossfit': 'crossfit',
  'lyžovanie': 'ski',
  'alpske lyžovanie': 'ski',
  'veslovanie': 'rowing',
  'kajak': 'kayaking',
  'futbal': 'soccer',
  'basketbal': 'basketball',
  'squash': 'squash',
  // English Strava API names
  'ride': 'ride',
  'virtualride': 'virtual_ride',
  'run': 'run',
  'walk': 'walk',
  'hike': 'hike',
  'swim': 'swim',
  'weighttraining': 'gym',
  'workout': 'gym',
  'alpineski': 'ski',
  'backcountryski': 'ski',
  'iceskate': 'ice_skate',
}

function normalizeActivityType(raw: string): string {
  const lower = raw.trim().toLowerCase()
  return ACTIVITY_TYPE_MAP[lower] ?? lower
}

// ============================================================
// HEALTH METRICS PARSER
// ============================================================

export function parseHealthMetricsRows(
  rows: string[][],
  columnMap: Record<string, number>,
  source = 'google_sheets'
): ParseResult {
  const records: PartialHealthMetrics[] = []
  const errors: string[] = []
  let skipped = 0

  const dataRows = rows.slice(1)

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rowNum = i + 2

    if (isEmptyRow(row)) { skipped++; continue }

    const rawDate = row[columnMap['date']]
    const date = rawDate ? parseFlexibleDate(rawDate) : null
    if (!date) {
      errors.push(`Row ${rowNum}: could not parse date "${rawDate ?? ''}"`)
      skipped++
      continue
    }

    const record: PartialHealthMetrics = {
      date,
      source,
      sleep_minutes:       parseSleepMinutes(row[columnMap['sleep_minutes']]),
      deep_sleep_minutes:  parseSleepMinutes(row[columnMap['deep_sleep_minutes']]),
      rem_sleep_minutes:   parseSleepMinutes(row[columnMap['rem_sleep_minutes']]),
      resting_hr:          parseInt2(row[columnMap['resting_hr']]),
      hrv_ms:              parseNum(row[columnMap['hrv_ms']]),
      vo2max:              parseNum(row[columnMap['vo2max']]),
      steps:               parseInt2(row[columnMap['steps']]),
      active_energy_kcal:  parseInt2(row[columnMap['active_energy_kcal']]),
      resting_energy_kcal: parseInt2(row[columnMap['resting_energy_kcal']]),
      respiratory_rate:    parseNum(row[columnMap['respiratory_rate']]),
      source_payload:      null,
    }

    records.push(record)
  }

  return { records, skipped, errors }
}

// ============================================================
// WEIGHT LOGS PARSER
// ============================================================

export function parseWeightLogsRows(
  rows: string[][],
  columnMap: Record<string, number>
): WeightParseResult {
  const records: PartialWeightLog[] = []
  const errors: string[] = []
  let skipped = 0

  const dataRows = rows.slice(1)

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rowNum = i + 2

    if (row.every((cell) => !cell || !cell.trim())) { skipped++; continue }

    const rawDate = row[columnMap['date']]
    const date = rawDate ? parseFlexibleDate(rawDate) : null
    if (!date) {
      errors.push(`Row ${rowNum}: could not parse date "${rawDate ?? ''}"`)
      skipped++
      continue
    }

    const rawWeight = row[columnMap['weight_kg']]
    const weight_kg = parseWeightNum(rawWeight)
    if (weight_kg === null) {
      errors.push(`Row ${rowNum}: missing or invalid weight "${rawWeight ?? ''}"`)
      skipped++
      continue
    }

    const record: PartialWeightLog = {
      date,
      weight_kg,
      body_fat_percent: 'body_fat_percent' in columnMap
        ? parseWeightNum(row[columnMap['body_fat_percent']])
        : null,
      waist_cm: 'waist_cm' in columnMap
        ? parseWeightNum(row[columnMap['waist_cm']])
        : null,
      notes: null,
    }

    records.push(record)
  }

  return { records, skipped, errors }
}

// ============================================================
// STRAVA ACTIVITIES PARSER
// ============================================================

export function parseStravaActivitiesRows(
  rows: string[][],
  columnMap: Record<string, number>
): ActivityParseResult {
  const records: PartialActivity[] = []
  const errors: string[] = []
  let skipped = 0

  const dataRows = rows.slice(1)

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rowNum = i + 2

    if (isEmptyRow(row)) { skipped++; continue }

    // Required: external_id
    const rawId = row[columnMap['external_id']]
    const external_id = rawId ? String(rawId).trim() : null
    if (!external_id) {
      errors.push(`Row ${rowNum}: missing activity ID`)
      skipped++
      continue
    }

    // Required: start_time
    const rawDate = row[columnMap['start_time']]
    const start_time = rawDate ? parseFlexibleDateTime(rawDate) : null
    if (!start_time) {
      errors.push(`Row ${rowNum}: could not parse date "${rawDate ?? ''}"`)
      skipped++
      continue
    }

    // Required: activity_type
    const rawType = row[columnMap['activity_type']]
    if (!rawType || !rawType.trim()) {
      errors.push(`Row ${rowNum}: missing activity type`)
      skipped++
      continue
    }
    const activity_type = normalizeActivityType(rawType)

    // Required: title
    const rawTitle = row[columnMap['title']]
    const title = rawTitle ? rawTitle.trim() : null
    if (!title) {
      errors.push(`Row ${rowNum}: missing title`)
      skipped++
      continue
    }

    // Build source_payload from extra columns
    const source_payload: Record<string, unknown> = {}
    const addPayload = (key: string, val: unknown) => {
      if (val !== null && val !== undefined) source_payload[key] = val
    }

    addPayload('elapsed_minutes',      parseInt2(row[columnMap['elapsed_minutes']]))
    addPayload('max_power',            parseInt2(row[columnMap['max_power']]))
    addPayload('normalized_power',     parseInt2(row[columnMap['normalized_power']]))
    addPayload('avg_cadence',          parseInt2(row[columnMap['avg_cadence']]))
    addPayload('suffer_score',         parseInt2(row[columnMap['suffer_score']]))
    addPayload('avg_speed_kmh',        parseWeightNum(row[columnMap['avg_speed_kmh']]))
    addPayload('max_speed_kmh',        parseWeightNum(row[columnMap['max_speed_kmh']]))
    addPayload('kilojoules',           parseWeightNum(row[columnMap['kilojoules']]))
    addPayload('gear_id',              row[columnMap['gear_id']]?.trim() || undefined)
    addPayload('start_latlng',         row[columnMap['start_latlng']]?.trim() || undefined)
    addPayload('trainer',              'trainer' in columnMap ? parseBool(row[columnMap['trainer']]) : undefined)
    addPayload('commute',              'commute' in columnMap ? parseBool(row[columnMap['commute']]) : undefined)
    addPayload('legs_feeling',         parseInt2(row[columnMap['legs_feeling']]))
    addPayload('sleep_previous_night', parseWeightNum(row[columnMap['sleep_previous_night']]))

    const record: PartialActivity = {
      source:           'strava_google_sheets',
      external_id,
      activity_type,
      title,
      start_time,
      duration_minutes:  parseInt2(row[columnMap['duration_minutes']]),
      distance_km:       parseWeightNum(row[columnMap['distance_km']]),
      elevation_gain_m:  parseInt2(row[columnMap['elevation_gain_m']]),
      avg_hr:            parseInt2(row[columnMap['avg_hr']]),
      max_hr:            parseInt2(row[columnMap['max_hr']]),
      avg_power:         parseInt2(row[columnMap['avg_power']]),
      calories:          parseInt2(row[columnMap['calories']]),
      perceived_effort:  parseInt2(row[columnMap['perceived_effort']]),
      difficulty_note:   row[columnMap['difficulty_note']]?.trim() || null,
      weather_temp_c:    null,
      weather_wind_kph:  null,
      source_payload:    Object.keys(source_payload).length > 0 ? source_payload : null,
    }

    records.push(record)
  }

  return { records, skipped, errors }
}

// ============================================================
// APPLE HEALTH SLEEP SHEET PARSER
// ============================================================

/** Parses "96%" or "96.5" → 96.5. Handles comma decimals. */
function parsePct(raw: string | undefined): number | null {
  if (!raw || raw.trim() === '' || raw.trim() === '-') return null
  const s = raw.trim().replace('%', '').trim().replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

/** Parses temperature delta "+0.2" / "-0.1" or absolute "36.5". */
function parseTemp(raw: string | undefined): number | null {
  if (!raw || raw.trim() === '' || raw.trim() === '-') return null
  const s = raw.trim().replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

export interface SleepParseResult {
  records: Array<{
    date: string
    start_time: string | null
    end_time: string | null
    in_bed_minutes: number | null
    asleep_minutes: number | null
    awake_minutes: number | null
    rem_minutes: number | null
    core_minutes: number | null
    deep_minutes: number | null
    wake_count: number | null
    efficiency_pct: number | null
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
    // Legacy health_metrics fields — kept for backward compat upsert
    sleep_minutes: number | null
    deep_sleep_minutes: number | null
    rem_sleep_minutes: number | null
  }>
  skipped: number
  errors: string[]
}

export function parseSleepSheetRows(
  rows: string[][],
  columnMap: Record<string, number>,
  source = 'google_sheets_sleep'
): SleepParseResult {
  const records: SleepParseResult['records'] = []
  const errors: string[] = []
  let skipped = 0

  const col = (field: string) => columnMap[field] !== undefined ? columnMap[field] : -1
  const cell = (row: string[], field: string) => col(field) >= 0 ? row[col(field)] : undefined

  const dataRows = rows.slice(1)

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rowNum = i + 2

    if (isEmptyRow(row)) { skipped++; continue }

    const rawDate = cell(row, 'date')
    const date = rawDate ? parseFlexibleDate(rawDate) : null
    if (!date) {
      errors.push(`Row ${rowNum}: could not parse date "${rawDate ?? ''}"`)
      skipped++
      continue
    }

    const asleep = parseSleepMinutes(cell(row, 'asleep_minutes'))
    const inBed  = parseSleepMinutes(cell(row, 'in_bed_minutes'))
    const deep   = parseSleepMinutes(cell(row, 'deep_minutes'))
    const rem    = parseSleepMinutes(cell(row, 'rem_minutes'))
    const core   = parseSleepMinutes(cell(row, 'core_minutes'))
    const awake  = parseSleepMinutes(cell(row, 'awake_minutes'))

    // Skip rows with no usable sleep data
    if (asleep == null && inBed == null && deep == null && rem == null && core == null) {
      skipped++
      continue
    }

    // Parse start_time and end_time — full datetime if available, else null
    const rawStart = cell(row, 'start_time')
    const rawEnd   = cell(row, 'end_time')
    const startIso = rawStart ? parseFlexibleDateTime(rawStart) : null
    const endIso   = rawEnd   ? parseFlexibleDateTime(rawEnd)   : null

    records.push({
      date,
      start_time:           startIso,
      end_time:             endIso,
      in_bed_minutes:       inBed,
      asleep_minutes:       asleep,
      awake_minutes:        awake,
      rem_minutes:          rem,
      core_minutes:         core,
      deep_minutes:         deep,
      wake_count:           parseInt2(cell(row, 'wake_count')),
      efficiency_pct:       parsePct(cell(row, 'efficiency_pct')),
      fall_asleep_minutes:  parseSleepMinutes(cell(row, 'fall_asleep_minutes')),
      avg_respiration_rate: parseNum(cell(row, 'avg_respiration_rate')),
      wrist_temperature:    parseTemp(cell(row, 'wrist_temperature')),
      low_spo2:             parsePct(cell(row, 'low_spo2')),
      high_spo2:            parsePct(cell(row, 'high_spo2')),
      avg_spo2:             parsePct(cell(row, 'avg_spo2')),
      low_hrv:              parseNum(cell(row, 'low_hrv')),
      high_hrv:             parseNum(cell(row, 'high_hrv')),
      avg_hrv:              parseNum(cell(row, 'avg_hrv')),
      source,
      // Legacy fields for health_metrics backward compat
      sleep_minutes:      asleep,
      deep_sleep_minutes: deep,
      rem_sleep_minutes:  rem,
    })
  }

  return { records, skipped, errors }
}

// Expose parseFlexibleDateTime for sync.ts
export { parseFlexibleDateTime as _parseFlexibleDateTime }
