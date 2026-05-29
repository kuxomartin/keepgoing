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
  todayHeadline: string
  todaySupporting: string[]
}
