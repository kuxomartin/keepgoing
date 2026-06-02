/**
 * POST /api/integrations/hae/ingest
 *
 * Receives Health Auto Export REST API payloads directly into KeepGoing.
 * No Supabase session required — auth via static Bearer token.
 *
 * Phase 1: health_metrics only (HRV, RHR, active energy, resting energy,
 *          steps, VO2max, respiratory rate).
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

interface RowFields {
  hrv_ms:              number | null
  resting_hr:          number | null
  active_energy_kcal:  number | null
  resting_energy_kcal: number | null
  steps:               number | null
  vo2max:              number | null
  respiratory_rate:    number | null
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

// ── Date extraction ───────────────────────────────────────────────────────────

/**
 * HAE timestamp format: "2026-06-01 06:30:00 +0200"
 * We extract the local date portion (first 10 chars) without any UTC shift.
 */
function extractDate(rawDate: unknown): string | null {
  if (typeof rawDate !== 'string') return null
  const d = rawDate.slice(0, 10)
  // Basic YYYY-MM-DD validation
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
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

  // ── 6. Accumulate samples by (date, field) ─────────────────────────────────
  // Structure: { "2026-06-01": { hrv_ms: [52.3], resting_hr: [58], ... } }
  const byDate: Record<string, Partial<Record<keyof RowFields, number[]>>> = {}
  let totalSamplesRead = 0

  for (const metricGroup of metricsRaw) {
    const mg = metricGroup as Record<string, unknown>
    const haeName  = mg.name as string | undefined
    const kgField  = haeName ? METRIC_MAP[haeName] : undefined
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
  if (datesFound.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'No recognized metric data found in payload.' },
      { status: 422 }
    )
  }

  // ── 7. Aggregate to one row per date ───────────────────────────────────────
  const rowsToUpsert = datesFound.map(date => {
    const f = byDate[date]
    const row: Record<string, unknown> = {
      user_id: userId,
      date,
      source: 'apple_health',
    }

    // HRV — daily average (overnight measurements)
    if (f.hrv_ms?.length) {
      row.hrv_ms = Math.round(avgArr(f.hrv_ms) * 10) / 10
    }

    // Resting HR — daily average
    if (f.resting_hr?.length) {
      row.resting_hr = Math.round(avgArr(f.resting_hr))
    }

    // Active energy — max (Apple Health daily total is often sent as one value;
    // if multiple samples, the cumulative total is the largest)
    if (f.active_energy_kcal?.length) {
      row.active_energy_kcal = Math.round(maxArr(f.active_energy_kcal))
    }

    // Resting (basal) energy — same as active
    if (f.resting_energy_kcal?.length) {
      row.resting_energy_kcal = Math.round(maxArr(f.resting_energy_kcal))
    }

    // Steps — max (cumulative daily total)
    if (f.steps?.length) {
      row.steps = Math.round(maxArr(f.steps))
    }

    // VO2max — most recent value
    if (f.vo2max?.length) {
      row.vo2max = Math.round(lastVal(f.vo2max) * 10) / 10
    }

    // Respiratory rate — daily average
    if (f.respiratory_rate?.length) {
      row.respiratory_rate = Math.round(avgArr(f.respiratory_rate) * 10) / 10
    }

    return row
  })

  // ── 8. Upsert into health_metrics ─────────────────────────────────────────
  const supabase = createAdminClient()
  const { error: upsertError } = await supabase
    .from('health_metrics')
    .upsert(rowsToUpsert, { onConflict: 'user_id,date,source' })

  // ── 9. Detect which columns were actually populated ────────────────────────
  const metricsImported = Object.values(METRIC_MAP).filter(col =>
    datesFound.some(d => byDate[d][col as keyof RowFields]?.length)
  )

  // ── 10. Write import log ───────────────────────────────────────────────────
  await supabase.from('data_import_logs').insert({
    user_id: userId,
    source:  'health_auto_export',
    status:  upsertError ? 'error' : 'success',
    rows_read:     totalSamplesRead,
    rows_imported: upsertError ? 0 : rowsToUpsert.length,
    rows_skipped:  0,
    error_message: upsertError?.message ?? null,
    metadata: {
      date_range:       datesFound,
      metrics_detected: metricsImported,
      ingest_timestamp: new Date().toISOString(),
      row_count:        rowsToUpsert.length,
    },
  })

  if (upsertError) {
    console.error('[hae/ingest] upsert error:', upsertError.message)
    return NextResponse.json(
      { ok: false, error: `Database error: ${upsertError.message}` },
      { status: 502 }
    )
  }

  // ── 11. Success response ───────────────────────────────────────────────────
  return NextResponse.json({
    ok:              true,
    source:          'apple_health',
    datesImported:   datesFound,
    metricsImported,
    rowsImported:    rowsToUpsert.length,
  })
}
