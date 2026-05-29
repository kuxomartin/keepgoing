/** Coffee types and default caffeine estimates (mg per cup). */

export const COFFEE_TYPES = [
  'espresso',
  'double espresso',
  'lungo',
  'americano',
  'cappuccino',
  'latte',
  'flat white',
  'filter coffee',
  'instant coffee',
  'decaf',
  'other',
] as const

export type CoffeeType = (typeof COFFEE_TYPES)[number]

/** Default caffeine mg per single cup of each type. null = unknown. */
export const CAFFEINE_PER_CUP: Record<CoffeeType, number | null> = {
  'espresso':        75,
  'double espresso': 150,
  'lungo':           90,
  'americano':       100,
  'cappuccino':      75,
  'latte':           75,
  'flat white':      120,
  'filter coffee':   140,
  'instant coffee':  60,
  'decaf':           5,
  'other':           null,
}

/** Estimate total caffeine (mg) from type and cups. Returns null for 'other'. */
export function estimateCaffeine(coffeeType: string, cups: number): number | null {
  const perCup = CAFFEINE_PER_CUP[coffeeType as CoffeeType] ?? null
  if (perCup == null) return null
  return Math.round(perCup * cups)
}

/** Display-friendly label for a coffee type. */
export function coffeeLabel(type: string): string {
  const labels: Record<string, string> = {
    'espresso':        'Espresso',
    'double espresso': 'Double',
    'lungo':           'Lungo',
    'americano':       'Americano',
    'cappuccino':      'Cappuccino',
    'latte':           'Latte',
    'flat white':      'Flat White',
    'filter coffee':   'Filter',
    'instant coffee':  'Instant',
    'decaf':           'Decaf',
    'other':           'Other',
  }
  return labels[type] ?? type
}
