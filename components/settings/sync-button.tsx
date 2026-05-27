'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import type { ImportSummary } from '@/types/database'

interface SyncButtonProps {
  spreadsheetId?: string
  sheetName?: string
}

export function SyncButton({ spreadsheetId, sheetName }: SyncButtonProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportSummary | null>(null)
  const [error, setError] = useState('')

  async function handleSync() {
    setLoading(true)
    setResult(null)
    setError('')

    const body = spreadsheetId && sheetName
      ? JSON.stringify({ spreadsheetId, sheetName, dataType: 'health_metrics' })
      : undefined

    const res = await fetch('/api/integrations/google-sheets/sync', {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body,
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Sync failed')
    } else {
      setResult(data as ImportSummary)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={handleSync}
        disabled={loading}
        size="md"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Syncing…' : 'Sync Google Sheets'}
      </Button>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className={`p-4 rounded-lg border text-sm space-y-2 ${
          result.errors.length === 0
            ? 'bg-green-50 border-green-200'
            : result.rows_imported > 0
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {result.errors.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : result.rows_imported > 0 ? (
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span>Import {result.errors.length === 0 ? 'complete' : result.rows_imported > 0 ? 'partial' : 'failed'}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center p-2 bg-white/60 rounded-lg">
              <div className="font-semibold text-gray-900">{result.rows_read}</div>
              <div className="text-gray-500">Rows read</div>
            </div>
            <div className="text-center p-2 bg-white/60 rounded-lg">
              <div className="font-semibold text-green-700">{result.rows_imported}</div>
              <div className="text-gray-500">Imported</div>
            </div>
            <div className="text-center p-2 bg-white/60 rounded-lg">
              <div className="font-semibold text-gray-700">{result.rows_skipped}</div>
              <div className="text-gray-500">Skipped</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Errors:</p>
              <ul className="text-xs space-y-1">
                {result.errors.slice(0, 10).map((e, i) => (
                  <li key={i} className="text-red-700">• {e}</li>
                ))}
                {result.errors.length > 10 && (
                  <li className="text-gray-500">… and {result.errors.length - 10} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
