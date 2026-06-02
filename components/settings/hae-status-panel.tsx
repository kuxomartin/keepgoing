/**
 * HAE Status Panel — server component.
 * Reads the most recent data_import_logs row for source='health_auto_export'
 * and displays ingest status, last received time, imported dates, and detected metrics.
 */

import { createClient } from '@/lib/supabase/server'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

interface LogRow {
  status: string
  rows_imported: number
  created_at: string
  error_message: string | null
  metadata: {
    date_range?: string[]
    metrics_detected?: string[]
    ingest_timestamp?: string
  } | null
}

const METRIC_LABELS: Record<string, string> = {
  hrv_ms:              'HRV',
  resting_hr:          'Resting HR',
  active_energy_kcal:  'Active energy',
  resting_energy_kcal: 'Resting energy',
  steps:               'Steps',
  vo2max:              'VO₂ max',
  respiratory_rate:    'Respiratory rate',
}

export async function HaeStatusPanel() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('data_import_logs')
    .select('status, rows_imported, created_at, error_message, metadata')
    .eq('source', 'health_auto_export')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const log = data as LogRow | null

  const lastReceivedAt = log?.metadata?.ingest_timestamp ?? log?.created_at ?? null
  const importedDates  = log?.metadata?.date_range ?? []
  const metricsDetected = log?.metadata?.metrics_detected ?? []
  const latestDate     = importedDates.length > 0 ? importedDates[importedDates.length - 1] : null
  const isError        = log?.status === 'error'

  // Ingest endpoint URL (shown but token not shown)
  const ingestPath = '/api/integrations/hae/ingest'

  return (
    <div className="space-y-5">

      {/* Status row */}
      <div className="flex items-center gap-3">
        <span className={cn(
          'text-[10px] font-bold uppercase tracking-widest',
          log == null ? 'text-white/20'
          : isError   ? 'text-[#E5173F]'
          : 'text-[#16A34A]'
        )}>
          {log == null ? '· Not received' : isError ? '✗ Error' : '✓ Active'}
        </span>
        {lastReceivedAt && (
          <span className="text-xs text-white/30">
            Last received{' '}
            {formatDistanceToNow(parseISO(lastReceivedAt), { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Detail grid */}
      {log != null && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div>
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.1em] mb-1.5">
              Last received
            </p>
            <p className="font-mono text-sm text-white/60">
              {lastReceivedAt
                ? format(parseISO(lastReceivedAt), 'EEE d MMM yyyy · HH:mm')
                : '—'}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.1em] mb-1.5">
              Latest imported date
            </p>
            <p className="font-mono text-sm text-white/60">
              {latestDate
                ? format(parseISO(latestDate), 'EEE d MMM yyyy')
                : '—'}
            </p>
          </div>

          {metricsDetected.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.1em] mb-1.5">
                Detected metrics
              </p>
              <div className="flex flex-wrap gap-1.5">
                {metricsDetected.map(m => (
                  <span
                    key={m}
                    className="px-2 py-0.5 border border-white/[0.08] text-[11px] text-white/45 font-mono"
                  >
                    {METRIC_LABELS[m] ?? m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isError && log.error_message && (
            <div className="sm:col-span-2">
              <p className="text-[10px] font-bold text-[#E5173F]/60 uppercase tracking-[0.1em] mb-1">
                Last error
              </p>
              <p className="font-mono text-xs text-[#E5173F]/70">{log.error_message}</p>
            </div>
          )}
        </div>
      )}

      {/* Endpoint info */}
      <div className="border-t border-white/[0.06] pt-4">
        <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.1em] mb-2">
          Ingest endpoint
        </p>
        <p className="font-mono text-xs text-white/40 break-all">
          POST {ingestPath}
        </p>
        <p className="text-xs text-white/25 mt-1">
          Configure in Health Auto Export: Automations → REST API → URL above.
          Set Authorization header to{' '}
          <span className="font-mono">Bearer &lt;HAE_INGEST_SECRET&gt;</span>.
          Do not include the secret here — read it from your Vercel environment variables.
        </p>
      </div>
    </div>
  )
}
