/**
 * POST /api/integrations/hae/ingest
 *
 * Receives Health Auto Export REST API payloads directly into KeepGoing.
 * No Supabase session required — auth via static Bearer token.
 *
 * Phase 1: health_metrics (HRV, RHR, active energy, resting energy,
 *          steps, VO2max, respiratory rate).
 * Phase 2: sleep_analysis → sleep_records + health_metrics (sleep fields).
 *
 * Expects one completed day per request. Rejects oversized payloads.
 * Idempotent — repeated calls for the same day are safe.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── HAE metric name → health_metrics column ───────────────────────────────────

const METRIC_MAP: Record<string, keyof RowFields> = {
  heart_rate_variability: 'hrv_ms',
  resting_heart_rate:     'resting_hr',
  active_energy:          'active_energy_kcal',
  basal_energy_burned:    'resting_energy_kcal',
  step_count:             'steps',
  vo2max:                 'vo2max',
  respiratory_rate:       'respiratory_rate',
}

// ── Weight / body-composition metrics — explicitly ignored ────────────────────
//
// Weight is manually logged in KeepGoing. Historical imported weight is kept,
// but new HAE weight is ignored. Manual KeepGoing weight is the only active
// source for new weight data going forward.
//
const WEIGHT_IGNORE_KEYS = new Set([
  'weight_body_mass',
  'body_mass',
  'body_fat_percentage',
  'body_fat_percent',
  'weight',
  'lean_body_mass',
  'body_mass_index',
  'bmi',
])

interface RowFields {
  hrv_ms:              number | null
  resting_hr:          number | null
  active_energy_kcal:  number | null
  resting_energy_kcal: number | null
  steps:               number | null
  vo2max:              number | null
  respiratory_rate:    number | null
}


// ── HKWorkoutActivityType → activities.activity_type ─────────────────────────

const WORKOUT_TYPE_MAP: Record<string, string> = {
  // Full HK names
  HKWorkoutActivityTypeWalking:                       'walking',
  HKWorkoutActivityTypeRunning:                       'running',
  HKWorkoutActivityTypeCycling:                       'cycling',
  HKWorkoutActivityTypeHiking:                        'hiking',
  HKWorkoutActivityTypeGolf:                          'golf',
  HKWorkoutActivityTypeTraditionalStrengthTraining:   'strength',
  HKWorkoutActivityTypeFunctionalStrengthTraining:    'strength',
  HKWorkoutActivityTypeCoreTraining:                  'strength',
  HKWorkoutActivityTypeYoga:                          'yoga',
  HKWorkoutActivityTypeMobility:                      'mobility',
  HKWorkoutActivityTypeFlexibility:                   'mobility',
  HKWorkoutActivityTypeBadminton:                     'badminton',
  HKWorkoutActivityTypeSwimming:                      'swimming',
  HKWorkoutActivityTypeElliptical:                    'elliptical',
  HKWorkoutActivityTypeStairClimbing:                 'stair_climbing',
  HKWorkoutActivityTypeHighIntensityIntervalTraining: 'hiit',
  HKWorkoutActivityTypeCrossTraining:                 'cross_training',
  HKWorkoutActivityTypePilates:                       'pilates',
  HKWorkoutActivityTypeBoxing:                        'boxing',
  HKWorkoutActivityTypeMartialArts:                   'martial_arts',
  HKWorkoutActivityTypeRowing:                        'rowing',
  HKWorkoutActivityTypeSoccer:                        'soccer',
  HKWorkoutActivityTypeTennis:                        'tennis',
  HKWorkoutActivityTypeBasketball:                    'basketball',
  HKWorkoutActivityTypeOther:                         'other',
  // Short names (some HAE versions omit the HK prefix)
  Walking: 'walking', Running: 'running', Cycling: 'cycling', Hiking: 'hiking',
  Golf: 'golf', Yoga: 'yoga', Mobility: 'mobility', Badminton: 'badminton',
  Swimming: 'swimming', Rowing: 'rowing', Other: 'other',
  TraditionalStrengthTraining: 'strength', FunctionalStrengthTraining: 'strength',
}

// ── Aggregation helpers ───────────────────────────────────────────────────────

function avgArr(arr: number[]): number {
  return arr.reduce((s, n) => s + n, 0) / arr.length
}
function maxArr(arr: number[]): number {
  return Math.max(...arr)
}
function lastVal(arr: number[]): number {
  return arr[arr.length - 1]
}

// ── Date / timestamp extraction ───────────────────────────────────────────────

/**
 * HAE timestamp format: "2026-06-01 06:30:00 +0200"
 * Extracts the local date portion (first 10 chars) — no UTC conversion.
 */
