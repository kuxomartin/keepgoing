import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DifficultyExplanation } from '@/lib/insights/activity-difficulty'
import { AlertCircle, CheckCircle } from 'lucide-react'

export function DifficultyCard({ explanation }: { explanation: DifficultyExplanation }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Why did this feel hard?</CardTitle>
      </CardHeader>
      <CardContent>
        {explanation.reasons.length === 0 ? (
          <div className="flex items-start gap-2 text-sm text-gray-500">
            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
            <span>{explanation.summary}</span>
          </div>
        ) : (
          <div className="space-y-2">
            <ul className="space-y-1.5">
              {explanation.reasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  {reason}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 pt-1 border-t border-gray-100">
              {explanation.summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
