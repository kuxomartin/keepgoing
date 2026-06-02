'use client'

/**
 * Renders a sleep window as local-time strings.
 * Receives ISO UTC timestamps and formats them in the browser's local timezone
 * so the user sees their own clock time, not UTC.
 *
 * Example:  "2026-05-31 21:43:54+00" + "2026-06-01 04:05:45+00"
 *   → renders "23:43 → 06:05" (for a +02:00 user)
 */

interface Props {
  startIso: string
  endIso: string
}

function fmtLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function SleepTimeRange({ startIso, endIso }: Props) {
  return (
    <span className="font-mono text-sm text-white/35 tabular-nums">
      {fmtLocal(startIso)}&thinsp;→&thinsp;{fmtLocal(endIso)}
    </span>
  )
}
