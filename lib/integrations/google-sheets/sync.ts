// SERVER-ONLY — orchestrates fetch → parse → upsert → log for all data types

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ImportSummary, GoogleSheetImport } from '@/types/database'
import { fetchSheetRows } from './client'
import {
  HEALTH_METRICS_ALIASES, HEALTH_METRICS_REQUIRED,
  WEIGHT_LOGS_ALIASES,    WEIGHT_LOGS_REQUIRED,
  STRAVA_ACTIVITIES_ALIASES, STRAVA_ACTIVITIES_REQUIRED,
  SLEEP_SHEET_ALIASES, SLEEP_SHEET_REQUIRED,
  resolveColumnMap, getMissingRequired,
} from './mapper'
import {
  parseHealthMetricsRows,
  parseWeightLogsRows,
  parseStravaActivitiesRows,
  parseSleepSheetRows,
} from './parser'

// ============================================================
// HEALTH METRICS
// ============================================================

export async function syncHealthMetrics(
  userId: string,
  spreadsheetId: string,
  sheetName: string,
  supabase: SupabaseClient,
  importId?: string
): Promise<ImportSummary> {
  const errors: string[] = []
  let rows_read = 0, rows_imported = 0, rows_skipped = 0, duplicates_removed = 0

  let allRows: string[][]
  try {
    allRows = await fetchSheetRows(spreadsheetId, sheetName)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch sheet'
    await writeImportLog(supabase, userId, 'google_sheets', 'error', 0, 0, 0, msg,
      { spreadsheetId, sheetName, dataType: 'health_metrics' }, importId)
    return { rows_read: 0, rows_imported: 0, rows_skipped: 0, duplicates_removed: 0, errors: [msg] }
  }

  if (allRows.length < 2) {
    const msg = 'Sheet has no data rows (only header or completely empty)'
    await writeImportLog(supabase, userId, 'google_sheets', 'error', 0, 0, 0, msg,
      { spreadsheetId, sheetName, dataType: 'health_metrics' }, importId)
    return { rows_read: 0, rows_imported: 0, rows_skipped: 0, duplicates_removed: 0, errors: [msg] }
  }

  const headers = allRows[0].map((h) => String(h).trim())
  const columnMap = resolveColumnMap(headers, HEALTH_METRICS_ALIASES)
  const missingRequired = getMissingRequired(columnMap, HEALTH_METRICS_REQUIRED)

  if (missingRequired.length > 0) {
    const msg = `Missing required columns: ${missingRequired.join(', ')}. Found: ${headers.join(', ')}`
    await writeImportLog(supabase, userId, 'google_sheets', 'error', allRows.length - 1, 0, allRows.length - 1, msg,
      { spreadsheetId, sheetName, dataType: 'health_metrics', detectedHeaders: headers, resolvedColumnMap: columnMap }, importId)
    return { rows_read: 0, rows_imported: 0, rows_skipped: 0, duplicates_removed: 0, errors: [msg] }
  }

  const { records, skipped, errors: parseErrors } = parseHealthMetricsRows(allRows, columnMap, 'google_sheets')
  rows_read = allRows.length - 1
  rows_skipped = skipped + parseErrors.length
  errors.push(...parseErrors)

  const sampleRows = allRows.slice(1).filter((r) => r.some((c) => c?.trim())).slice(0, 3)
  const metadata = { spreadsheetId, sheetName, dataType: 'health_metrics', detectedHeaders: headers, resolvedColumnMap: columnMap, sampleRows }

  // Deduplicate by (date, source)
  const deduped = (() => {
    const seen = new Map<string, typeof records[number]>()
    for (const r of records) seen.set(`${r.date}__${r.source ?? 'google_sheets'}`, r)
    return Array.from(seen.values())
  })()
  duplicates_removed = records.length - deduped.length
  if (duplicates_removed > 0) console.log(`[sync:health] Removed ${duplicates_removed} duplicates`)

  if (deduped.length > 0) {
    const toInsert = deduped.map((r) => ({ ...r, user_id: userId }))
    const BATCH_SIZE = 100
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('health_metrics').upsert(batch, { onConflict: 'user_id,date,source' })
      if (error) {
        errors.push(`Upsert batch failed: ${error.message}`)
      } else {
        rows_imported += batch.length
      }
    }
  }

  rows_skipped = rows_read - rows_imported - duplicates_removed

  const status = errors.length === 0 ? 'success' : rows_imported > 0 ? 'partial' : 'error'
  await writeImportLog(supabase, userId, 'google_sheets', status, rows_read, rows_imported, rows_skipped,
    errors.length > 0 ? errors.join('; ') : null, { ...metadata, duplicates_removed }, importId)

  return { rows_read, rows_imported, rows_skipped, duplicates_removed, errors }
}

