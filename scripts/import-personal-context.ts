#!/usr/bin/env tsx
/**
 * CLI script: import personal context JSON files into KeepGoing.
 *
 * Usage:
 *   npm run import:personal-context -- \
 *     --health ./data/martin_health_profile_v2.json \
 *     --self   ./data/martin_self_reported.json \
 *     [--dry-run]
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (or NEXT_PUBLIC_SUPABASE_ANON_KEY if using user session)
 *
 * The script is idempotent — re-running updates existing facts, never duplicates.
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { transformHealthProfile } from '../lib/profile/transform-health-profile'
import { transformSelfReported } from '../lib/profile/transform-self-reported'
import type { PersonalContextFactInput, ContextCategory } from '../lib/profile/types'

// ── Arg parsing ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

function flag(name: string): string | null {
  const i = args.indexOf(name)
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null
}

const healthPath = flag('--health')
const selfPath   = flag('--self')
const dryRun     = args.includes('--dry-run')

if (!healthPath && !selfPath) {
  console.error('Error: Provide at least --health <path> or --self <path>.')
  process.exit(1)
}

// ── Supabase client (service role) ────────────────────────────────────────────

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const facts: PersonalContextFactInput[] = []

  if (healthPath) {
    console.log(`Reading health profile: ${healthPath}`)
    try {
      const raw  = JSON.parse(readFileSync(healthPath, 'utf-8'))
      const transformed = transformHealthProfile(raw)
      facts.push(...transformed)
      console.log(`  → ${transformed.length} facts extracted`)
    } catch (e) {
      console.error(`  Error: ${(e as Error).message}`)
      process.exit(1)
    }
  }

  if (selfPath) {
    console.log(`Reading self-reported: ${selfPath}`)
    try {
      const raw  = JSON.parse(readFileSync(selfPath, 'utf-8'))
      const transformed = transformSelfReported(raw)
      facts.push(...transformed)
      console.log(`  → ${transformed.length} facts extracted`)
    } catch (e) {
      console.error(`  Error: ${(e as Error).message}`)
      process.exit(1)
    }
  }

  // Summary before upsert
  const catCounts: Partial<Record<ContextCategory, number>> = {}
  for (const f of facts) {
    catCounts[f.category] = (catCounts[f.category] ?? 0) + 1
  }

  console.log('\nExtracted facts by category:')
  for (const [cat, count] of Object.entries(catCounts)) {
    console.log(`  ${cat.padEnd(20)} ${count}`)
  }
  console.log(`  ${'TOTAL'.padEnd(20)} ${facts.length}`)

  if (dryRun) {
    console.log('\nDry run — no data written.')
    return
  }

  // Resolve user — for service role we need a known user_id
  const { data: users, error: userErr } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .single()

  if (userErr || !users) {
    console.error('Could not resolve user. Ensure profiles table has at least one row,')
    console.error('or pass a specific user_id via --user-id flag (not yet implemented).')
    process.exit(1)
  }

  const userId = users.id as string
  console.log(`\nUpserting as user: ${userId}`)

  const now  = new Date().toISOString()
  const rows = facts.map(f => ({
    user_id:       userId,
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

  const { error, count } = await supabase
    .from('personal_context_facts')
    .upsert(rows, { onConflict: 'user_id,category,key,source', count: 'exact' })

  if (error) {
    console.error('\nUpsert failed:', error.message)
    process.exit(1)
  }

  console.log(`\nDone. ${count ?? facts.length} facts upserted (idempotent).`)
}

main().catch(e => { console.error(e); process.exit(1) })
