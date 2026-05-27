// Vercel cron-compatible route — runs at 03:00 UTC daily (see vercel.json).
// Syncs all enabled google_sheet_imports for every user.
// Protected by CRON_SECRET env var (Vercel sets Authorization header automatically).

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { runImport } from '@/lib/integrations/google-sheets/sync'
import { requireEnv } from '@/lib/env'
import type { GoogleSheetImport, ImportSummary } from '@/types/database'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — Vercel Pro supports up to 300s

export async function GET(request: Request) {
  // ── Validate required env vars before doing anything ─────────────────────
  try {
    requireEnv('cron', 'google')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Server misconfiguration'
    console.error('[cron]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // ── Authenticate the cron caller ─────────────────────────────────────────
  const secret = process.env.CRON_SECRET!
  const authHeader = request.headers.get('authorization') ?? ''
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Fetch all enabled imports for all users ───────────────────────────────
  const supabase = createAdminClient()

  const { data: imports, error } = await supabase
    .from('google_sheet_imports')
    .select('*')
    .eq('enabled', true)
    .order('user_id')
    .order('import_priority', { ascending: true })

  if (error) {
    console.error('[cron] Failed to fetch imports:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!imports || imports.length === 0) {
    console.log('[cron] No enabled imports found.')
    return NextResponse.json({ configs_processed: 0, successful: 0, failed: 0, rows_imported_total: 0, results: [] })
  }

  console.log(`[cron] Processing ${imports.length} import config(s)…`)

  const results: Array<{
    id: string
    user_id: string
    name: string
    data_type: string
    summary: ImportSummary
    error?: string
  }> = []

  let successful = 0
  let failed = 0
  let rows_imported_total = 0

  for (const imp of imports as GoogleSheetImport[]) {
    try {
      const summary = await runImport(imp, supabase)
      results.push({ id: imp.id, user_id: imp.user_id, name: imp.name, data_type: imp.data_type, summary })

      if (summary.errors.length === 0 || summary.rows_imported > 0) {
        successful++
      } else {
        failed++
      }
      rows_imported_total += summary.rows_imported

      console.log(
        `[cron] ✓ ${imp.name} (${imp.data_type}): ` +
        `${summary.rows_imported} imported, ${summary.rows_skipped} skipped, ` +
        `${summary.errors.length} errors`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[cron] ✗ ${imp.name} (${imp.data_type}): ${msg}`)
      results.push({
        id: imp.id, user_id: imp.user_id, name: imp.name, data_type: imp.data_type,
        summary: { rows_read: 0, rows_imported: 0, rows_skipped: 0, duplicates_removed: 0, errors: [msg] },
        error: msg,
      })
      failed++
    }
  }

  const response = {
    configs_processed: imports.length,
    successful,
    failed,
    rows_imported_total,
    results,
  }

  console.log(`[cron] Done: ${successful} succeeded, ${failed} failed, ${rows_imported_total} rows total`)
  return NextResponse.json(response)
}
