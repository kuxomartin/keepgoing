import { Card, CardContent } from '@/components/ui/card'
import type { RecoveryResult } from '@/types/database'
import { Lightbulb } from 'lucide-react'

const recommendations: Record<string, { text: string; sub: string }> = {
  green: {
    text: "You're well recovered — go for it.",
    sub: 'Sleep, HRV and resting HR all look good. Push hard if the plan calls for it.',
  },
  yellow: {
    text: 'Moderate readiness — keep intensity controlled.',
    sub: 'One or more recovery markers are slightly off. Aim for Zone 2 or technique work.',
  },
  red: {
    text: 'Recovery is low — consider a rest or easy day.',
    sub: 'Multiple stress markers are elevated. A rest day now will pay back in performance later.',
  },
}

export function RecommendationCard({ recovery }: { recovery: RecoveryResult }) {
  const rec = recommendations[recovery.status]
  const borderColor =
    recovery.status === 'green'
      ? 'border-l-green-500'
      : recovery.status === 'yellow'
        ? 'border-l-yellow-400'
        : 'border-l-red-500'

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{rec.text}</p>
            <p className="mt-0.5 text-xs text-gray-500">{rec.sub}</p>
            {recovery.issues.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {recovery.issues.map((issue, i) => (
                  <li key={i} className="text-xs text-gray-500">
                    • {issue}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
