/**
 * Rule-based nutrition status for today.
 * Zero AI tokens — pure deterministic logic.
 */

export type StatusLevel = 'ok' | 'warning' | 'info'

export interface NutritionStatusItem {
  key:     string
  status:  StatusLevel
  label:   string
  detail?: string   // compact sub-line, e.g. "61g / 138g"
}

export interface NutritionStatusInput {
  calories:         number | null
  calorieTarget?:   number        // default 2000
  protein:          number | null
  proteinTargetG:   number        // required — use weight × 1.6 or fallback 130
  coffeeMg:         number | null
  lastCoffeeHour:   number | null
  foodDescriptions: string[]      // all food descriptions logged today
  waterMl?:         number | null
  waterTargetMl?:   number        // default 2500
}

// ── Keyword lists ──────────────────────────────────────────────────────────────

const VEG_KEYS = [
  'salad', 'spinach', 'broccoli', 'kale', 'lettuce', 'tomato', 'pepper', 'capsicum',
  'carrot', 'courgette', 'zucchini', 'cucumber', 'onion', 'celery', 'asparagus',
  'cabbage', 'cauliflower', 'pea', 'green bean', 'sweet potato', 'beet', 'beetroot',
  'radish', 'leek', 'artichoke', 'aubergine', 'eggplant', 'bok choy', 'pak choi',
  'edamame', 'fennel', 'parsnip', 'turnip', 'watercress', 'rocket', 'arugula',
  'zelenina', 'brokolica', 'šalát', 'paprika', 'rajčina', 'mrkva',
]

const FIBRE_KEYS = [
  ...VEG_KEYS,
  'fruit', 'apple', 'banana', 'pear', 'berry', 'berries', 'mango', 'orange',
  'kiwi', 'grape', 'plum', 'peach', 'apricot', 'melon', 'watermelon',
  'bean', 'lentil', 'chickpea', 'hummus', 'lentils', 'oat', 'oats', 'oatmeal',
  'whole grain', 'wholegrain', 'whole wheat', 'brown rice', 'quinoa',
  'chia', 'flaxseed', 'psyllium',
]

const FISH_KEYS = [
  'fish', 'salmon', 'tuna', 'sardine', 'mackerel', 'cod', 'haddock', 'sea bass',
  'trout', 'herring', 'anchovy', 'shrimp', 'prawn', 'seafood', 'sushi', 'sashimi',
  'tilapia', 'halibut', 'mahi', 'snapper', 'crab', 'lobster', 'clam', 'mussel',
  'oyster', 'scallop', 'squid', 'calamari', 'octopus',
  // Slovak / Czech
  'losos', 'tuniak', 'ryba', 'treska', 'makrela', 'krevety',
]

function anyMatch(descriptions: string[], keys: string[]): boolean {
  const combined = descriptions.join(' ').toLowerCase()
  return keys.some(k => combined.includes(k))
}

function countFibreRich(descriptions: string[]): number {
  return descriptions.filter(d => {
    const lower = d.toLowerCase()
    return FIBRE_KEYS.some(k => lower.includes(k))
  }).length
}

// ── Main function ─────────────────────────────────────────────────────────────

