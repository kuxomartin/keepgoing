/**
 * Food Diversity Report — monthly analysis.
 * Categorises 30 days of food descriptions into protein sources, plant diversity,
 * and meal composition. Returns data for display (no charts).
 * Zero AI.
 */

export interface ProteinSource {
  name: string
  count: number   // number of food log entries matching this category
  percent: number // rounded
}

export interface FoodDiversityReport {
  proteinSources: ProteinSource[]
  distinctVegetables: number
  distinctFruits: number
  animalBasedPercent: number    // % of entries containing any animal protein
  plantBasedPercent: number
  strengths: string[]           // up to 3
  opportunities: string[]       // up to 3 gaps
  totalEntries: number
}

// ── Keyword maps ──────────────────────────────────────────────────────────────

const PROTEIN_CATS: { name: string; keys: string[] }[] = [
  { name: 'Chicken', keys: ['chicken', 'poulet', 'kura', 'kurace', 'poultry', 'turkey', 'morka'] },
  { name: 'Beef', keys: ['beef', 'steak', 'burger', 'mince', 'ground beef', 'hovadzie', 'grill', 'meatball', 'bolognese'] },
  { name: 'Pork', keys: ['pork', 'ham', 'bacon', 'sausage', 'bravčové', 'salami', 'prosciutto', 'pancetta', 'chorizo'] },
  { name: 'Fish & Seafood', keys: ['fish', 'salmon', 'tuna', 'sardine', 'mackerel', 'cod', 'sea bass', 'trout', 'herring',
      'shrimp', 'prawn', 'seafood', 'sushi', 'sashimi', 'crab', 'losos', 'tuniak', 'ryba', 'treska'] },
  { name: 'Eggs', keys: ['egg', 'eggs', 'omelette', 'scrambled', 'poached', 'fried egg', 'vajce', 'vajcia', 'frittata'] },
  { name: 'Dairy', keys: ['yogurt', 'yoghurt', 'cheese', 'cottage', 'ricotta', 'milk', 'kefir', 'mozzarella',
      'parmesan', 'feta', 'quark', 'tvaroh', 'jogurt', 'syr'] },
  { name: 'Legumes & Tofu', keys: ['bean', 'lentil', 'chickpea', 'hummus', 'tofu', 'tempeh', 'edamame',
      'soy', 'miso', 'fazuľa', 'šošovica', 'cícer'] },
  { name: 'Protein shake', keys: ['protein shake', 'whey', 'protein powder', 'casein', 'mass gainer'] },
]

const ANIMAL_KEYS = [
  'chicken', 'beef', 'pork', 'ham', 'bacon', 'steak', 'fish', 'salmon', 'tuna', 'sardine',
  'mackerel', 'cod', 'shrimp', 'prawn', 'seafood', 'egg', 'omelette', 'scrambled', 'yogurt',
  'yoghurt', 'cheese', 'milk', 'kefir', 'cottage', 'meat', 'sausage', 'meatball',
  'kura', 'hovadzie', 'bravčové', 'ryba', 'losos', 'vajce', 'tvaroh', 'jogurt',
  'whey', 'casein', 'turkey', 'lamb', 'veal',
]

const PLANT_ONLY_KEYS = [
  'salad', 'spinach', 'broccoli', 'kale', 'tomato', 'avocado', 'nut', 'almond',
  'oat', 'oatmeal', 'fruit', 'apple', 'banana', 'mango', 'berry', 'orange', 'lentil',
  'chickpea', 'hummus', 'tofu', 'tempeh', 'quinoa', 'rice', 'pasta', 'bread', 'granola',
]

const VEGETABLE_KEYS: { name: string; keys: string[] }[] = [
  { name: 'Spinach', keys: ['spinach', 'špenát'] },
  { name: 'Broccoli', keys: ['broccoli', 'brokolica'] },
  { name: 'Kale', keys: ['kale'] },
  { name: 'Tomato', keys: ['tomato', 'rajčina', 'rajčiny'] },
  { name: 'Pepper', keys: ['bell pepper', 'capsicum', 'paprika'] },
  { name: 'Carrot', keys: ['carrot', 'mrkva'] },
  { name: 'Cucumber', keys: ['cucumber'] },
  { name: 'Courgette', keys: ['courgette', 'zucchini'] },
  { name: 'Onion', keys: ['onion', 'cibuľa'] },
  { name: 'Lettuce/Salad', keys: ['salad', 'lettuce', 'šalát', 'arugula', 'rocket'] },
  { name: 'Sweet Potato', keys: ['sweet potato'] },
  { name: 'Beetroot', keys: ['beet', 'beetroot'] },
  { name: 'Cauliflower', keys: ['cauliflower'] },
  { name: 'Celery', keys: ['celery'] },
  { name: 'Asparagus', keys: ['asparagus'] },
  { name: 'Leek', keys: ['leek'] },
  { name: 'Mushroom', keys: ['mushroom', 'hríb', 'šampión'] },
  { name: 'Peas', keys: [' pea ', 'peas', 'garden pea'] },
  { name: 'Cabbage', keys: ['cabbage', 'kapusta'] },
  { name: 'Eggplant', keys: ['aubergine', 'eggplant'] },
  { name: 'Edamame', keys: ['edamame'] },
]

