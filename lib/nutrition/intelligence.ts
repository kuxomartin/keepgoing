import type { FoodLog, CoffeeLog } from '@/types/database'

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW'

export interface NutritionInsight {
  id: string
  headline: string
  evidence: string
  impact: string
  action: string
  confidence: Confidence
}

export interface SupplementSuggestion {
  id: string
  name: string
  reason: string
  confidence: Confidence
}

// ── Keyword lists ──────────────────────────────────────────────────────────────

const PROTEIN_CATEGORIES: Record<string, string[]> = {
  chicken: ['chicken', 'poulet', 'kura', 'kurča'],
  beef:    ['beef', 'steak', 'burger', 'mince', 'brisket', 'hovädzí'],
  pork:    ['pork', 'bacon', 'ham', 'sausage', 'bravčové'],
  fish:    ['fish', 'salmon', 'tuna', 'sardine', 'mackerel', 'trout', 'seafood', 'cod', 'herring', 'sea bass', 'halibut', 'losos', 'ryba', 'tuniak'],
  eggs:    ['egg', 'omelette', 'scrambled', 'frittata', 'vajce', 'vajíčk'],
  legumes: ['lentil', 'bean', 'chickpea', 'tofu', 'tempeh', 'šošovica', 'fazuľa', 'edamame'],
  dairy:   ['yogurt', 'cottage', 'quark', 'tvaroh', 'jogurt'],
}

const FISH_KEYWORDS = [
  'fish', 'salmon', 'tuna', 'sardine', 'sardines', 'mackerel',
  'trout', 'seafood', 'cod', 'herring', 'halibut', 'sea bass',
  'losos', 'ryba', 'tuniak', 'pstruh',
]

const VEGGIE_KEYWORDS = [
  'broccoli', 'salad', 'spinach', 'vegetable', 'pepper', 'tomato',
  'cucumber', 'carrot', 'lettuce', 'onion', 'kale', 'pea', 'bean',
  'lentil', 'courgette', 'zucchini', 'asparagus', 'cauliflower',
  'celery', 'leek', 'radish', 'cabbage', 'artichoke', 'avocado',
  'beetroot', 'chard', 'pak choi', 'bok choy', 'fennel',
]

function contains(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase()
  return keywords.some(k => lower.includes(k))
}

// ── Module 1: Food Variety ─────────────────────────────────────────────────────

export function analyzeFoodVariety(meals: FoodLog[]): NutritionInsight | null {
  if (meals.length < 10) return null

  const counts: Record<string, number> = {}
  let categorized = 0

  for (const meal of meals) {
    for (const [cat, kws] of Object.entries(PROTEIN_CATEGORIES)) {
      if (contains(meal.description, kws)) {
        counts[cat] = (counts[cat] ?? 0) + 1
        categorized++
        break
      }
    }
  }

  if (categorized < 6) return null

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const [topCat, topCount] = sorted[0]
  const ratio = topCount / categorized
  const hasFish = (counts.fish ?? 0) > 0
  const diverseCategories = sorted.filter(([, c]) => c >= 2).length

  if (ratio >= 0.5 && topCat !== 'fish') {
    const label = topCat.charAt(0).toUpperCase() + topCat.slice(1)
    return {
      id: 'food-variety',
      headline: 'LOW FOOD VARIETY',
      evidence: `${label} detected in ${topCount} of the last ${categorized} protein meals.${!hasFish ? ' No fish detected.' : ''}`,
      impact: 'Limited dietary variety reduces micronutrient intake.',
      action: 'Replace 2–3 meals next week with fish, beef, or legumes.',
      confidence: ratio >= 0.65 ? 'HIGH' : 'MEDIUM',
    }
  }

  if (diverseCategories <= 2 && categorized >= 8) {
    return {
      id: 'food-variety',
      headline: 'LOW FOOD VARIETY',
      evidence: `Only ${diverseCategories} protein categories across ${categorized} categorised meals.`,
      impact: 'Limited dietary variety reduces micronutrient intake.',
      action: 'Introduce a different protein source this week.',
      confidence: 'MEDIUM',
    }
  }

  return null
}

