/**
 * Rule-based activity proposal engine.
 * Returns an Optimal + Minimum activity suggestion based on readiness,
 * recent training history, and body signals.
 * Zero AI tokens.
 */

import type { TodayReadiness } from './types'

export interface ActivityProposal {
  optimal: string | null       // null on full rest days
  optimalDuration: string | null
  why: string[]                // 1–2 short bullet reasons
  minimum: string
  showMinimumOnly: boolean     // true = recover day, minimum is the ceiling
}

export interface ActivityProposalInput {
  readiness: TodayReadiness
  sleepH: number | null
  weeklyActivityMins: number
  daysSinceLastBike: number | null  // null = no bike in 30 days
  daysSinceLastRun: number | null   // null = no run in 30 days
  daysSinceHardSession: number | null
  hrvRatio: number | null           // today HRV / 14-day baseline
  checkinSoreness: number | null    // 1–10
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isCyclist(daysSinceLastBike: number | null): boolean {
  return daysSinceLastBike != null && daysSinceLastBike < 14
}

function isRunner(daysSinceLastRun: number | null, daysSinceLastBike: number | null): boolean {
  // Runner if they run and either don't cycle at all, or cycle less frequently
  return (
    daysSinceLastRun != null &&
    daysSinceLastRun < 14 &&
    (daysSinceLastBike == null || daysSinceLastRun <= daysSinceLastBike)
  )
}

// ── Main function ─────────────────────────────────────────────────────────────

export function buildActivityProposal(input: ActivityProposalInput): ActivityProposal {
  const {
    readiness,
    sleepH,
    weeklyActivityMins,
    daysSinceLastBike,
    daysSinceLastRun,
    daysSinceHardSession,
    hrvRatio,
    checkinSoreness,
  } = input

  const cyclist = isCyclist(daysSinceLastBike)
  const runner  = !cyclist && isRunner(daysSinceLastRun, daysSinceLastBike)
  const highLoad = weeklyActivityMins > 350

  // ── RECOVER ──────────────────────────────────────────────────────────────────
  if (readiness === 'recover') {
    const why: string[] = []
    if (sleepH != null && sleepH < 5.5) why.push(`Short sleep at ${sleepH.toFixed(1)}h.`)
    else if (hrvRatio != null && hrvRatio < 0.85) {
      why.push(`HRV is ${Math.round((1 - hrvRatio) * 100)}% below baseline.`)
    }
    if (why.length === 0) why.push('Recovery markers are significantly suppressed.')
    why.push('Allow the body to fully restore before the next effort.')

    return {
      optimal: null,
      optimalDuration: null,
      why,
      minimum: '20 min gentle walk or stretching',
      showMinimumOnly: true,
    }
  }

  // ── EASY ─────────────────────────────────────────────────────────────────────
  if (readiness === 'easy') {
    const why: string[] = []

    if (hrvRatio != null && hrvRatio < 0.95) {
      why.push(`HRV is ${Math.round((1 - hrvRatio) * 100)}% below baseline.`)
    } else if (highLoad) {
      why.push(`${Math.round(weeklyActivityMins)} min training logged this week.`)
    } else if (checkinSoreness != null && checkinSoreness >= 7) {
      why.push('Soreness is elevated from recent efforts.')
    } else {
      why.push('Recovery is at a moderate level.')
    }
    why.push('Light movement improves circulation without adding stress.')

    const optimal = cyclist
      ? '30–45 min easy Zone 2 ride'
      : runner
        ? '30–40 min easy run or walk'
        : '30–45 min walk or mobility session'

    return {
      optimal,
      optimalDuration: null,
      why,
      minimum: '20 min walk',
      showMinimumOnly: false,
    }
  }

  // ── TRAIN ─────────────────────────────────────────────────────────────────────
  if (readiness === 'train') {
    const why: string[] = []

    if (hrvRatio != null && hrvRatio >= 0.98) {
      why.push('HRV is near baseline — body is ready.')
    } else if (sleepH != null && sleepH >= 7) {
      why.push(`Good sleep at ${sleepH.toFixed(1)}h.`)
    } else {
      why.push('Recovery is at a solid level.')
    }

    if (daysSinceHardSession != null && daysSinceHardSession >= 3) {
      why.push(`Last hard effort was ${daysSinceHardSession} days ago — you have room to push.`)
    } else if (highLoad) {
      why.push('Weekly load is accumulating — stay moderate.')
    }

    let optimal: string
    if (cyclist) {
      optimal = highLoad
        ? '60–75 min Zone 2 ride'
        : daysSinceHardSession != null && daysSinceHardSession >= 3
          ? '90 min moderate ride — include some tempo'
          : '60–90 min Zone 2 ride'
    } else if (runner) {
      optimal = '45–60 min moderate run'
    } else {
      optimal = 'Strength session or 45–60 min moderate cardio'
    }

    const minimum = cyclist
      ? '30 min easy spin'
      : runner
        ? '30 min easy jog'
        : '20 min Zone 2 or mobility'

    return {
      optimal,
      optimalDuration: null,
      why,
      minimum,
      showMinimumOnly: false,
    }
  }

  // ── PUSH ─────────────────────────────────────────────────────────────────────
  const why: string[] = []

  if (hrvRatio != null && hrvRatio >= 1.10) {
    why.push(`HRV is ${Math.round((hrvRatio - 1) * 100)}% above baseline — peak readiness.`)
  } else if (hrvRatio != null) {
    why.push('Recovery is elevated and body signals are strong.')
  }

  if (daysSinceHardSession != null && daysSinceHardSession >= 4) {
    why.push(`Last hard effort was ${daysSinceHardSession} days ago — fresh and ready.`)
  } else if (!highLoad) {
    why.push('Cumulative load is low — room for a quality effort.')
  }

  let optimal: string
  if (cyclist) {
    optimal = daysSinceHardSession != null && daysSinceHardSession >= 5
      ? '2–3h endurance ride or include tempo segments'
      : '90–120 min Zone 2 ride with threshold intervals'
  } else if (runner) {
    optimal = 'Hard interval session or 60–75 min tempo run'
  } else {
    optimal = 'High-intensity strength session or 60–90 min quality effort'
  }

  const minimum = cyclist
    ? '45 min easy spin'
    : runner
      ? '30 min easy run'
      : '30 min Zone 2 cardio'

  return {
    optimal,
    optimalDuration: null,
    why,
    minimum,
    showMinimumOnly: false,
  }
}