function extractDate(rawDate: unknown): string | null {
  if (typeof rawDate !== 'string') return null
  const d = rawDate.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

/**
 * Parse a HAE timestamp string into milliseconds since epoch.
 * Normalises "2026-06-01 22:00:00 +0200" → "2026-06-01T22:00:00+02:00".
 * Used only for computing durations (diff); no timezone conversion of the date.
 */
function parseHAETimestampMs(raw: unknown): number | null {
  if (typeof raw !== 'string') return null
  // "2026-06-01 22:00:00 +0200"
  //  → replace first space with T  → "2026-06-01T22:00:00 +0200"
  //  → remove remaining space      → "2026-06-01T22:00:00+0200"
  //  → insert colon in tz offset   → "2026-06-01T22:00:00+02:00"
  const normalized = raw
    .replace(' ', 'T')
    .replace(' ', '')
    .replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  const ms = Date.parse(normalized)
  return isNaN(ms) ? null : ms
}

// ── Workout field helpers ─────────────────────────────────────────────────────

/**
 * Extract a numeric quantity from either a plain number or a HAE { qty, units } object.
 */
function getQty(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v) && v >= 0) return v
  if (v != null && typeof v === 'object' && 'qty' in v) {
    const q = (v as { qty: unknown }).qty
    if (typeof q === 'number' && isFinite(q) && q >= 0) return q
  }
  return null
}

/**
 * Extract distance as km.
 * HAE sends native HealthKit units (meters) as a plain number OR { qty, units }.
 * When units are specified we use them; otherwise we assume meters.
 */
function getDistanceKm(v: unknown): number | null {
  if (v == null) return null
  const qty = getQty(v)
  if (qty == null || qty <= 0) return null

  if (typeof v === 'object' && v !== null && 'units' in v) {
    const u = ((v as { units?: unknown }).units ?? '').toString().toLowerCase()
    if (u === 'km')                           return Math.round(qty * 100) / 100
    if (u === 'mi' || u === 'miles')          return Math.round(qty * 1.60934 * 100) / 100
    // 'm' or unrecognised → assume meters
    return Math.round((qty / 1000) * 100) / 100
  }

  // Bare number: if < 500, treat as km (unusual); otherwise meters.
  // Most HealthKit distances are in meters so > 500 is very common.
  return qty < 500
    ? Math.round(qty * 100) / 100
    : Math.round((qty / 1000) * 100) / 100
}

/**
 * Normalise a HAE timestamp string to ISO 8601 for DB storage.
 * "2026-06-01 10:00:00 +0200" → "2026-06-01T10:00:00+02:00"
 */
function normalizeHAETimestamp(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw
    .replace(' ', 'T')
    .replace(' ', '')
    .replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  return isNaN(Date.parse(s)) ? null : s
}

// ── Workout processor ─────────────────────────────────────────────────────────

