/**
 * One-time import of historical food logs from jedla_export.xlsx
 * Run dry-run first:  npx tsx scripts/import-historical-food.ts
 * Run real import:    npx tsx scripts/import-historical-food.ts --import
 */

import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'
import * as dotenv from 'dotenv'

// ── Load env ────────────────────────────────────────────────────────────────

const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) dotenv.config({ path: envPath })

const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// ── Types ────────────────────────────────────────────────────────────────────

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other'

interface ParsedRow {
  date: string        // YYYY-MM-DD
  eaten_at: string    // ISO timestamptz
  meal_type: MealType
  description: string
  source: 'historical_import'
}

// ── Parsing logic ────────────────────────────────────────────────────────────

const MEAL_TYPE_KEYWORDS: Array<{ pattern: RegExp; meal: MealType }> = [
  { pattern: /raňajky|prvé jedlo/i,   meal: 'breakfast' },
  { pattern: /obed/i,                  meal: 'lunch'     },
  { pattern: /večera/i,                meal: 'dinner'    },
  { pattern: /snack|olovrant|na bike|po bike/i, meal: 'snack' },
  { pattern: /nápoje/i,                meal: 'other'     },
]

const DEFAULT_TIMES: Record<MealType, string> = {
  breakfast: '08:00',
  lunch:     '13:00',
  dinner:    '19:00',
  snack:     '16:00',
  other:     '12:00',
}

const SPECIAL_TIMES: Record<string, string> = {
  'na bike': '15:00',
  'po bike': '18:00',
}

function inferMealType(typeTime: string): MealType {
  const t = typeTime.trim().toLowerCase()
  for (const { pattern, meal } of MEAL_TYPE_KEYWORDS) {
    if (pattern.test(t)) return meal
  }
  return 'other'
}

function extractTime(typeTime: string, mealType: MealType): string {
  // Try extracting HH:MM or H:MM possibly preceded by ~
  const match = typeTime.match(/~?(\d{1,2}:\d{2})/)
  if (match) return match[1].padStart(5, '0')

  // Special label-based times
  const t = typeTime.trim().toLowerCase()
  for (const [key, time] of Object.entries(SPECIAL_TIMES)) {
    if (t.includes(key)) return time
  }

  return DEFAULT_TIMES[mealType]
}

function parseDate(rawDate: string): string | null {
  // Format: "18.3." or "18.3" → 2026-03-18
  const match = rawDate.toString().trim().match(/^(\d{1,2})\.(\d{1,2})\.?$/)
  if (!match) return null

  const day   = parseInt(match[1])
  const month = parseInt(match[2])

  // Infer year: use current year if date is in the past, else previous year
  const now = new Date()
  let year  = now.getFullYear()
  const candidate = new Date(year, month - 1, day)
  if (candidate > now) year-- // if future, use previous year

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseRow(row: Record<string, unknown>): ParsedRow | null {
  const rawDate     = String(row['date']      ?? '').trim()
  const rawTypeTime = String(row['type_time'] ?? '').trim()
  const rawDesc     = String(row['description'] ?? '').trim()

  if (!rawDate || !rawTypeTime || !rawDesc || rawDesc === 'undefined') return null

  const date = parseDate(rawDate)
  if (!date) return null

  const mealType  = inferMealType(rawTypeTime)
  const timeStr   = extractTime(rawTypeTime, mealType)
  const eaten_at  = new Date(`${date}T${timeStr}:00`).toISOString()

  return {
    date,
    eaten_at,
    meal_type: mealType,
    description: rawDesc,
    source: 'historical_import',
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = !process.argv.includes('--import')

  console.log(`\n🥗 KeepGoing — Historical Food Import`)
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (pass --import to write)' : '✍️  REAL IMPORT'}\n`)

  // ── Read Excel ──────────────────────────────────────────────────────────────
  const xlsxPath = path.join(process.cwd(), 'scripts', 'jedla_export.xlsx')
  const fallback = '/Users/martinkukol/Downloads/jedla_export.xlsx'
  const filePath = fs.existsSync(xlsxPath) ? xlsxPath : fallback

  if (!fs.existsSync(filePath)) {
    console.error(`Excel file not found at ${filePath}`)
    process.exit(1)
  }

  const wb     = XLSX.readFile(filePath)
  const sheet  = wb.Sheets[wb.SheetNames[0]]
  // Read with header:1 so XLSX gives us arrays (no header name guessing issues)
  const allRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' }) as string[][]
  // allRows[0] = original header, allRows[1..] = data
  const rows = allRows.slice(1).map(r => ({
    date:        String(r[0] ?? '').trim(),
    type_time:   String(r[1] ?? '').trim(),
    description: String(r[2] ?? '').trim(),
  }))

  // ── Parse ───────────────────────────────────────────────────────────────────
  let skipped = 0
  const parsed: ParsedRow[] = []

  for (const row of rows) {
    const p = parseRow(row)
    if (!p) { skipped++; continue }
    parsed.push(p)
  }

  console.log(`📊 Excel rows:   ${rows.length}`)
  console.log(`✅ Parsed:       ${parsed.length}`)
  console.log(`⏭️  Skipped:      ${skipped}\n`)

  console.log('📋 Sample records:')
  parsed.slice(0, 6).forEach(r => {
    console.log(`  ${r.date} ${r.meal_type.padEnd(9)} ${r.eaten_at.slice(11,16)}  ${r.description.slice(0,60)}`)
  })
  console.log()

  if (isDryRun) {
    console.log('✨ Dry-run complete. Pass --import to write to Supabase.\n')
    return
  }

  // ── Real import ─────────────────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Get user ID
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers()
  if (userErr || !users.users.length) {
    console.error('Could not list users:', userErr?.message)
    process.exit(1)
  }
  const userId = users.users[0].id
  console.log(`👤 Importing for user: ${users.users[0].email} (${userId})\n`)

  // Duplicate check: fetch existing eaten_at+description for this user
  const { data: existing } = await supabase
    .from('food_logs')
    .select('eaten_at, description')
    .eq('user_id', userId)

  const existingSet = new Set(
    (existing ?? []).map(r => `${r.eaten_at}|${r.description}`)
  )

  let inserted = 0
  let duplicates = 0
  const errors: string[] = []

  for (const row of parsed) {
    const key = `${row.eaten_at}|${row.description}`
    if (existingSet.has(key)) {
      duplicates++
      continue
    }

    const { error } = await supabase.from('food_logs').insert({
      user_id:     userId,
      date:        row.date,
      eaten_at:    row.eaten_at,
      meal_type:   row.meal_type,
      description: row.description,
      source:      row.source,
    })

    if (error) {
      errors.push(`${row.date} ${row.description.slice(0, 40)}: ${error.message}`)
    } else {
      inserted++
    }
  }

  console.log(`\n🎉 Import complete:`)
  console.log(`  ✅ Inserted:    ${inserted}`)
  console.log(`  ⏭️  Duplicates:  ${duplicates}`)
  console.log(`  ❌ Errors:      ${errors.length}`)
  if (errors.length) errors.forEach(e => console.log(`     ${e}`))
}

main().catch(err => { console.error(err); process.exit(1) })
