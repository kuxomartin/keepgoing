import { MetricsSearch } from '@/components/metrics/metrics-search'
import { METRICS } from '@/lib/metrics-library'

export const metadata = {
  title: 'Metrics Library — KeepGoing',
}

export default function MetricsLibraryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Metrics Library</h1>
        <p className="mt-1 text-sm text-gray-500">
          Definitions for every metric used in the app. {METRICS.length} metrics.
        </p>
      </div>
      <MetricsSearch />
    </div>
  )
}