function processWorkouts(
  workouts: unknown[],
  userId: string
): { rows: Record<string, unknown>[]; skipped: number } {
  const rows: Record<string, unknown>[] = []
  let skipped = 0

  for (const w of workouts) {
    const workout = w as Record<string, unknown>

    // ── Activity type ─────────────────────────────────────────────────────────
    const rawType = typeof workout.workoutActivityType === 'string'
      ? workout.workoutActivityType : ''
    const activityType = WORKOUT_TYPE_MAP[rawType] ?? 'other'

    // ── Start time — try both 'start' and 'startDate' ─────────────────────────
    const startTime = normalizeHAETimestamp(workout.start)
                   ?? normalizeHAETimestamp(workout.startDate)
    if (!startTime) { skipped++; continue }

    // ── External ID — try uuid → id → generate stable fallback ───────────────
    // HAE should send uuid but some configurations omit it; a deterministic
    // fallback lets us upsert idempotently even without an explicit UUID.
    const rawUuid =
      (typeof workout.uuid === 'string' && workout.uuid.trim())     ? workout.uuid.trim()     :
      (typeof workout.id   === 'string' && workout.id.trim())       ? workout.id.trim()       :
      null
    const externalId = rawUuid ?? `hae_${userId}_${startTime}_${activityType}`.replace(/[^a-zA-Z0-9_-]/g, '_')

    // ── Duration: HAE sends seconds ───────────────────────────────────────────
    const durationSec = getQty(workout.duration)
    const durationMin = durationSec != null && durationSec > 0
      ? Math.round(durationSec / 60)
      : (() => {
          const endMs   = parseHAETimestampMs(workout.end ?? workout.endDate)
          const startMs = parseHAETimestampMs(workout.start ?? workout.startDate)
          return (endMs != null && startMs != null && endMs > startMs)
            ? Math.round((endMs - startMs) / 60_000)
            : null
        })()

    // ── Title ─────────────────────────────────────────────────────────────────
    const typeLabel = activityType.charAt(0).toUpperCase() + activityType.slice(1).replace(/_/g, ' ')
    const startDate = startTime.slice(0, 10)
    const title = (typeof workout.name === 'string' && workout.name.trim())
      ? workout.name.trim()
      : `${typeLabel} — ${startDate}`

    // ── Optional metrics ──────────────────────────────────────────────────────
    const distanceKm = getDistanceKm(workout.totalDistance ?? workout.distance)
    const calories   = getQty(workout.activeEnergyBurned ?? workout.totalEnergyBurned)
    const avgHr      = getQty(workout.avgHeartRate ?? workout.averageHeartRate)
    const maxHr      = getQty(workout.maxHeartRate)

    rows.push({
      user_id:          userId,
      source:           'apple_health_workout',
      external_id:      externalId,
      activity_type:    activityType,
      title,
      start_time:       startTime,
      duration_minutes: durationMin,
      distance_km:      distanceKm != null && distanceKm > 0 ? distanceKm : null,
      calories:         calories   != null && calories   > 0 ? Math.round(calories) : null,
      avg_hr:           avgHr      != null && avgHr      > 0 ? Math.round(avgHr)    : null,
      max_hr:           maxHr      != null && maxHr      > 0 ? Math.round(maxHr)    : null,
      elevation_gain_m: null,
      avg_power:        null,
      perceived_effort: null,
      difficulty_note:  null,
      weather_temp_c:   null,
      weather_wind_kph: null,
      source_payload:   null,
    })
  }

  return { rows, skipped }
}

// ── Sleep analysis processor ──────────────────────────────────────────────────
//
// HAE sends sleep_analysis as aggregated nightly objects (NOT stage-by-stage).
// Each object represents one sleep episode with pre-computed stage durations
// already in HOURS (core, rem, deep, awake, totalSleep).
//
// Example object:
//   { date, sleepStart, sleepEnd, inBedEnd, inBed,
//     totalSleep, core, rem, deep, awake, source }
//
// Values are in hours. Multiply by 60 to get minutes.
// date.slice(0,10) is the wake-up date — no timezone conversion.

interface SleepResult {
  date: string
  record: Record<string, unknown>
  hmRow: Record<string, unknown>
}

