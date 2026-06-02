'use client'

/**
 * Renders a sleep window as local-time strings.
 * Uses useEffect + useState to ensure the browser's local timezone is used —
 * avoiding a hydration mismatch between the server (UTC) and the client.
 *
 * Example: "2026-05-31T21:43:00+00:00" + "2026-06-01T04:05:00+00:00"
 *   → renders "23:43 → 06:05" (for a +02:00 user in CEST)
 */

import { useState, useEffect } from 'react'

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
  // Mount guard: render nothing on server (avoids hydration mismatch)
  // and show client-local time after hydration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  return (
    <span className="font-mono text-base text-white/40 tabular-nums">
      {fmtLocal(startIso)}&thinsp;→&thinsp;{fmtLocal(endIso)}
    </span>
  )
}
