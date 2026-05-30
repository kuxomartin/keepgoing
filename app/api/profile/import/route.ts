import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { transformHealthProfile } from '@/lib/profile/transform-health-profile'
import { transformSelfReported } from '@/lib/profile/transform-self-reported'
import type { PersonalContextFactInput, ContextCategory } from '@/lib/profile/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const facts: PersonalContextFactInput[] = []
  const parseErrors: string[] = []

  // ── health_profile file ─────────────────────────────────────────────────────
  const healthFile = formData.get('health_profile') as File | null
  if (healthFile) {
    try {
      const text = await healthFile.text()
      const data = JSON.parse(text)
      facts.push(...transformHealthProfile(data))
    } catch (e) {
      parseErrors.push(`health_profile: ${(e as Error).message}`)
    }
  }

  // ── self_reported file ──────────────────────────────────────────────────────
  const selfFile = formData.get('self_reported') as File | null
  if (selfFile) {
    try {
      const text = await selfFile.text()
      const data = JSON.parse(text)
      facts.push(...transformSelfReported(data))
    } catch (e) {
      parseErrors.push(`self_reported: ${(e as Error).message}`)
    }
  }

  if (parseErrors.length) {
    return NextResponse.json({ error: 'Parse errors', details: parseErrors }, { status: 400 })
  }

  if (!facts.length) {
    return NextResponse.json({ error: 'No files uploaded or no facts extracted' }, { status: 400 })
  }

  // ── Upsert ──────────────────────────────────────────────────────────────────
  const now = new Date().toISOString()
  const rows = facts.map(f => ({
    user_id:       user.id,
    category:      f.category,
    key:           f.key,
    value:         f.value,
    source:        f.source,
    source_detail: f.source_detail ?? null,
    confidence:    f.confidence ?? null,
    notes:         f.notes ?? null,
    is_active:     true,
    updated_at:    now,
  }))

  const { error: upsertError, count } = await supabase
    .from('personal_context_facts')
    .upsert(rows, { onConflict: 'user_id,category,key,source', count: 'exact' })

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  // Build per-category counts
  const categories: Partial<Record<ContextCategory, number>> = {}
  for (const f of facts) {
    categories[f.category] = (categories[f.category] ?? 0) + 1
  }

  return NextResponse.json({
    success: true,
    facts_imported: count ?? facts.length,
    facts_skipped:  Math.max(0, facts.length - (count ?? facts.length)),
    categories,
  })
}
