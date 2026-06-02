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

// ── Sleep stage → accumulator key ────────────────────────────────────────────

const SLEEP_STAGE_MAP: Record<string, 'inBed' | 'core' | 'rem' | 'deep' | 'awake' | 'unspecified'> = {
  inBed:             'inBed',
  asleepCore:        'core',
  asleepREM:         'rem',
  asleepDeep:        'deep',
  awake:             'awake',
  asleepUnspecified: 'unspecified',
}

interface SleepAccum {
  inBed:        number
  core:         number
  rem:          number
  deep:         number
  awake:        number
  unspecified:  number
  inBedStartMs: number | null   // earliest inBed start (ms since epoch)
  firstSleepMs: number | null   // earliest sleep-stage start (ms)
  latestEndMs:  number | null   // latest end timestamp across all stages
  endDateStr:   string | null   // raw endDate string of the inBed sample
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

// ── Sleep analysis processor ──────────────────────────────────────────────────

interface SleepResult {
  date: string
  record: Record<string, unknown>
  hmRow: Record<string, unknown>
}

function processSleepAnalysis(
  dataPoints: unknown[],
  userId: string
): SleepResult | null {
  // Single accumulator — HAE is expected to send one night at a time.
  const acc: SleepAccum = {
    inBed: 0, core: 0, rem: 0, deep: 0, awake: 0, unspecified: 0,
    inBedStartMs: null, firstSleepMs: null, latestEndMs: null, endDateStr: null,
  }

  let hasSleepData = false

  for (const point of dataPoints) {
    const p         = point as Record<string, unknown>
    const stageKey  = typeof p.value === 'string' ? SLEEP_STAGE_MAP[p.value] : undefined
    if (!stageKey) continue

    const qty = typeof p.qty === 'number' ? p.qty : null
    if (qty == null || !isFinite(qty) || qty < 0) continue

    hasSleepData = true
    acc[stageKey] += qty

    const startMs  = parseHAETimestampMs(p.startDate ?? p.date)
    const endMs    = parseHAETimestampMs(p.endDate)

    if (stageKey === 'inBed') {
      if (startMs !== null && (acc.inBedStartMs === null || startMs < acc.inBedStartMs)) {
        acc.inBedStartMs = startMs
      }
      // Track the endDate string of the inBed sample for date assignment
      if (typeof p.endDate === 'string' && p.endDate.length >= 10) {
        // Use the end-date of the latest inBed sample as the sleep record date
        if (endMs !== null && (acc.latestEndMs === null || endMs > acc.latestEndMs)) {
          acc.endDateStr = p.endDate
        }
      }
    } else {
      // Track earliest sleep-stage onset for fall_asleep_minutes
      if (startMs !== null && (acc.firstSleepMs === null || startMs < acc.firstSleepMs)) {
        acc.firstSleepMs = startMs
      }
    }

    // Track overall latest end across all samples
    if (endMs !== null && (acc.latestEndMs === null || endMs > acc.latestEndMs)) {
      acc.latestEndMs = endMs
    }
  }

  if (!hasSleepData) return null

  // ── Determine the sleep record date (wake-up date = local end date) ─────────
  // Prefer the endDate of the inBed sample; fall back to date of latest end.
  const sleepDate = acc.endDateStr
    ? acc.endDateStr.slice(0, 10)
    : null

  if (!sleepDate) return null

  // ── Compute derived fields ────────────────────────────────────────────────
  const asleepMinutes = Math.round(acc.core + acc.rem + acc.deep + acc.unspecified)
  const inBedMinutes  = Math.round(acc.inBed)

  const efficiencyPct =
    inBedMinutes > 0
      ? Math.round((asleepMinutes / inBedMinutes) * 100)
      : null

  const fallAsleepMinutes =
    acc.inBedStartMs !== null && acc.firstSleepMs !== null
      ? Math.max(0, Math.round((acc.firstSleepMs - acc.inBedStartMs) / 60_000))
      : null

  // ── Build sleep_records row ───────────────────────────────────────────────
  const record: Record<string, unknown> = {
    user_id:             userId,
    date:                sleepDate,
    source:              'apple_health',
    in_bed_minutes:      inBedMinutes || null,
    asleep_minutes:      asleepMinutes || null,
    core_minutes:        Math.round(acc.core)  || null,
    rem_minutes:         Math.round(acc.rem)   || null,
    deep_minutes:        Math.round(acc.deep)  || null,
    awake_minutes:       Math.round(acc.awake) || null,
    efficiency_pct:      efficiencyPct,
    fall_asleep_minutes: fallAsleepMinutes,
    updated_at:          new Date().toISOString(),
  }

  // ── Build health_metrics backward-compat row ──────────────────────────────
  // Uses source='apple_health_sleep' (separate from 'apple_health' HRV rows)
  // to avoid overwriting HRV/RHR fields on conflict.
  const hmRow: Record<string, unknown> = {
    user_id:             userId,
    date:                sleepDate,
    source:              'apple_health_sleep',
    sleep_minutes:       asleepMinutes || null,
    deep_sleep_minutes:  Math.round(acc.deep) || null,
    rem_sleep_minutes:   Math.round(acc.rem)  || null,
  }

  return { date: sleepDate, record, hmRow }
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

  // ── 5. Extract metrics array ───────────────────────────────────────────────
  const data = body?.data as Record<string, unknown> | undefined
  const metricsRaw = data?.metrics
  if (!Array.isArray(metricsRaw)) {
    return NextResponse.json(
      { ok: false, error: 'Expected body.data.metrics to be an array.' },
      { status: 400 }
    )
  }

  // ── 6. Partition: health metrics vs sleep_analysis vs ignored weight ─────────
  const healthMetricGroups: unknown[] = []
  const sleepAnalysisPoints: unknown[] = []
  const metricsIgnored: string[] = []   // weight/body-comp fields present but skipped

  for (const metricGroup of metricsRaw) {
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
  const sleepResult = sleepAnalysisPoints.length > 0
    ? processSleepAnalysis(sleepAnalysisPoints, userId)
    : null

  // ── 10. Guard: at least something recognised ──────────────────────────────
  if (datesFound.length === 0 && sleepResult === null) {
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
  let sleepDate: string | null = null

  if (sleepResult) {
    sleepDate = sleepResult.date

    // 12a. sleep_records
    const { error: sleepErr } = await supabase
      .from('sleep_records')
      .upsert(sleepResult.record, { onConflict: 'user_id,date,source' })

    if (sleepErr) {
      console.error('[hae/ingest] sleep_records upsert error:', sleepErr.message)
      // Non-fatal — log and continue
    }

    // 12b. health_metrics backward-compat (source='apple_health_sleep')
    const { error: sleepHmErr } = await supabase
      .from('health_metrics')
      .upsert(sleepResult.hmRow, { onConflict: 'user_id,date,source' })

    if (sleepHmErr) {
      console.error('[hae/ingest] sleep health_metrics upsert error:', sleepHmErr.message)
    }
  }

  // ── 13. Detect which columns were actually populated ──────────────────────
  const metricsImported: string[] = Object.values(METRIC_MAP).filter(col =>
    datesFound.some(d => byDate[d][col as keyof RowFields]?.length)
  )

  if (sleepResult) {
    if (sleepResult.hmRow.sleep_minutes != null)      metricsImported.push('sleep_minutes')
    if (sleepResult.hmRow.deep_sleep_minutes != null) metricsImported.push('deep_sleep_minutes')
    if (sleepResult.hmRow.rem_sleep_minutes != null)  metricsImported.push('rem_sleep_minutes')
  }

  // ── 14. Write import log ──────────────────────────────────────────────────
  const allDates = [...new Set([...datesFound, ...(sleepDate ? [sleepDate] : [])])].sort()

  await supabase.from('data_import_logs').insert({
    user_id: userId,
    source:  'health_auto_export',
    status:  'success',
    rows_read:     totalSamplesRead + sleepAnalysisPoints.length,
    rows_imported: rowsToUpsert.length + (sleepResult ? 1 : 0),
    rows_skipped:  0,
    error_message: null,
    metadata: {
      date_range:        allDates,
      metrics_detected:  metricsImported,
      metrics_ignored:   metricsIgnored.length > 0 ? metricsIgnored : undefined,
      ingest_timestamp:  new Date().toISOString(),
      row_count:         rowsToUpsert.length + (sleepResult ? 1 : 0),
    },
  })

  // ── 15. Success response ──────────────────────────────────────────────────
  return NextResponse.json({
    ok:             true,
    source:         'apple_health',
    datesImported:  allDates,
    metricsImported,
    rowsImported:   rowsToUpsert.length + (sleepResult ? 1 : 0),
    ...(sleepResult        ? { sleepDate }      : {}),
    ...(metricsIgnored.length > 0 ? { metricsIgnored } : {}),
  })
}
