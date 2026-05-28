// POST /api/food/estimate
// Estimates calories and macros for a meal description using OpenAI.
// Server-side only — OPENAI_API_KEY is never exposed to the client.

import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import type { ConfidenceLevel } from '@/types/database'

export const dynamic = 'force-dynamic'

export interface EstimateResponse {
  estimated_calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  confidence: ConfidenceLevel
  explanation: string
}

const SYSTEM_PROMPT = `You are a nutrition expert. Given a meal description, estimate its nutritional content.

Return ONLY valid JSON matching this exact schema — no markdown, no extra text:
{
  "estimated_calories": <integer, total kcal rounded to nearest 5>,
  "protein_g": <number, grams with at most 1 decimal>,
  "carbs_g":   <number, grams with at most 1 decimal>,
  "fat_g":     <number, grams with at most 1 decimal>,
  "confidence": <"high" | "medium" | "low">,
  "explanation": <string, 1-2 sentences explaining the estimate>
}

Guidelines:
- Use realistic, conservative estimates for home-cooked meals.
- "high" confidence: common foods with well-known nutrition (eggs, bread, banana).
- "medium" confidence: mixed dishes where portions are unclear.
- "low" confidence: vague descriptions, restaurant meals, or unusual foods.
- If you can't estimate meaningfully, still return your best guess with "low" confidence.`

export async function POST(request: Request) {
  // ── Auth: must be signed in ───────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let description: string
  try {
    const body = await request.json() as { description?: unknown }
    if (typeof body.description !== 'string' || !body.description.trim()) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }
    description = body.description.trim()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── OpenAI key check ──────────────────────────────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI estimation is not configured on this server.' },
      { status: 503 }
    )
  }

  // ── Call OpenAI ───────────────────────────────────────────────────────────
  try {
    const openai = new OpenAI({ apiKey })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      max_tokens: 256,
      temperature: 0.2,  // low temp for consistent estimates
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: `Meal: "${description}"` },
      ],
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 })
    }

    // ── Parse and validate the JSON ─────────────────────────────────────────
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      console.error('[estimate] Failed to parse OpenAI JSON:', raw)
      return NextResponse.json({ error: 'AI returned invalid data' }, { status: 502 })
    }

    const cals    = Number(parsed.estimated_calories)
    const protein = Number(parsed.protein_g)
    const carbs   = Number(parsed.carbs_g)
    const fat     = Number(parsed.fat_g)
    const conf    = parsed.confidence as string
    const expl    = typeof parsed.explanation === 'string' ? parsed.explanation : ''

    if (isNaN(cals) || isNaN(protein) || isNaN(carbs) || isNaN(fat)) {
      console.error('[estimate] Unexpected shape from OpenAI:', parsed)
      return NextResponse.json({ error: 'AI returned unexpected data shape' }, { status: 502 })
    }

    const confidence: ConfidenceLevel =
      conf === 'high' || conf === 'medium' || conf === 'low' ? conf : 'low'

    const result: EstimateResponse = {
      estimated_calories: Math.max(0, Math.round(cals)),
      protein_g: Math.max(0, Math.round(protein * 10) / 10),
      carbs_g:   Math.max(0, Math.round(carbs   * 10) / 10),
      fat_g:     Math.max(0, Math.round(fat     * 10) / 10),
      confidence,
      explanation: expl,
    }

    return NextResponse.json(result)

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[estimate] OpenAI error:', msg)
    return NextResponse.json(
      { error: `AI estimation failed: ${msg}` },
      { status: 502 }
    )
  }
}
