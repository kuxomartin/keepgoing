import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  syncHealthMetrics,
  syncWeightLogs,
  syncStravaActivities,
  syncSleepData,
  runImport,
} from '@/lib/integrations/google-sheets/sync'
import type { ImportSummary, GoogleSheetImport, SupportedDataType } from '@/types/database'

type SyncBody = {
  importId?: string
  syncAll?: boolean
  // backward-compat inline config
  spreadsheetId?: string
  sheetName?: string
  dataType?: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: SyncBody = {}
  try {
    const text = await request.text()
    if (text) body = JSON.parse(text)
  } catch { /* empty body — treat as syncAll */ }

  // ── Mode 1: sync all enabled imports for the user ────────────────────────
  if (body.syncAll) {
    const { data: imports } = await supabase
      .from('google_sheet_imports')
      .select('*')
      .eq('user_id', user.id)
      .eq('enabled', true)
      .order('import_priority', { ascending: true })

    if (!imports || imports.length === 0) {
      return NextResponse.json({ message: 'No enabled imports found', results: [] })
    }

    const results: Array<{ id: string; name: string; summary: ImportSummary; error?: string }> = []

    for (const imp of imports as GoogleSheetImport[]) {
      try {
        const summary = await runImport(imp, supabase)
        results.push({ id: imp.id, name: imp.name, summary })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        results.push({ id: imp.id, name: imp.name, summary: { rows_read: 0, rows_imported: 0, rows_skipped: 0, duplicates_removed: 0, errors: [msg] }, error: msg })
      }
    }

    return NextResponse.json({ results })
  }

  // ── Mode 2: sync one import by id ────────────────────────────────────────
  if (body.importId) {
    const { data: imp } = await supabase
      .from('google_sheet_imports')
      .select('*')
      .eq('id', body.importId)
      .eq('user_id', user.id)
      .single()

    if (!imp) {
      return NextResponse.json({ error: 'Import config not found' }, { status: 404 })
    }

    const summary = await runImport(imp as GoogleSheetImport, supabase)
    return NextResponse.json(summary)
  }

  // ── Mode 3: inline config (backward compat) ───────────────────────────────
  let { spreadsheetId, sheetName } = body
  const dataType = (body.dataType ?? 'health_metrics') as SupportedDataType

  if (!['health_metrics', 'weight_logs', 'strava_activities', 'apple_sleep'].includes(dataType)) {
    return NextResponse.json({ error: `Unsupported dataType: "${dataType}"` }, { status: 400 })
  }

  // Fall back to saved data_sources config for backward compat
  const SOURCE_KEY: Record<SupportedDataType, string> = {
    health_metrics:    'google_sheets',
    weight_logs:       'google_sheets_weight',
    strava_activities: 'strava_google_sheets',
    apple_sleep:       'google_sheets_sleep',
  }

  if (!spreadsheetId || !sheetName) {
    const { data: saved } = await supabase
      .from('data_sources')
      .select('config')
      .eq('user_id', user.id)
      .eq('source', SOURCE_KEY[dataType])
      .single()

    const config = saved?.config as { spreadsheetId?: string; sheetName?: string } | null
    spreadsheetId = spreadsheetId ?? config?.spreadsheetId
    sheetName     = sheetName     ?? config?.sheetName
  }

  if (!spreadsheetId || !sheetName) {
    return NextResponse.json(
      { error: 'Missing spreadsheetId and sheetName (body or saved config)' },
      { status: 400 }
    )
  }

  // Save/update inline config for future convenience
  const sourceKey = SOURCE_KEY[dataType]
  await supabase.from('data_sources').upsert(
    { user_id: user.id, source: sourceKey, status: 'active', config: { spreadsheetId, sheetName, dataType } },
    { onConflict: 'user_id,source' }
  )

  let summary: ImportSummary
  if (dataType === 'health_metrics') {
    summary = await syncHealthMetrics(user.id, spreadsheetId, sheetName, supabase)
  } else if (dataType === 'weight_logs') {
    summary = await syncWeightLogs(user.id, spreadsheetId, sheetName, supabase)
  } else if (dataType === 'apple_sleep') {
    summary = await syncSleepData(user.id, spreadsheetId, sheetName, supabase)
  } else {
    summary = await syncStravaActivities(user.id, spreadsheetId, sheetName, supabase)
  }

  // Update last_sync_at on data_sources
  await supabase
    .from('data_sources')
    .update({ last_sync_at: new Date().toISOString(), status: summary.errors.length === 0 ? 'active' : 'error' })
    .eq('user_id', user.id)
    .eq('source', sourceKey)

  return NextResponse.json(summary)
}
