import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupportedDataType } from '@/types/database'

const SUPPORTED_DATA_TYPES: SupportedDataType[] = ['health_metrics', 'weight_logs', 'strava_activities']

// ── GET — list all imports for the authenticated user ─────────────────────────
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('google_sheet_imports')
    .select('*')
    .eq('user_id', user.id)
    .order('import_priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// ── POST — create or update an import config ──────────────────────────────────
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id, name, spreadsheet_id, sheet_name, data_type, enabled, import_priority } = body as {
    id?: string
    name?: string
    spreadsheet_id?: string
    sheet_name?: string
    data_type?: string
    enabled?: boolean
    import_priority?: number
  }

  // Validate required fields
  if (!name || !spreadsheet_id || !sheet_name || !data_type) {
    return NextResponse.json(
      { error: 'Required fields: name, spreadsheet_id, sheet_name, data_type' },
      { status: 400 }
    )
  }

  if (!SUPPORTED_DATA_TYPES.includes(data_type as SupportedDataType)) {
    return NextResponse.json(
      { error: `Unsupported data_type. Must be one of: ${SUPPORTED_DATA_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  const payload = {
    user_id:          user.id,
    name:             String(name).trim(),
    spreadsheet_id:   String(spreadsheet_id).trim(),
    sheet_name:       String(sheet_name).trim(),
    data_type:        data_type as SupportedDataType,
    enabled:          enabled !== undefined ? Boolean(enabled) : true,
    import_priority:  import_priority !== undefined ? Number(import_priority) : 100,
  }

  if (id) {
    // Update existing row — must belong to this user
    const { data, error } = await supabase
      .from('google_sheet_imports')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Create new row (upsert on unique constraint: user_id+spreadsheet_id+sheet_name+data_type)
  const { data, error } = await supabase
    .from('google_sheet_imports')
    .upsert(payload, { onConflict: 'user_id,spreadsheet_id,sheet_name,data_type' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// ── DELETE — remove an import config ─────────────────────────────────────────
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id query parameter' }, { status: 400 })
  }

  const { error } = await supabase
    .from('google_sheet_imports')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