// ============================================================
// WEIGHT LOGS
// ============================================================

export async function syncWeightLogs(
  userId: string,
  spreadsheetId: string,
  sheetName: string,
  supabase: SupabaseClient,
  importId?: string
): Promise<ImportSummary> {
  const errors: string[] = []
  let rows_read = 0, rows_imported = 0, rows_skipped = 0, duplicates_removed = 0

  let allRows: string[][]
  try {
    allRows = await fetchSheetRows(spreadsheetId, sheetName)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch sheet'
    await writeImportLog(supabase, userId, 'google_sheets_weight', 'error', 0, 0, 0, msg,
      { spreadsheetId, sheetName, dataType: 'weight_logs' }, importId)
    return { rows_read: 0, rows_imported: 0, rows_skipped: 0, duplicates_removed: 0, errors: [msg] }
  }

  if (allRows.length < 2) {
    const msg = 'Sheet has no data rows (only header or completely empty)'
    await writeImportLog(supabase, userId, 'google_sheets_weight', 'error', 0, 0, 0, msg,
      { spreadsheetId, sheetName, dataType: 'weight_logs' }, importId)
    return { rows_read: 0, rows_imported: 0, rows_skipped: 0, duplicates_removed: 0, errors: [msg] }
  }

  const headers = allRows[0].map((h) => String(h).trim())
  const columnMap = resolveColumnMap(headers, WEIGHT_LOGS_ALIASES)
  const missingRequired = getMissingRequired(columnMap, WEIGHT_LOGS_REQUIRED)

  if (missingRequired.length > 0) {
    const msg = `Missing required columns: ${missingRequired.join(', ')}. Found: ${headers.join(', ')}`
    await writeImportLog(supabase, userId, 'google_sheets_weight', 'error', allRows.length - 1, 0, allRows.length - 1, msg,
      { spreadsheetId, sheetName, dataType: 'weight_logs', detectedHeaders: headers, resolvedColumnMap: columnMap }, importId)
    return { rows_read: 0, rows_imported: 0, rows_skipped: 0, duplicates_removed: 0, errors: [msg] }
  }

  const { records, skipped, errors: parseErrors } = parseWeightLogsRows(allRows, columnMap)
  rows_read = allRows.length - 1
  errors.push(...parseErrors)

  const sampleRows = allRows.slice(1).filter((r) => r.some((c) => c?.trim())).slice(0, 3)
  const metadata = { spreadsheetId, sheetName, dataType: 'weight_logs', detectedHeaders: headers, resolvedColumnMap: columnMap, sampleRows }

  // Deduplicate by date
  const deduped = (() => {
    const seen = new Map<string, typeof records[number]>()
    for (const r of records) seen.set(r.date, r)
    return Array.from(seen.values())
  })()
  duplicates_removed = records.length - deduped.length
  if (duplicates_removed > 0) console.log(`[sync:weight] Removed ${duplicates_removed} duplicates`)

  if (deduped.length > 0) {
    const toInsert = deduped.map((r) => ({ ...r, user_id: userId }))
    const BATCH_SIZE = 100
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('weight_logs').upsert(batch, { onConflict: 'user_id,date' })
      if (error) {
        errors.push(`Upsert batch failed: ${error.message}`)
      } else {
        rows_imported += batch.length
      }
    }
  }

  rows_skipped = rows_read - rows_imported - duplicates_removed

  const status = errors.length === 0 ? 'success' : rows_imported > 0 ? 'partial' : 'error'
  await writeImportLog(supabase, userId, 'google_sheets_weight', status, rows_read, rows_imported, rows_skipped,
    errors.length > 0 ? errors.join('; ') : null, { ...metadata, duplicates_removed }, importId)

  return { rows_read, rows_imported, rows_skipped, duplicates_removed, errors }
}

