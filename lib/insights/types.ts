/**
 * Shared types for the KeepGoing Insight + Recommendation Engine.
 *
 * Architecture is designed so an AI explanation layer can be added later:
 *   rules → insights → [optional: AI enrichment] → render
 */

export type InsightType = 'positive' | 'warning' | 'recommendation' | 'trend'
export type Severity     = 'low' | 'medium' | 'high'
export type InsightCategory = 'recovery' | 'nutrition' | 'weight' | 'activity' | 'sleep'

export interface Insight {
  id: string
  type: InsightType
  category: InsightCategory
  headline: string
  explanation: string
  confidence: Severity
  severity: Severity
}

/** Normalised per-day snapshot used by all rules */
export interface DaySummary {
  date: string            // YYYY-MM-DD
  hrv: number | null
  restingHr: number | null
  sleepMinutes: number | null
  steps: number | null
  activeEnergy: number | null
  restingEnergy: number | null
  calories: number | null  // food consumed
  protein: number | null
  weight: number | null
  activityMinutes: number  // 0 if no tracked activity
}

export interface Baselines {
  hrv7d: number | null
  hrv14d: number | null
  restingHr7d: number | null
  restingHr14d: number | null
  sleepMinutes7d: number | null
  sleepMinutes14d: number | null
  calories7d: number | null
  calories14d: number | null
  protein7d: number | null
  weight7d: number | null
  weight14d: number | null
  weight30d: number | null
  activityMinutes7d: number | null
  activityMinutes14d: number | null
}

export type TodayReadiness = 'go' | 'moderate' | 'rest'

export interface InsightEngineOutput {
  insights: Insight[]
  todayReadiness: TodayReadiness
  /** One sentence describing the recovery state. e.g. "HRV is 12% above baseline." */
  todayInterpretation: string
  /** One sentence telling the user what to do. e.g. "A hard session is on the table." */
  todayRecommendation: string
  /** Supporting evidence bullets (up to 3). */
  todaySupporting: string[]
  /** True when today had no health data and yesterday's data was used as reference. */
  usingFallback: boolean
}

// ── Trend types (used by TrendWidget) ─────────────────────────────────────────

export type TrendDirection = 'up' | 'down' | 'stable'
export type TrendSentiment = 'good' | 'bad' | 'neutral'

export interface TrendItem {
  label: string
  value: string        // formatted, e.g. "−0.6 kg", "improving", "stable"
  direction: TrendDirection
  window: string       // e.g. "14 days"
  sentiment: TrendSentiment
}

export interface TrendSummary {
  items: TrendItem[]
  interpretation: string
  recommendation: string
}
