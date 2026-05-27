'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import type { GoogleSheetsConfig, SheetPreview, ImportSummary } from '@/types/database'
import { CheckCircle, AlertCircle, XCircle, RefreshCw } from 'lucide-react'

type DataType = 'health_metrics' | 'weight_logs'

// Maps dataType → data_sources.source key (must match the API route)
const SOURCE_KEY: Record<DataType, string> = {
  health_metrics: 'google_sheets',
  weight_logs: 'google_sheets_weight',
}

interface GoogleSheetsConfigProps {
  initialConfig?: GoogleSheetsConfig | null
  dataType: DataType
  defaultSheetName?: string
}

export function GoogleSheetsConfigForm({
  initialConfig,
  dataType,
  defaultSheetName = 'Sheet1',
}: GoogleSheetsConfigProps) {
  const router = useRouter()
  const sourceKey = SOURCE_KEY[dataType]

  const [spreadsheetId, setSpreadsheetId] = useState(initialConfig?.spreadsheetId ?? '')
  const [sheetName, setSheetName] = useState(initialConfig?.sheetName ?? defaultSheetName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(!!initialConfig?.spreadsheetId)
  const [saveError, setSaveError] = useState('')

  const [preview, setPreview] = useState<(SheetPreview & { unrecognizedHeaders: string[] }) | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<ImportSummary | null>(null)
  const [syncError, setSyncError] = useState('')

  const supabase = createClient()

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setSaveError('')

    if (!spreadsheetId.trim() || !sheetName.trim()) {
      setSaveError('Spreadsheet ID and sheet name are required.')
      setSaving(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaveError('Not authenticated.')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('data_sources').upsert(
      {
        user_id: user.id,
        source: sourceKey,
        status: 'inactive',
        config: {
          spreadsheetId: spreadsheetId.trim(),
          sheetName: sheetName.trim(),
          dataType,
        },
      },
      { onConflict: 'user_id,source' }
    )

    if (error) {
      setSaveError(error.message)
    } else {
      setSaved(true)
      setPreview(null)
    }
    setSaving(false)
  }

  async function handlePreview() {
    setPreviewLoading(true)
    setPreviewError('')
    setPreview(null)

    const params = new URLSearchParams({
      spreadsheetId: spreadsheetId.trim(),
      sheetName: sheetName.trim(),
      dataType,
    })

    const res = await fetch(`/api/integrations/google-sheets/preview?${params}`)
    const data = await res.json()

    if (!res.ok) {
      setPreviewError(data.error ?? 'Preview failed')
    } else {
      setPreview(data)
    }
    setPreviewLoading(false)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    setSyncError('')

    const res = await fetch('/api/integrations/google-sheets/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spreadsheetId: spreadsheetId.trim(),
        sheetName: sheetName.trim(),
        dataType,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setSyncError(data.error ?? 'Sync failed')
    } else {
      setSyncResult(data as ImportSummary)
      router.refresh()
    }
    setSyncing(false)
  }

  function resetInputs(setter: (v: string) => void, value: string) {
    setter(value)
    setSaved(false)
    setSyncResult(null)
    setPreview(null)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSave} className="space-y-3">
        <Input
          id={`spreadsheetId-${dataType}`}
          label="Google Spreadsheet ID"
          value={spreadsheetId}
          onChange={(e) => resetInputs(setSpreadsheetId, e.target.value)}
          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
          hint="Found in the sheet URL: docs.google.com/spreadsheets/d/[ID]/edit"
        />
        <Input
          id={`sheetName-${dataType}`}
          label="Worksheet / Tab name"
          value={sheetName}
          onChange={(e) => resetInputs(setSheetName, e.target.value)}
          placeholder={defaultSheetName}
        />

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={saving} size="sm">
            {saving ? 'Saving…' : 'Save configuration'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handlePreview}
            disabled={previewLoading || !spreadsheetId.trim()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${previewLoading ? 'animate-spin' : ''}`} />
            {previewLoading ? 'Loading…' : 'Preview columns'}
          </Button>
          {saved && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" /> Saved
            </span>
          )}
        </div>

        {saveError && <p className="text-xs text-red-600">{saveError}</p>}
      </form>

      {/* Preview error */}
      {previewError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{previewError}</span>
        </div>
      )}

      {/* Preview card */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Column Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">
                ✅ Mapped fields ({Object.keys(preview.resolvedMap).length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(preview.resolvedMap).map((field) => (
                  <span key={field} className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs text-green-700">
                    {field}
                  </span>
                ))}
              </div>
            </div>

            {preview.missingRequired.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 mb-1.5 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5" /> Missing required fields
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.missingRequired.map((field) => (
                    <span key={field} className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs text-red-700">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {preview.unrecognizedHeaders.length > 0 && (
              <div>
                <p className="text-xs font-medium text-yellow-600 mb-1.5 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> Unrecognized columns (will be ignored)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.unrecognizedHeaders.map((h) => (
                    <span key={h} className="inline-flex items-center rounded-full bg-yellow-50 border border-yellow-200 px-2.5 py-0.5 text-xs text-yellow-700">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {preview.sampleRows.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Sample rows</p>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="text-xs min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {preview.detectedHeaders.map((h, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.sampleRows.map((row, ri) => (
                        <tr key={ri} className="bg-white">
                          {preview.detectedHeaders.map((_, ci) => (
                            <td key={ci} className="px-3 py-2 text-gray-700 whitespace-nowrap">{row[ci] ?? '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {preview.missingRequired.length === 0 && (
              <p className="text-xs text-green-700 flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                All required fields found — ready to sync.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sync section — visible whenever spreadsheetId is present */}
      {spreadsheetId.trim() && (
        <div className="pt-3 border-t border-gray-100 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sync</p>

          <Button onClick={handleSync} disabled={syncing} size="md">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync Google Sheets'}
          </Button>

          {syncError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{syncError}</span>
            </div>
          )}

          {syncResult && (
            <div className={`p-4 rounded-lg border text-sm space-y-2 ${
              syncResult.errors.length === 0
                ? 'bg-green-50 border-green-200'
                : syncResult.rows_imported > 0
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 font-medium">
                {syncResult.errors.length === 0 ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : syncResult.rows_imported > 0 ? (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span>
                  Import {syncResult.errors.length === 0 ? 'complete' : syncResult.rows_imported > 0 ? 'partial' : 'failed'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="text-center p-2 bg-white/60 rounded-lg">
                  <div className="font-semibold text-gray-900">{syncResult.rows_read}</div>
                  <div className="text-gray-500">Rows read</div>
                </div>
                <div className="text-center p-2 bg-white/60 rounded-lg">
                  <div className="font-semibold text-green-700">{syncResult.rows_imported}</div>
                  <div className="text-gray-500">Imported</div>
                </div>
                <div className="text-center p-2 bg-white/60 rounded-lg">
                  <div className="font-semibold text-gray-700">{syncResult.rows_skipped}</div>
                  <div className="text-gray-500">Skipped</div>
                </div>
                <div className="text-center p-2 bg-white/60 rounded-lg">
                  <div className="font-semibold text-yellow-700">{syncResult.duplicates_removed ?? 0}</div>
                  <div className="text-gray-500">Deduped</div>
                </div>
              </div>
              {syncResult.errors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Errors:</p>
                  <ul className="text-xs space-y-1">
                    {syncResult.errors.slice(0, 10).map((e, i) => (
                      <li key={i} className="text-red-700">• {e}</li>
                    ))}
                    {syncResult.errors.length > 10 && (
                      <li className="text-gray-500">… and {syncResult.errors.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