// ============================================================
// STRAVA ACTIVITIES
// ============================================================

export async function syncStravaActivities(
  userId: string,
  spreadsheetId: string,
  sheetName: string,
  supabase: SupabaseClient,
  importId?: string
): Promise<ImportSummary> {
  const errors: string[] = []
  let rows_read = 0, rows_imported = 0, rows_skipped = 0, duplicates_removed = 0

  let allRows: string[][]
  try {
    allRows = await fetchSheetRows(spreadsheetId, sheetName)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch sheet'
    await writeImportLog(supabase, userId, 'strava_google_sheets', 'error', 0, 0, 0, msg,
      { spreadsheetId, sheetName, dataType: 'strava_activities' }, importId)
    return { rows_read: 0, rows_imported: 0, rows_skipped: 0, duplicates_removed: 0, errors: [msg] }
  }

  if (allRows.length < 2) {
    const msg = 'Sheet has no data rows (only header or completely empty)'
    await writeImportLog(supabase, userId, 'strava_google_sheets', 'error', 0, 0, 0, msg,
      { spreadsheetId, sheetName, dataType: 'strava_activities' }, importId)
    return { rows_read: 0, rows_imported: 0, rows_skipped: 0, duplicates_removed: 0, errors: [msg] }
  }

  const headers = allRows[0].map((h) => String(h).trim())
  const columnMap = resolveColumnMap(headers, STRAVA_ACTIVITIES_ALIASES)
  const missingRequired = getMissingRequired(columnMap, STRAVA_ACTIVITIES_REQUIRED)

  if (missingRequired.length > 0) {
    const msg = `Missing required columns: ${missingRequired.join(', ')}. Found: ${headers.join(', ')}`
    await writeImportLog(supabase, userId, 'strava_google_sheets', 'error', allRows.length - 1, 0, allRows.length - 1, msg,
      { spreadsheetId, sheetName, dataType: 'strava_activities', detectedHeaders: headers, resolvedColumnMap: columnMap }, importId)
    return { rows_read: 0, rows_imported: 0, rows_skipped: 0, duplicates_removed: 0, errors: [msg] }
  }

  const { records, skipped, errors: parseErrors } = parseStravaActivitiesRows(allRows, columnMap)
  rows_read = allRows.length - 1
  rows_skipped = skipped + parseErrors.length
  errors.push(...parseErrors)

  const sampleRows = allRows.slice(1).filter((r) => r.some((c) => c?.trim())).slice(0, 3)
  const metadata = { spreadsheetId, sheetName, dataType: 'strava_activities', detectedHeaders: headers, resolvedColumnMap: columnMap, sampleRows }

  // Deduplicate by (external_id, source)
  const deduped = (() => {
    const seen = new Map<string, typeof records[number]>()
    for (const r of records) {
      const key = `${r.external_id}__${r.source ?? 'strava_google_sheets'}`
      seen.set(key, r)
    }
    return Array.from(seen.values())
  })()
  duplicates_removed = records.length - deduped.length
  if (duplicates_removed > 0) console.log(`[sync:strava] Removed ${duplicates_removed} duplicates`)

  if (deduped.length > 0) {
    const toInsert = deduped.map((r) => ({ ...r, user_id: userId }))
    const BATCH_SIZE = 100
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('activities').upsert(batch, { onConflict: 'user_id,external_id,source' })
      if (error) {
        errors.push(`Upsert batch failed: ${error.message}`)
      } else {
        rows_imported += batch.length
      }
    }
  }

  rows_skipped = rows_read - rows_imported - duplicates_removed

  const status = errors.length === 0 ? 'success' : rows_imported > 0 ? 'partial' : 'error'
  await writeImportLog(supabase, userId, 'strava_google_sheets', status, rows_read, rows_imported, rows_skipped,
    errors.length > 0 ? errors.join('; ') : null, { ...metadata, duplicates_removed }, importId)

  return { rows_read, rows_imported, rows_skipped, duplicates_removed, errors }
}

