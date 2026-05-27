import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchSheetRows } from '@/lib/integrations/google-sheets/client'
import {
  HEALTH_METRICS_ALIASES, HEALTH_METRICS_REQUIRED,
  WEIGHT_LOGS_ALIASES,    WEIGHT_LOGS_REQUIRED,
  STRAVA_ACTIVITIES_ALIASES, STRAVA_ACTIVITIES_REQUIRED,
  resolveColumnMap, getMissingRequired, getUnrecognizedHeaders,
} from '@/lib/integrations/google-sheets/mapper'
import type { SheetPreview, SupportedDataType } from '@/types/database'

const ALIASES: Record<SupportedDataType, Record<string, string[]>> = {
  health_metrics:    HEALTH_METRICS_ALIASES,
  weight_logs:       WEIGHT_LOGS_ALIASES,
  strava_activities: STRAVA_ACTIVITIES_ALIASES,
}
const REQUIRED: Record<SupportedDataType, string[]> = {
  health_metrics:    HEALTH_METRICS_REQUIRED,
  weight_logs:       WEIGHT_LOGS_REQUIRED,
  strava_activities: STRAVA_ACTIVITIES_REQUIRED,
}

async function runPreview(
  supabase: ReturnType<Awaited<ReturnType<typeof createClient>>['from']> extends never ? never : Awaited<ReturnType<typeof createClient>>,
  spreadsheetId: string,
  sheetName: string,
  dataType: SupportedDataType
): Promise<Response> {
  let allRows: string[][]
  try {
    allRows = await fetchSheetRows(spreadsheetId, sheetName)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch sheet'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  if (allRows.length === 0) {
    return NextResponse.json({ error: 'Sheet is empty' }, { status: 422 })
  }

  const headers   = allRows[0].map((h) => String(h).trim())
  const columnMap = resolveColumnMap(headers, ALIASES[dataType])
  const missing   = getMissingRequired(columnMap, REQUIRED[dataType])
  const unrecognized = getUnrecognizedHeaders(headers, columnMap)

  const sampleRows = allRows
    .slice(1)
    .filter((r) => r.some((c) => c?.trim()))
    .slice(0, 3)
    .map((r) => r.map((c) => String(c ?? '').trim()))

  const preview: SheetPreview & { unrecognizedHeaders: string[] } = {
    detectedHeaders:   headers,
    resolvedMap:       columnMap,
    missingRequired:   missing,
    sampleRows,
    unrecognizedHeaders: unrecognized,
  }

  return NextResponse.json(preview)
}

// ── GET — query-param form (backward compat) ───────────────────────────────────
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const spreadsheetId = searchParams.get('spreadsheetId') ?? ''
  const sheetName     = searchParams.get('sheetName') ?? ''
  const dataTypeRaw   = searchParams.get('dataType') ?? 'health_metrics'

  if (!['health_metrics', 'weight_logs', 'strava_activities'].includes(dataTypeRaw)) {
    return NextResponse.json({ error: `Unsupported dataType: ${dataTypeRaw}` }, { status: 400 })
  }

  if (!spreadsheetId || !sheetName) {
    return NextResponse.json({ error: 'Missing spreadsheetId and sheetName' }, { status: 400 })
  }

  return runPreview(supabase, spreadsheetId, sheetName, dataTypeRaw as SupportedDataType)
}

// ── POST — body: { importId } | { spreadsheetId, sheetName, dataType } ────────
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* empty body */ }

  let spreadsheetId: string | undefined
  let sheetName: string | undefined
  let dataType: SupportedDataType = 'health_metrics'

  if (body.importId) {
    // Resolve from google_sheet_imports
    const { data: imp } = await supabase
      .from('google_sheet_imports')
      .select('*')
      .eq('id', body.importId)
      .eq('user_id', user.id)
      .single()

    if (!imp) return NextResponse.json({ error: 'Import config not found' }, { status: 404 })

    spreadsheetId = imp.spreadsheet_id
    sheetName     = imp.sheet_name
    dataType      = imp.data_type as SupportedDataType
  } else {
    spreadsheetId = String(body.spreadsheetId ?? '').trim()
    sheetName     = String(body.sheetName ?? '').trim()
    const dt = String(body.dataType ?? 'health_metrics')
    if (!['health_metrics', 'weight_logs', 'strava_activities'].includes(dt)) {
      return NextResponse.json({ error: `Unsupported dataType: ${dt}` }, { status: 400 })
    }
    dataType = dt as SupportedDataType
  }

  if (!spreadsheetId || !sheetName) {
    return NextResponse.json({ error: 'Missing spreadsheetId and sheetName' }, { status: 400 })
  }

  return runPreview(supabase, spreadsheetId, sheetName, dataType)
}
