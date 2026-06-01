import { MetricsSearch } from '@/components/metrics/metrics-search'
import { METRICS } from '@/lib/metrics-library'

export const metadata = { title: 'Metrics Library — KeepGoing' }

export default function MetricsLibraryPage() {
  return (
    <div>
      <div className="bg-[#F2EDE6] dark:bg-zinc-900 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-6 pb-8 mb-8">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-4">Metrics Library</p>
        <p className="text-base text-[#888888]">
          Definitions for every metric tracked in the app.
          <span className="ml-2 font-semibold text-[#0D0D0D] dark:text-zinc-50">{METRICS.length} metrics.</span>
        </p>
      </div>
      <MetricsSearch />
    </div>
  )
}