// ============================================================
// APPLE HEALTH SLEEP SHEET
// ============================================================
// Reads the dedicated Sleep sheet (from Health Auto Export) and
// upserts sleep data into health_metrics using source='google_sheets_sleep'.
// The Recovery page merges this with daily metrics rows by date.

export async function syncSleepData(
  userId: string,
  spreadsheetId: string,
  sheetName: string,
  supabase: SupabaseClient,
  importId?: string
): Promise<ImportSummary> {
  const errors: string[] = []
  let rows_read = 0, rows_imported = 0, rows_skipped = 0, duplicates_removed = 0

  let allRows: string[][]
  try {
    allRows = await fetchSheetRows(spreadsheetId, sheetName)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch sleep sheet'
    await writeImportLog(supabase, userId, 'google_sheets_sleep', 'error', 0, 0, 0, msg,
      { spreadsheetId, sheetName, dataType: 'apple_sleep' }, importId)
    return { rows_read: 0, rows_imported: 0, rows_skipped: 0, duplicates_removed: 0, errors: [msg] }
  }

  if (allRows.length < 2) {
    const msg = 'Sleep sheet has no data rows'
    await writeImportLog(supabase, userId, 'google_sheets_sleep', 'error', 0, 0, 0, msg,
      { spreadsheetId, sheetName, dataType: 'apple_sleep' }, importId)
    return { rows_read: 0, rows_imported: 0, rows_skipped: 0, duplicates_removed: 0, errors: [msg] }
  }

  const headers = allRows[0].map((h) => String(h).trim())
  const columnMap = resolveColumnMap(headers, SLEEP_SHEET_ALIASES)
  const missingRequired = getMissingRequired(columnMap, SLEEP_SHEET_REQUIRED)

  if (missingRequired.length > 0) {
    const msg = `Missing required columns: ${missingRequired.join(', ')}. Found: ${headers.join(', ')}`
    await writeImportLog(supabase, userId, 'google_sheets_sleep', 'error', allRows.length - 1, 0, allRows.length - 1, msg,
      { spreadsheetId, sheetName, dataType: 'apple_sleep', detectedHeaders: headers, resolvedColumnMap: columnMap }, importId)
    return { rows_read: 0, rows_imported: 0, rows_skipped: 0, duplicates_removed: 0, errors: [msg] }
  }

  const { records, skipped, errors: parseErrors } = parseSleepSheetRows(allRows, columnMap, 'google_sheets_sleep')
  rows_read = allRows.length - 1
  rows_skipped = skipped + parseErrors.length
  errors.push(...parseErrors)

  const sampleRows = allRows.slice(1).filter((r) => r.some((c) => c?.trim())).slice(0, 3)
  const metadata = { spreadsheetId, sheetName, dataType: 'apple_sleep', detectedHeaders: headers, resolvedColumnMap: columnMap, sampleRows }

  // Deduplicate by date within this batch
  const deduped = (() => {
    const seen = new Map<string, typeof records[number]>()
    for (const r of records) seen.set(r.date, r)
    return Array.from(seen.values())
  })()
  duplicates_removed = records.length - deduped.length

  if (deduped.length > 0) {
    // 1. Upsert into sleep_records (full detail table)
    const sleepRecords = deduped.map((r) => ({
      user_id:              userId,
      date:                 r.date,
      source:               r.source,
      start_time:           r.start_time,
      end_time:             r.end_time,
      in_bed_minutes:       r.in_bed_minutes,
      asleep_minutes:       r.asleep_minutes,
      awake_minutes:        r.awake_minutes,
      rem_minutes:          r.rem_minutes,
      core_minutes:         r.core_minutes,
      deep_minutes:         r.deep_minutes,
      wake_count:           r.wake_count,
      efficiency_pct:       r.efficiency_pct,
      fall_asleep_minutes:  r.fall_asleep_minutes,
      avg_respiration_rate: r.avg_respiration_rate,
      wrist_temperature:    r.wrist_temperature,
      low_spo2:             r.low_spo2,
      high_spo2:            r.high_spo2,
      avg_spo2:             r.avg_spo2,
      low_hrv:              r.low_hrv,
      high_hrv:             r.high_hrv,
      avg_hrv:              r.avg_hrv,
      updated_at:           new Date().toISOString(),
    }))
    const BATCH_SIZE = 100
    for (let i = 0; i < sleepRecords.length; i += BATCH_SIZE) {
      const batch = sleepRecords.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('sleep_records').upsert(batch, { onConflict: 'user_id,date,source' })
      if (error) {
        errors.push(`sleep_records upsert failed: ${error.message}`)
      } else {
        rows_imported += batch.length
      }
    }

    // 2. Also upsert into health_metrics (backward compat — Recovery page reads sleep_minutes from here)
    const hmRecords = deduped.map((r) => ({
      user_id:             userId,
      date:                r.date,
      source:              r.source,
      sleep_minutes:       r.sleep_minutes,
      deep_sleep_minutes:  r.deep_sleep_minutes,
      rem_sleep_minutes:   r.rem_sleep_minutes,
      hrv_ms:              null,
      resting_hr:          null,
      vo2max:              null,
      steps:               null,
      active_energy_kcal:  null,
      resting_energy_kcal: null,
      respiratory_rate:    null,
      source_payload:      null,
    }))
    for (let i = 0; i < hmRecords.length; i += BATCH_SIZE) {
      const batch = hmRecords.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('health_metrics').upsert(batch, { onConflict: 'user_id,date,source' })
      if (error) {
        errors.push(`health_metrics upsert failed: ${error.message}`)
      }
    }
  }

  rows_skipped = rows_read - rows_imported - duplicates_removed

  const status = errors.length === 0 ? 'success' : rows_imported > 0 ? 'partial' : 'error'
  await writeImportLog(supabase, userId, 'google_sheets_sleep', status, rows_read, rows_imported, rows_skipped,
    errors.length > 0 ? errors.join('; ') : null, { ...metadata, duplicates_removed }, importId)

  return { rows_read, rows_imported, rows_skipped, duplicates_removed, errors }
}