function processSleepAnalysis(
  dataPoints: unknown[],
  userId: string
): SleepResult[] {
  // ── Group samples by wake-up date ─────────────────────────────────────────
  const byDate: Record<string, Record<string, unknown>[]> = {}

  for (const point of dataPoints) {
    const p = point as Record<string, unknown>
    const dateStr = typeof p.date === 'string' ? p.date.slice(0, 10) : null
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue
    if (!byDate[dateStr]) byDate[dateStr] = []
    byDate[dateStr].push(p)
  }

  const results: SleepResult[] = []

  for (const [date, samples] of Object.entries(byDate)) {
    // ── Pick the main sleep episode (largest totalSleep) ───────────────────
    if (samples.length > 1) {
      console.log(`[hae/ingest] sleep_analysis: ${samples.length} samples for ${date} — picking largest totalSleep`)
    }

    const best = samples.reduce((prev, curr) => {
      const pTotal = typeof prev.totalSleep === 'number' ? prev.totalSleep : 0
      const cTotal = typeof curr.totalSleep === 'number' ? curr.totalSleep : 0
      return cTotal > pTotal ? curr : prev
    })

    const totalSleepH = typeof best.totalSleep === 'number' && best.totalSleep > 0
      ? best.totalSleep : null
    if (totalSleepH == null) continue   // skip if no valid sleep duration

    // ── Stage durations (hours → minutes) ──────────────────────────────────
    const asleepMinutes = Math.round(totalSleepH * 60)

    const hrToMin = (field: string): number | null => {
      const v = best[field]
      return typeof v === 'number' && v > 0 ? Math.round(v * 60) : null
    }
    const coreMinutes  = hrToMin('core')
    const remMinutes   = hrToMin('rem')
    const deepMinutes  = hrToMin('deep')
    const awakeMinutes = hrToMin('awake')

    // ── in_bed_minutes ──────────────────────────────────────────────────────
    // inBed field (hours) > 0 → use it directly.
    // Otherwise derive from inBedEnd − sleepStart timestamps.
    const inBedH = typeof best.inBed === 'number' ? best.inBed : null
    let inBedMinutes: number | null = null

    if (inBedH != null && inBedH > 0) {
      inBedMinutes = Math.round(inBedH * 60)
    } else {
      const inBedEndMs   = parseHAETimestampMs(best.inBedEnd)
      const sleepStartMs = parseHAETimestampMs(best.sleepStart)
      if (inBedEndMs != null && sleepStartMs != null && inBedEndMs > sleepStartMs) {
        inBedMinutes = Math.round((inBedEndMs - sleepStartMs) / 60_000)
      }
    }

    // ── efficiency_pct ──────────────────────────────────────────────────────
    const efficiencyPct = inBedMinutes != null && inBedMinutes > 0
      ? Math.min(100, Math.round((asleepMinutes / inBedMinutes) * 100))
      : null

    // ── fall_asleep_minutes ─────────────────────────────────────────────────
    // Requires both inBedStart and sleepStart fields.
    let fallAsleepMinutes: number | null = null
    const inBedStartMs = parseHAETimestampMs(best.inBedStart)
    const sleepStartMs = parseHAETimestampMs(best.sleepStart)
    if (inBedStartMs != null && sleepStartMs != null && sleepStartMs >= inBedStartMs) {
      fallAsleepMinutes = Math.max(0, Math.round((sleepStartMs - inBedStartMs) / 60_000))
    }

    // ── Timestamps — normalize to ISO 8601 for reliable DB storage ────────────
    // Raw HAE: "2026-06-01 21:43:00 +0200" → normalized: "2026-06-01T21:43:00+02:00"
    const startTime = normalizeHAETimestamp(best.sleepStart)
    const endTime   = normalizeHAETimestamp(best.sleepEnd)
                   ?? normalizeHAETimestamp(best.inBedEnd)

    // ── sleep_records row ───────────────────────────────────────────────────
    const record: Record<string, unknown> = {
      user_id:             userId,
      date,
      source:              'apple_health',
      start_time:          startTime,
      end_time:            endTime,
      in_bed_minutes:      inBedMinutes,
      asleep_minutes:      asleepMinutes,
      core_minutes:        coreMinutes,
      rem_minutes:         remMinutes,
      deep_minutes:        deepMinutes,
      awake_minutes:       awakeMinutes,
      efficiency_pct:      efficiencyPct,
      fall_asleep_minutes: fallAsleepMinutes,
      wake_count:          null,
      updated_at:          new Date().toISOString(),
    }

    // ── health_metrics backward-compat row ──────────────────────────────────
    // source='apple_health_sleep' keeps HRV/RHR fields safe on conflict.
    const hmRow: Record<string, unknown> = {
      user_id:            userId,
      date,
      source:             'apple_health_sleep',
      sleep_minutes:      asleepMinutes,
      deep_sleep_minutes: deepMinutes,
      rem_sleep_minutes:  remMinutes,
    }

    results.push({ date, record, hmRow })
  }

  return results
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const secret = process.env.HAE_INGEST_SECRET
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'HAE_INGEST_SECRET is not configured on this server.' },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token || token !== secret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  }

  // ── 2. User ID ─────────────────────────────────────────────────────────────
  const userId = process.env.HAE_USER_ID
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'HAE_USER_ID is not configured on this server.' },
      { status: 500 }
    )
  }

  // ── 3. Payload size guard ──────────────────────────────────────────────────
  const contentLength = parseInt(request.headers.get('Content-Length') ?? '0', 10)
  if (contentLength > 1_500_000) {
    return NextResponse.json(
      { ok: false, error: 'Payload too large. Export one completed day at a time.' },
      { status: 413 }
    )
  }

  // ── 4. Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    const raw = await request.text()
    if (raw.length > 1_500_000) {
      return NextResponse.json(
        { ok: false, error: 'Payload too large. Export one completed day at a time.' },
        { status: 413 }
      )
    }
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  // ── 5. Extract data envelope ───────────────────────────────────────────────
  const data = body?.data as Record<string, unknown> | undefined

  // ── 6. Resolve workouts and metrics arrays ─────────────────────────────────
  //
  // HAE sends different payload shapes depending on the automation type:
  //
  //   Health metrics + sleep:  { data: { metrics: [...] } }
  //   Mixed (metrics+workouts): { data: { metrics: [...], workouts: [...] } }
  //   Workout-only:            { data: { workouts: [...] } }   ← no metrics key
  //                       OR:  { workouts: [...] }              ← no data wrapper
  //
  // Workouts at body.workouts is the fallback for workout-only automations that
  // don't wrap the payload in a data envelope.
  const metricsRaw: unknown = data?.metrics

  const workoutsRaw: unknown[] = (() => {
    // Prefer body.data.workouts, fall back to body.workouts (top-level)
    if (Array.isArray(data?.workouts) && (data!.workouts as unknown[]).length > 0)
      return data!.workouts as unknown[]
    if (Array.isArray(body?.workouts) && (body.workouts as unknown[]).length > 0)
      return body.workouts as unknown[]
    return []
  })()

  // Guard: require at least one recognisable data source
  const hasMetrics  = Array.isArray(metricsRaw)
  const hasWorkouts = workoutsRaw.length > 0

  if (!hasMetrics && !hasWorkouts) {
    return NextResponse.json(
      {
        ok: false,
        error: 'No recognized data found. Expected body.data.metrics (health/sleep) or body.data.workouts / body.workouts (workouts).',
      },
      { status: 400 }
    )
  }

  // ── 7. Partition health metrics / sleep_analysis / ignored weight ──────────
  const healthMetricGroups: unknown[] = []
  const sleepAnalysisPoints: unknown[] = []
  const metricsIgnored: string[] = []   // weight/body-comp fields present but skipped

  for (const metricGroup of (hasMetrics ? metricsRaw as unknown[] : [])) {
    const mg   = metricGroup as Record<string, unknown>
    const name = typeof mg.name === 'string' ? mg.name : ''

    if (name === 'sleep_analysis') {
      const dp = mg.data
      if (Array.isArray(dp)) sleepAnalysisPoints.push(...dp)
    } else if (WEIGHT_IGNORE_KEYS.has(name)) {
      // Weight / body-composition — ignored per rule. Historical DB rows kept.
      if (!metricsIgnored.includes(name)) metricsIgnored.push(name)
    } else {
      healthMetricGroups.push(mg)
    }
  }

  // ── 7. Accumulate health metric samples by (date, field) ──────────────────
  const byDate: Record<string, Partial<Record<keyof RowFields, number[]>>> = {}
  let totalSamplesRead = 0

  for (const metricGroup of healthMetricGroups) {
    const mg = metricGroup as Record<string, unknown>
    const haeName = mg.name as string | undefined
    const kgField = haeName ? METRIC_MAP[haeName] : undefined
    if (!kgField) continue

    const dataPoints = mg.data
    if (!Array.isArray(dataPoints)) continue

    for (const point of dataPoints) {
      const p   = point as Record<string, unknown>
      const qty = typeof p.qty === 'number' ? p.qty : null
      if (qty == null || !isFinite(qty)) continue

      const dateStr = extractDate(p.date)
      if (!dateStr) continue

      totalSamplesRead++
      if (!byDate[dateStr]) byDate[dateStr] = {}
      if (!byDate[dateStr][kgField]) byDate[dateStr][kgField] = []
      byDate[dateStr][kgField]!.push(qty)
    }
  }

  const datesFound = Object.keys(byDate).sort()

  // ── 8. Aggregate to one health_metrics row per date ───────────────────────
  const rowsToUpsert = datesFound.map(date => {
    const f = byDate[date]
    const row: Record<string, unknown> = {
      user_id: userId,
      date,
      source: 'apple_health',
    }

    if (f.hrv_ms?.length)              row.hrv_ms              = Math.round(avgArr(f.hrv_ms) * 10) / 10
    if (f.resting_hr?.length)          row.resting_hr          = Math.round(avgArr(f.resting_hr))
    if (f.active_energy_kcal?.length)  row.active_energy_kcal  = Math.round(maxArr(f.active_energy_kcal))
    if (f.resting_energy_kcal?.length) row.resting_energy_kcal = Math.round(maxArr(f.resting_energy_kcal))
    if (f.steps?.length)               row.steps               = Math.round(maxArr(f.steps))
    if (f.vo2max?.length)              row.vo2max              = Math.round(lastVal(f.vo2max) * 10) / 10
    if (f.respiratory_rate?.length)    row.respiratory_rate    = Math.round(avgArr(f.respiratory_rate) * 10) / 10

    return row
  })

  // ── 9. Process sleep_analysis ─────────────────────────────────────────────
  const sleepResults: SleepResult[] = sleepAnalysisPoints.length > 0
    ? processSleepAnalysis(sleepAnalysisPoints, userId)
    : []

  // ── 9b. Process workouts ──────────────────────────────────────────────────
  const { rows: workoutRows, skipped: workoutsSkipped } = workoutsRaw.length > 0
    ? processWorkouts(workoutsRaw, userId)
    : { rows: [], skipped: 0 }

  // ── 10. Guard: at least something recognised ──────────────────────────────
  // Workouts present but all invalid → still 200, not 422 (per HAE requirements:
  // workout-only exports must succeed even if all rows are skipped with explanation).
  if (datesFound.length === 0 && sleepResults.length === 0 && workoutRows.length === 0) {
    if (workoutsRaw.length > 0) {
      return NextResponse.json({
        ok: false,
        error: `Found ${workoutsRaw.length} workout(s) but none could be imported — missing start time on all entries. Check that the HAE workout automation includes start/end timestamps.`,
        workoutsFound:   workoutsRaw.length,
        workoutsSkipped: workoutsRaw.length,
      }, { status: 200 })
    }
    return NextResponse.json(
      { ok: false, error: 'No recognized metric or sleep data found in payload.' },
      { status: 422 }
    )
  }

  // ── 11. Upsert health_metrics ─────────────────────────────────────────────
  const supabase = createAdminClient()

  if (rowsToUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from('health_metrics')
      .upsert(rowsToUpsert, { onConflict: 'user_id,date,source' })

    if (upsertError) {
      console.error('[hae/ingest] health_metrics upsert error:', upsertError.message)
      return NextResponse.json(
        { ok: false, error: `Database error: ${upsertError.message}` },
        { status: 502 }
      )
    }
  }

  // ── 12. Upsert sleep_records + sleep health_metrics ───────────────────────
  const sleepDates: string[] = []

  for (const sr of sleepResults) {
    // 12a. sleep_records
    const { error: sleepErr } = await supabase
      .from('sleep_records')
      .upsert(sr.record, { onConflict: 'user_id,date,source' })

    if (sleepErr) {
      console.error('[hae/ingest] sleep_records upsert error:', sleepErr.message)
      // Non-fatal — continue with remaining nights
    } else {
      sleepDates.push(sr.date)
    }

    // 12b. health_metrics backward-compat (source='apple_health_sleep')
    const { error: sleepHmErr } = await supabase
      .from('health_metrics')
      .upsert(sr.hmRow, { onConflict: 'user_id,date,source' })

    if (sleepHmErr) {
      console.error('[hae/ingest] sleep health_metrics upsert error:', sleepHmErr.message)
    }
  }

  // ── 12c. Upsert workouts ──────────────────────────────────────────────────
  let workoutsImported = 0

  if (workoutRows.length > 0) {
    const { error: workoutErr, count } = await supabase
      .from('activities')
      .upsert(workoutRows, { onConflict: 'user_id,external_id,source', count: 'exact' })

    if (workoutErr) {
      console.error('[hae/ingest] workouts upsert error:', workoutErr.message)
    } else {
      workoutsImported = workoutRows.length
    }
  }

  // ── 13. Detect which columns were actually populated ──────────────────────
  const metricsImported: string[] = Object.values(METRIC_MAP).filter(col =>
    datesFound.some(d => byDate[d][col as keyof RowFields]?.length)
  )

  if (sleepResults.length > 0) {
    const anySleep = sleepResults.some(sr => sr.hmRow.sleep_minutes != null)
    const anyDeep  = sleepResults.some(sr => sr.hmRow.deep_sleep_minutes != null)
    const anyRem   = sleepResults.some(sr => sr.hmRow.rem_sleep_minutes != null)
    if (anySleep) metricsImported.push('sleep_minutes')
    if (anyDeep)  metricsImported.push('deep_sleep_minutes')
    if (anyRem)   metricsImported.push('rem_sleep_minutes')
  }

  // ── 14. Write import log ──────────────────────────────────────────────────
  const allDates = [...new Set([...datesFound, ...sleepDates])].sort()

  const totalRows = rowsToUpsert.length + sleepDates.length + workoutsImported

  await supabase.from('data_import_logs').insert({
    user_id: userId,
    source:  'health_auto_export',
    status:  'success',
    rows_read:     totalSamplesRead + sleepAnalysisPoints.length + workoutsRaw.length,
    rows_imported: totalRows,
    rows_skipped:  0,
    error_message: null,
    metadata: {
      date_range:        allDates,
      metrics_detected:  metricsImported,
      metrics_ignored:   metricsIgnored.length > 0 ? metricsIgnored : undefined,
      workouts_imported: workoutsImported > 0 ? workoutsImported : undefined,
      ingest_timestamp:  new Date().toISOString(),
      row_count:         totalRows,
    },
  })

  // ── 15. Success response ──────────────────────────────────────────────────
  return NextResponse.json({
    ok:              true,
    source:          'apple_health',
    datesImported:   allDates,
    metricsImported,
    rowsImported:    totalRows,
    ...(sleepDates.length    > 0 ? { sleepDates }                                   : {}),
    ...(workoutsImported     > 0 ? { workoutsImported, workoutsQueued: workoutRows.length }         : {}),
    ...(workoutsSkipped      > 0 ? { workoutsSkipped }                                              : {}),
    ...(metricsIgnored.length > 0 ? { metricsIgnored }                               : {}),
  })
}
