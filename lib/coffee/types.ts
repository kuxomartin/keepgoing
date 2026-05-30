/** Coffee types tailored to real personal usage. */

export const COFFEE_TYPES = [
  'filter_225',
  'filter_300',
  'espresso_office',
  'espresso_home_single',
  'espresso_home_double',
  'custom_filter',
  'decaf',
] as const

export type CoffeeType = (typeof COFFEE_TYPES)[number]

/** Display order — most common first. */
export const COFFEE_TYPE_ORDER: CoffeeType[] = [
  'filter_225',
  'filter_300',
  'espresso_office',
  'espresso_home_single',
  'espresso_home_double',
  'custom_filter',
  'decaf',
]

export interface CoffeeSpec {
  label: string
  sublabel: string         // shown under the button
  defaultCaffeineMg: number | null
  isCustom: boolean        // custom_filter needs a volume input
}

export const COFFEE_SPECS: Record<CoffeeType, CoffeeSpec> = {
  'filter_225':           { label: 'Filter 225 ml',   sublabel: '~165 mg caffeine',  defaultCaffeineMg: 165,  isCustom: false },
  'filter_300':           { label: 'Filter 300 ml',   sublabel: '~220 mg caffeine',  defaultCaffeineMg: 220,  isCustom: false },
  'espresso_office':      { label: 'Espresso Office', sublabel: '~75 mg caffeine',   defaultCaffeineMg: 75,   isCustom: false },
  'espresso_home_single': { label: 'Home Single',     sublabel: '~75 mg caffeine',   defaultCaffeineMg: 75,   isCustom: false },
  'espresso_home_double': { label: 'Home Double',     sublabel: '~150 mg caffeine',  defaultCaffeineMg: 150,  isCustom: false },
  'custom_filter':        { label: 'Custom Filter',   sublabel: 'enter volume below', defaultCaffeineMg: null, isCustom: true  },
  'decaf':                { label: 'Decaf',           sublabel: '~5 mg caffeine',    defaultCaffeineMg: 5,    isCustom: false },
}

/** Default caffeine per single serving (cup). null = calculated dynamically. */
export const CAFFEINE_PER_CUP: Record<CoffeeType, number | null> = {
  'filter_225':           165,
  'filter_300':           220,
  'espresso_office':      75,
  'espresso_home_single': 75,
  'espresso_home_double': 150,
  'custom_filter':        null,
  'decaf':                5,
}

/**
 * Custom filter calculation (specialty Arabica, 1:15 ratio, ~11 mg caffeine/g):
 *   coffee_g  = volume_ml / 15
 *   caffeine  = coffee_g  × 11
 */
export function customFilterCaffeine(volumeMl: number): { coffeeG: number; caffeineMg: number } {
  const coffeeG    = Math.round((volumeMl / 15) * 10) / 10
  const caffeineMg = Math.round(coffeeG * 11)
  return { coffeeG, caffeineMg }
}

/** Estimate total caffeine from type × cups. Returns null for custom_filter. */
export function estimateCaffeine(coffeeType: string, cups: number): number | null {
  const perCup = CAFFEINE_PER_CUP[coffeeType as CoffeeType] ?? null
  if (perCup == null) return null
  return Math.round(perCup * cups)
}

/**
 * Display-friendly label. Handles both new types and historical legacy types
 * (so old logs keep a readable name without needing a DB migration).
 */
export function coffeeLabel(type: string): string {
  const spec = COFFEE_SPECS[type as CoffeeType]
  if (spec) return spec.label

  // Legacy type fallback — historical logs stay readable
  const legacy: Record<string, string> = {
    'espresso':        'Espresso',
    'double espresso': 'Double Espresso',
    'lungo':           'Lungo',
    'americano':       'Americano',
    'cappuccino':      'Cappuccino',
    'latte':           'Latte',
    'flat white':      'Flat White',
    'filter coffee':   'Filter Coffee',
    'instant coffee':  'Instant Coffee',
    'other':           'Other',
    'decaf':           'Decaf',
  }
  return legacy[type] ?? type
}
