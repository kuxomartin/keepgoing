// POST /api/food/plan
// Generates a meal plan for the rest of today using OpenAI.
// Server-side only — OPENAI_API_KEY is never exposed to the client.

import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PlanMeal {
  name:               string
  description:        string
  estimatedCalories:  number
  estimatedProtein:   number
}

export interface PlanResponse {
  objective:    string
  dinner:       PlanMeal
  snack:        PlanMeal | null
  reasoning:    string
  totalCalories: number
  totalProtein:  number
}

interface PlanRequestBody {
  foodDescriptions:  string[]
  caloriesConsumed:  number
  proteinConsumed:   number
  calorieTarget:     number
  proteinTarget:     number
  coffeeMg:          number
  recoveryScore:     number | null
  sleepH:            number | null
  todayTraining:     string | null
  mode:              'lean' | 'balanced' | 'performance'
}

const MODE_GUIDANCE: Record<string, string> = {
  lean:        'Prioritise protein and volume. Keep calories 200-400 below the remaining budget. Focus on lean proteins and vegetables. Avoid dense calorie sources.',
  balanced:    'Hit remaining calorie and protein targets as precisely as possible. Include a balance of protein, carbs, and healthy fats.',
  performance: 'Maximise recovery and muscle protein synthesis. Hit or slightly exceed remaining protein. Include carbohydrates for glycogen restoration. Prioritise nutrient density.',
}

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: PlanRequestBody
  try {
    body = await request.json() as PlanRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    foodDescriptions = [],
    caloriesConsumed = 0,
    proteinConsumed = 0,
    calorieTarget = 2000,
    proteinTarget = 130,
    coffeeMg = 0,
    recoveryScore = null,
    sleepH = null,
    todayTraining = null,
    mode = 'balanced',
  } = body

  const remainingCalories = Math.max(0, calorieTarget - caloriesConsumed)
  const remainingProtein  = Math.max(0, proteinTarget  - proteinConsumed)

  // ── OpenAI ────────────────────────────────────────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI planning is not configured on this server.' }, { status: 503 })
  }

  const foodSummary = foodDescriptions.length > 0
    ? foodDescriptions.slice(0, 10).join('; ')
    : 'Nothing logged yet'

  const contextLines = [
    `Already eaten: ${foodSummary}`,
    `Consumed: ${caloriesConsumed} kcal, ${Math.round(proteinConsumed)}g protein`,
    `Daily targets: ${calorieTarget} kcal, ${Math.round(proteinTarget)}g protein`,
    `Remaining: ${remainingCalories} kcal, ${Math.round(remainingProtein)}g protein`,
    `Caffeine today: ${coffeeMg}mg`,
    recoveryScore != null ? `Recovery score: ${recoveryScore}/100` : null,
    sleepH != null ? `Last sleep: ${sleepH.toFixed(1)}h` : null,
    todayTraining ? `Training today: ${todayTraining}` : `Training today: none`,
    `Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
  ].filter(Boolean).join('\n')

  const systemPrompt = `You are a personal nutrition coach. Plan the remaining meals for today based on the user's data.

Mode guidance (${mode}): ${MODE_GUIDANCE[mode]}

Return ONLY valid JSON matching this exact schema — no markdown, no extra text:
{
  "objective": "<1-sentence main goal for the rest of today>",
  "dinner": {
    "name": "<meal name>",
    "description": "<2-3 sentence description with specific foods>",
    "estimatedCalories": <integer>,
    "estimatedProtein": <number with 1 decimal>
  },
  "snack": <null if no snack needed, or: {
    "name": "<snack name>",
    "description": "<1-2 sentence description>",
    "estimatedCalories": <integer>,
    "estimatedProtein": <number with 1 decimal>
  }>,
  "reasoning": "<2-3 sentences explaining why these choices suit today's context>",
  "totalCalories": <dinner + snack calories combined>,
  "totalProtein": <dinner + snack protein combined>
}

Rules:
- Be specific with foods and quantities (e.g. "150g salmon fillet" not "protein source")
- Respect the mode guidance strictly
- If remaining calories is very low (<300 kcal), skip the snack
- Focus on practical, accessible meals
- Consider recovery score and training when choosing carb/protein balance`

  try {
    const openai = new OpenAI({ apiKey })

    const completion = await openai.chat.completions.create({
      model:           'gpt-4o-mini',
      response_format: { type: 'json_object' },
      max_tokens:      512,
      temperature:     0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: contextLines },
      ],
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 })
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'AI returned invalid data' }, { status: 502 })
    }

    // Validate and shape
    const dinner = parsed.dinner as Record<string, unknown> | undefined
    if (!dinner || typeof dinner.name !== 'string') {
      return NextResponse.json({ error: 'AI returned unexpected structure' }, { status: 502 })
    }

    const snackRaw = parsed.snack as Record<string, unknown> | null | undefined
    const snack: PlanMeal | null = snackRaw && typeof snackRaw.name === 'string'
      ? {
          name:               String(snackRaw.name),
          description:        String(snackRaw.description ?? ''),
          estimatedCalories:  Math.round(Number(snackRaw.estimatedCalories) || 0),
          estimatedProtein:   Math.round(Number(snackRaw.estimatedProtein) * 10) / 10 || 0,
        }
      : null

    const result: PlanResponse = {
      objective:    String(parsed.objective ?? ''),
      dinner: {
        name:               String(dinner.name),
        description:        String(dinner.description ?? ''),
        estimatedCalories:  Math.round(Number(dinner.estimatedCalories) || 0),
        estimatedProtein:   Math.round(Number(dinner.estimatedProtein) * 10) / 10 || 0,
      },
      snack,
      reasoning:    String(parsed.reasoning ?? ''),
      totalCalories: Math.round(Number(parsed.totalCalories) || 0),
      totalProtein:  Math.round(Number(parsed.totalProtein) * 10) / 10 || 0,
    }

    return NextResponse.json(result)

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[plan] OpenAI error:', msg)
    return NextResponse.json({ error: `AI planning failed: ${msg}` }, { status: 502 })
  }
}