const FRUIT_KEYS: { name: string; keys: string[] }[] = [
  { name: 'Apple', keys: ['apple', 'jablko'] },
  { name: 'Banana', keys: ['banana', 'banan'] },
  { name: 'Berries', keys: ['berry', 'berries', 'blueberry', 'strawberry', 'raspberry'] },
  { name: 'Orange', keys: ['orange', 'pomaranč'] },
  { name: 'Mango', keys: ['mango'] },
  { name: 'Grape', keys: ['grape'] },
  { name: 'Kiwi', keys: ['kiwi'] },
  { name: 'Pear', keys: ['pear', 'hruška'] },
  { name: 'Peach', keys: ['peach', 'plum'] },
  { name: 'Watermelon', keys: ['watermelon', 'melon'] },
  { name: 'Pineapple', keys: ['pineapple', 'ananás'] },
  { name: 'Cherry', keys: ['cherry'] },
  { name: 'Pomegranate', keys: ['pomegranate'] },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function containsAny(text: string, keys: string[]): boolean {
  return keys.some(k => text.includes(k))
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function computeFoodDiversityReport(descriptions: string[]): FoodDiversityReport {
  const total = descriptions.length
  if (total === 0) {
    return {
      proteinSources: [],
      distinctVegetables: 0,
      distinctFruits: 0,
      animalBasedPercent: 0,
      plantBasedPercent: 0,
      strengths: [],
      opportunities: [],
      totalEntries: 0,
    }
  }

  const lower = descriptions.map(d => d.toLowerCase())

  // ── Protein sources ────────────────────────────────────────────────────────
  const rawProteins = PROTEIN_CATS.map(cat => {
    const count = lower.filter(d => containsAny(d, cat.keys)).length
    return { name: cat.name, count, percent: 0 }
  }).filter(p => p.count > 0)

  const proteinTotal = rawProteins.reduce((s, p) => s + p.count, 0) || 1
  const proteinSources = rawProteins
    .map(p => ({ ...p, percent: Math.round((p.count / proteinTotal) * 100) }))
    .sort((a, b) => b.count - a.count)

  // ── Distinct vegetables ────────────────────────────────────────────────────
  const combined = lower.join(' ')
  const distinctVegetables = VEGETABLE_KEYS.filter(v => containsAny(combined, v.keys)).length
  const distinctFruits     = FRUIT_KEYS.filter(f => containsAny(combined, f.keys)).length

  // ── Animal vs plant composition ────────────────────────────────────────────
  const animalEntries = lower.filter(d => containsAny(d, ANIMAL_KEYS)).length
  const animalBasedPercent = Math.round((animalEntries / total) * 100)
  const plantBasedPercent  = 100 - animalBasedPercent

  // ── Strengths ──────────────────────────────────────────────────────────────
  const strengths: string[] = []

  const proteinVariety = proteinSources.length
  if (proteinVariety >= 5) strengths.push('Good protein source variety')
  else if (proteinVariety >= 3) strengths.push('Moderate protein variety')

  if (distinctVegetables >= 8) strengths.push(`High vegetable diversity — ${distinctVegetables} types`)
  else if (distinctVegetables >= 5) strengths.push(`${distinctVegetables} different vegetable types`)

  const fishEntry = proteinSources.find(p => p.name === 'Fish & Seafood')
  if (fishEntry && fishEntry.percent >= 10) strengths.push('Regular fish and seafood intake')

  if (plantBasedPercent >= 40) strengths.push(`${plantBasedPercent}% plant-based meals`)

  const eggEntry = proteinSources.find(p => p.name === 'Eggs')
  if (eggEntry && eggEntry.percent >= 10 && !strengths.some(s => s.includes('protein'))) {
    strengths.push('Regular egg consumption')
  }

  // ── Opportunities ──────────────────────────────────────────────────────────
  const opportunities: string[] = []

  if (!fishEntry || fishEntry.percent < 5) {
    opportunities.push('Fish & seafood intake is low')
  }
  if (distinctVegetables < 5) {
    opportunities.push(`Only ${distinctVegetables} vegetable types — aim for more variety`)
  }
  if (distinctFruits < 3) {
    opportunities.push('Low fruit diversity this period')
  }
  const legEntry = proteinSources.find(p => p.name === 'Legumes & Tofu')
  if (!legEntry || legEntry.percent < 5) {
    opportunities.push('Low legume intake — add beans, lentils, or chickpeas')
  }

  return {
    proteinSources: proteinSources.slice(0, 7), // top 7
    distinctVegetables,
    distinctFruits,
    animalBasedPercent,
    plantBasedPercent,
    strengths: strengths.slice(0, 3),
    opportunities: opportunities.slice(0, 3),
    totalEntries: total,
  }
}