// ── Module 2: Fish / Omega-3 ───────────────────────────────────────────────────

export function analyzeFishIntake(meals: FoodLog[], today: string): NutritionInsight | null {
  if (meals.length < 5) return null

  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - 21)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const recent = meals.filter(m => m.date >= cutoffStr)
  if (recent.length < 5) return null

  const hasFish = recent.some(m => contains(m.description, FISH_KEYWORDS))
  if (!hasFish) {
    return {
      id: 'fish-intake',
      headline: 'FISH INTAKE LOW',
      evidence: 'No fish meals detected in the last 21 days.',
      impact: 'Lower omega-3 intake.',
      action: 'Include 2 fish meals this week.',
      confidence: 'HIGH',
    }
  }
  return null
}

// ── Module 3: Protein Quality ──────────────────────────────────────────────────

export function analyzeProteinQuality(
  meals: FoodLog[],
  today: string,
  weightKg: number,
): NutritionInsight | null {
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - 7)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const byDate: Record<string, number> = {}
  for (const m of meals) {
    if (m.date >= cutoffStr && m.protein_g != null) {
      byDate[m.date] = (byDate[m.date] ?? 0) + m.protein_g
    }
  }
  const values = Object.values(byDate)
  if (values.length < 3) return null

  const avg = values.reduce((s, v) => s + v, 0) / values.length
  const target = Math.round(weightKg * 1.6)
  const gap = target - Math.round(avg)

  if (avg < target * 0.85) {
    return {
      id: 'protein-quality',
      headline: 'PROTEIN BELOW TARGET',
      evidence: `Average: ${Math.round(avg)}g/day · Target: ${target}g/day · Gap: ${gap}g/day`,
      impact: 'Recovery and muscle retention may be limited.',
      action: 'Add one protein-rich meal or snack daily.',
      confidence: gap > 30 ? 'HIGH' : 'MEDIUM',
    }
  }
  return null
}

// ── Module 4: Caffeine Timing ──────────────────────────────────────────────────

export function analyzeCaffeineTiming(
  coffeeLogs: CoffeeLog[],
  today: string,
): NutritionInsight | null {
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - 7)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const recent = coffeeLogs.filter(c => c.date >= cutoffStr)
  if (recent.length < 3) return null

  const lateDays = new Set<string>()
  for (const c of recent) {
    if (new Date(c.consumed_at).getHours() >= 14) lateDays.add(c.date)
  }

  if (lateDays.size >= 3) {
    return {
      id: 'caffeine-timing',
      headline: 'LATE CAFFEINE PATTERN',
      evidence: `Caffeine after 14:00 on ${lateDays.size} of the last 7 days.`,
      impact: 'Sleep disruption — caffeine has a 5–6 hour half-life.',
      action: 'No caffeine after 14:00 for 7 days.',
      confidence: lateDays.size >= 5 ? 'HIGH' : 'MEDIUM',
    }
  }
  return null
}

// ── Module 5: Energy Balance Patterns ─────────────────────────────────────────

export interface DayBalance {
  date: string
  intake: number | null
  burn: number | null
}

export function analyzeEnergyPatterns(
  days: DayBalance[],
  today: string,
): NutritionInsight | null {
  const past = days
    .filter(d => d.date < today && d.intake != null && d.burn != null)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (past.length < 5) return null

  // Consecutive deficit streak (most-recent first)
  let deficit = 0
  for (const d of [...past].reverse()) {
    if (d.intake! < d.burn!) deficit++
    else break
  }
  if (deficit >= 4) {
    return {
      id: 'energy-patterns',
      headline: 'CONSECUTIVE DEFICIT',
      evidence: `${deficit} deficit days in a row.`,
      impact: 'Recovery and training adaptation may suffer.',
      action: 'Increase intake on training days.',
      confidence: deficit >= 6 ? 'HIGH' : 'MEDIUM',
    }
  }

  // Consecutive surplus streak
  let surplus = 0
  for (const d of [...past].reverse()) {
    if (d.intake! > d.burn! + 200) surplus++
    else break
  }
  if (surplus >= 5) {
    return {
      id: 'energy-patterns',
      headline: 'CONSECUTIVE SURPLUS',
      evidence: `${surplus} surplus days in a row.`,
      impact: 'Gradual weight gain is likely if this continues.',
      action: 'Review portions, especially on rest days.',
      confidence: 'MEDIUM',
    }
  }

  return null
}