// ============================================================
// GENERIC DISPATCHER — used by cron and multi-sync API
// ============================================================

/**
 * Runs the appropriate importer for a google_sheet_imports config row.
 * Also updates last_sync_at on the config row after sync.
 */
export async function runImport(
  config: GoogleSheetImport,
  supabase: SupabaseClient
): Promise<ImportSummary> {
  const { id, user_id, spreadsheet_id, sheet_name, data_type } = config

  let summary: ImportSummary

  if (data_type === 'health_metrics') {
    summary = await syncHealthMetrics(user_id, spreadsheet_id, sheet_name, supabase, id)
  } else if (data_type === 'weight_logs') {
    summary = await syncWeightLogs(user_id, spreadsheet_id, sheet_name, supabase, id)
  } else if (data_type === 'strava_activities') {
    summary = await syncStravaActivities(user_id, spreadsheet_id, sheet_name, supabase, id)
  } else if (data_type === 'apple_sleep') {
    summary = await syncSleepData(user_id, spreadsheet_id, sheet_name, supabase, id)
  } else {
    const msg = `Unsupported data_type: ${data_type}`
    return { rows_read: 0, rows_imported: 0, rows_skipped: 0, duplicates_removed: 0, errors: [msg] }
  }

  // Update last_sync_at on the import config
  await supabase
    .from('google_sheet_imports')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', id)

  return summary
}

// ============================================================
// IMPORT LOG WRITER
// ============================================================

async function writeImportLog(
  supabase: SupabaseClient,
  userId: string,
  source: string,
  status: string,
  rows_read: number,
  rows_imported: number,
  rows_skipped: number,
  error_message: string | null,
  metadata: Record<string, unknown>,
  importId?: string
) {
  await supabase.from('data_import_logs').insert({
    user_id:       userId,
    import_id:     importId ?? null,
    source,
    status,
    rows_read,
    rows_imported,
    rows_skipped,
    error_message,
    metadata,
  })
}
