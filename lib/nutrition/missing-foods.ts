/**
 * Missing Foods — gap detector.
 * Scans last 30 days of food descriptions and identifies meaningful dietary gaps.
 * Zero AI. Rule-based keyword matching only.
 */

export interface MissingFoodItem {
  key: string
  label: string
  detail?: string   // e.g. "Last logged 9 days ago"
}

export interface FoodLogEntry {
  date: string        // YYYY-MM-DD
  description: string
}

// ── Category keyword lists ────────────────────────────────────────────────────

const FISH_KEYS = [
  'fish', 'salmon', 'tuna', 'sardine', 'mackerel', 'cod', 'haddock', 'sea bass',
  'trout', 'herring', 'anchovy', 'shrimp', 'prawn', 'seafood', 'sushi', 'sashimi',
  'tilapia', 'halibut', 'mahi', 'snapper', 'crab', 'lobster', 'clam', 'mussel',
  'oyster', 'scallop', 'squid', 'calamari', 'octopus',
  'losos', 'tuniak', 'ryba', 'treska', 'makrela', 'krevety',
]

const LEGUME_KEYS = [
  'bean', 'beans', 'lentil', 'lentils', 'chickpea', 'chickpeas', 'hummus',
  'edamame', 'tofu', 'tempeh', 'black bean', 'kidney bean', 'pinto bean',
  'white bean', 'cannellini', 'navy bean', 'soy', 'miso', 'natto',
  'fazuľa', 'šošovica', 'cícer',
]

const FRUIT_KEYS = [
  'apple', 'banana', 'orange', 'mango', 'berry', 'berries', 'blueberry',
  'strawberry', 'raspberry', 'grape', 'kiwi', 'pear', 'peach', 'plum',
  'apricot', 'cherry', 'melon', 'watermelon', 'pineapple', 'pomegranate',
  'fig', 'date', 'papaya', 'passion fruit',
  'jablko', 'hruška', 'banan', 'pomaranč',
]

const VEG_KEYS = [
  'salad', 'spinach', 'broccoli', 'kale', 'lettuce', 'tomato', 'pepper', 'capsicum',
  'carrot', 'courgette', 'zucchini', 'cucumber', 'onion', 'celery', 'asparagus',
  'cabbage', 'cauliflower', 'pea', 'green bean', 'sweet potato', 'beet', 'beetroot',
  'radish', 'leek', 'artichoke', 'aubergine', 'eggplant', 'bok choy', 'pak choi',
  'edamame', 'fennel', 'parsnip', 'turnip', 'watercress', 'rocket', 'arugula',
  'zelenina', 'brokolica', 'šalát', 'paprika', 'rajčina', 'mrkva',
]

const FERMENTED_KEYS = [
  'yogurt', 'yoghurt', 'kefir', 'sauerkraut', 'kimchi', 'kombucha',
  'miso', 'tempeh', 'natto', 'pickled', 'fermented',
  'jogurt', 'kefír',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function lastOccurrence(entries: FoodLogEntry[], keys: string[]): string | null {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))
  for (const entry of sorted) {
    const lower = entry.description.toLowerCase()
    if (keys.some(k => lower.includes(k))) return entry.date
  }
  return null
}

function countDays(entries: FoodLogEntry[], keys: string[], sinceDate: string): number {
  const relevant = entries.filter(e => e.date >= sinceDate)
  const days = new Set<string>()
  for (const entry of relevant) {
    const lower = entry.description.toLowerCase()
    if (keys.some(k => lower.includes(k))) days.add(entry.date)
  }
  return days.size
}

function daysBetween(dateStr: string, today: string): number {
  const a = new Date(today + 'T12:00:00')
  const b = new Date(dateStr + 'T12:00:00')
  return Math.round((a.getTime() - b.getTime()) / 86400000)
}

function subDateStr(today: string, days: number): string {
  const d = new Date(today + 'T12:00:00')
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

// ── Main function ─────────────────────────────────────────────────────────────

export function computeMissingFoods(
  entries: FoodLogEntry[],
  today: string,
): MissingFoodItem[] {
  const items: MissingFoodItem[] = []
  const last7  = subDateStr(today, 6)
  const last14 = subDateStr(today, 13)

  // ── Fish ──────────────────────────────────────────────────────────────────
  const lastFish = lastOccurrence(entries, FISH_KEYS)
  if (lastFish == null) {
    items.push({ key: 'fish', label: 'No fish or seafood recently', detail: 'Not logged in this window' })
  } else {
    const daysAgo = daysBetween(lastFish, today)
    if (daysAgo >= 8) {
      items.push({ key: 'fish', label: `No fish in ${daysAgo} days`, detail: `Last: ${daysAgo} days ago` })
    }
  }

  // ── Legumes ───────────────────────────────────────────────────────────────
  const lastLegume = lastOccurrence(entries, LEGUME_KEYS)
  if (lastLegume == null) {
    items.push({ key: 'legumes', label: 'No legumes recently' })
  } else {
    const daysAgo = daysBetween(lastLegume, today)
    if (daysAgo >= 10) {
      items.push({ key: 'legumes', label: `No legumes in ${daysAgo} days` })
    }
  }

  // ── Fruit ─────────────────────────────────────────────────────────────────
  const fruitDays7 = countDays(entries, FRUIT_KEYS, last7)
  if (fruitDays7 < 3) {
    const lastFruit = lastOccurrence(entries, FRUIT_KEYS)
    const detail = lastFruit ? `${fruitDays7} day${fruitDays7 === 1 ? '' : 's'} this week` : undefined
    items.push({ key: 'fruit', label: 'Low fruit intake this week', detail })
  }

  // ── Vegetables ───────────────────────────────────────────────────────────
  const vegDays7 = countDays(entries, VEG_KEYS, last7)
  if (vegDays7 < 4) {
    items.push({
      key: 'vegetables',
      label: 'Low vegetable variety this week',
      detail: `${vegDays7} day${vegDays7 === 1 ? '' : 's'} with vegetables logged`,
    })
  }

  // ── Fermented foods ───────────────────────────────────────────────────────
  const lastFermented = lastOccurrence(entries, FERMENTED_KEYS)
  if (lastFermented == null) {
    items.push({ key: 'fermented', label: 'No fermented foods recently' })
  } else {
    const daysAgo = daysBetween(lastFermented, today)
    if (daysAgo >= 12) {
      items.push({ key: 'fermented', label: `No fermented foods in ${daysAgo} days` })
    }
  }

  return items
}