export function computeTodayNutritionStatus({
  calories,
  calorieTarget = 2000,
  protein,
  proteinTargetG,
  coffeeMg,
  lastCoffeeHour,
  foodDescriptions,
  waterMl,
  waterTargetMl = 2500,
}: NutritionStatusInput): NutritionStatusItem[] {
  const items: NutritionStatusItem[] = []
  const hasFood = foodDescriptions.length > 0

  // ── Calories ───────────────────────────────────────────────────────────────
  if (calories == null || calories === 0) {
    items.push({ key: 'calories', status: 'info', label: 'No food logged yet' })
  } else if (calories < 700) {
    items.push({ key: 'calories', status: 'warning', label: 'Low intake today', detail: `${Math.round(calories)} kcal logged` })
  } else if (calories > calorieTarget + 600) {
    items.push({ key: 'calories', status: 'warning', label: 'Intake above target', detail: `${Math.round(calories).toLocaleString()} kcal` })
  } else {
    items.push({ key: 'calories', status: 'ok', label: 'Calories on track', detail: `${Math.round(calories).toLocaleString()} kcal` })
  }

  // ── Protein ────────────────────────────────────────────────────────────────
  const prot = protein ?? 0
  if (!hasFood) {
    items.push({ key: 'protein', status: 'info', label: 'Protein not yet logged' })
  } else if (prot < proteinTargetG * 0.5) {
    items.push({
      key: 'protein', status: 'warning', label: 'Protein below target',
      detail: `${Math.round(prot)}g / ${Math.round(proteinTargetG)}g target`,
    })
  } else if (prot < proteinTargetG * 0.85) {
    items.push({
      key: 'protein', status: 'warning', label: 'Protein slightly below target',
      detail: `${Math.round(prot)}g / ${Math.round(proteinTargetG)}g target`,
    })
  } else {
    items.push({
      key: 'protein', status: 'ok', label: 'Protein on track',
      detail: `${Math.round(prot)}g / ${Math.round(proteinTargetG)}g target`,
    })
  }

  // ── Fibre ──────────────────────────────────────────────────────────────────
  if (!hasFood) {
    items.push({ key: 'fibre', status: 'info', label: 'Fibre not yet assessed' })
  } else {
    const fibreCount = countFibreRich(foodDescriptions)
    if (fibreCount === 0) {
      items.push({ key: 'fibre', status: 'warning', label: 'Fibre likely low' })
    } else {
      items.push({ key: 'fibre', status: 'ok', label: 'Fibre looks adequate' })
    }
  }

  // ── Vegetables ────────────────────────────────────────────────────────────
  if (!hasFood) {
    items.push({ key: 'vegetables', status: 'info', label: 'Vegetables not yet logged' })
  } else if (!anyMatch(foodDescriptions, VEG_KEYS)) {
    items.push({ key: 'vegetables', status: 'warning', label: 'Vegetables missing today' })
  } else {
    items.push({ key: 'vegetables', status: 'ok', label: 'Vegetables included' })
  }

  // ── Fish ──────────────────────────────────────────────────────────────────
  if (anyMatch(foodDescriptions, FISH_KEYS)) {
    items.push({ key: 'fish', status: 'ok', label: 'Fish included today' })
  } else {
    items.push({ key: 'fish', status: 'info', label: 'No fish today' })
  }

  // ── Caffeine ──────────────────────────────────────────────────────────────
  const mg = coffeeMg ?? 0
  if (mg === 0) {
    items.push({ key: 'caffeine', status: 'info', label: 'No caffeine logged' })
  } else if (lastCoffeeHour != null && lastCoffeeHour >= 14 && mg > 0) {
    items.push({
      key: 'caffeine', status: 'warning', label: 'Late caffeine',
      detail: `${mg}mg · last after 14:00`,
    })
  } else if (mg > 400) {
    items.push({ key: 'caffeine', status: 'warning', label: 'Caffeine already high', detail: `${mg}mg consumed` })
  } else if (mg > 200) {
    items.push({ key: 'caffeine', status: 'warning', label: 'Caffeine moderate-high', detail: `${mg}mg consumed` })
  } else {
    items.push({ key: 'caffeine', status: 'ok', label: 'Caffeine in safe range', detail: `${mg}mg` })
  }

  // ── Hydration (optional) ──────────────────────────────────────────────────
  if (waterMl != null) {
    if (waterMl < 1000) {
      items.push({ key: 'hydration', status: 'warning', label: 'Hydration low', detail: `${waterMl}ml of ${waterTargetMl}ml target` })
    } else if (waterMl < waterTargetMl * 0.7) {
      items.push({ key: 'hydration', status: 'warning', label: 'Hydration needs attention', detail: `${waterMl}ml logged` })
    } else {
      items.push({ key: 'hydration', status: 'ok', label: 'Hydration adequate', detail: `${waterMl}ml` })
    }
  }

  return items
}