// ── Module 6: Vegetables / Fiber ──────────────────────────────────────────────

export function analyzeVegetables(meals: FoodLog[]): NutritionInsight | null {
  if (meals.length < 10) return null

  const withVeggies = meals.filter(m => contains(m.description, VEGGIE_KEYWORDS)).length
  const ratio = withVeggies / meals.length

  if (ratio < 0.25) {
    return {
      id: 'vegetables',
      headline: 'LOW VEGETABLE FREQUENCY',
      evidence: `Vegetables appear in ${Math.round(ratio * 100)}% of recent meals (${withVeggies} of ${meals.length}).`,
      impact: 'Fiber intake may be lower than recommended.',
      action: 'Add vegetables to one additional meal each day.',
      confidence: ratio < 0.15 ? 'HIGH' : 'MEDIUM',
    }
  }
  return null
}

// ── Supplement Advisor ─────────────────────────────────────────────────────────

export function analyzeSupplements({
  hasFishRecent,
  weeklyActivityCount,
  avgDailyCaffeineMg,
  month,
}: {
  hasFishRecent: boolean
  weeklyActivityCount: number
  avgDailyCaffeineMg: number
  month: number // 1–12
}): SupplementSuggestion[] {
  const out: SupplementSuggestion[] = []

  // Vitamin D3: Oct–Mar, Europe latitude
  if (month >= 10 || month <= 3) {
    out.push({
      id: 'vitamin-d3',
      name: 'VITAMIN D3',
      reason: 'Limited sunlight exposure during winter months (October–March).',
      confidence: 'HIGH',
    })
  }

  // Omega-3: no fish in 21 days
  if (!hasFishRecent) {
    out.push({
      id: 'omega-3',
      name: 'OMEGA-3',
      reason: 'No fish meals detected recently.',
      confidence: 'MEDIUM',
    })
  }

  // Magnesium Glycinate: frequent training + caffeine
  if (weeklyActivityCount >= 4 && avgDailyCaffeineMg >= 200) {
    out.push({
      id: 'magnesium',
      name: 'MAGNESIUM GLYCINATE',
      reason: 'Training load and caffeine intake may increase magnesium requirements.',
      confidence: 'MEDIUM',
    })
  }

  return out
}

// ── Runner — combines all modules ──────────────────────────────────────────────

export function runNutritionIntelligence({
  meals30d,
  coffeeLogs14d,
  balanceDays,
  weightKg,
  today,
}: {
  meals30d: FoodLog[]
  coffeeLogs14d: CoffeeLog[]
  balanceDays: DayBalance[]
  weightKg: number
  today: string
}): NutritionInsight[] {
  const results: NutritionInsight[] = []

  const m1 = analyzeFoodVariety(meals30d)
  if (m1) results.push(m1)

  const m2 = analyzeFishIntake(meals30d, today)
  if (m2) results.push(m2)

  const m3 = analyzeProteinQuality(meals30d, today, weightKg)
  if (m3) results.push(m3)

  const m4 = analyzeCaffeineTiming(coffeeLogs14d, today)
  if (m4) results.push(m4)

  const m5 = analyzeEnergyPatterns(balanceDays, today)
  if (m5) results.push(m5)

  const m6 = analyzeVegetables(meals30d)
  if (m6) results.push(m6)

  return results
}
