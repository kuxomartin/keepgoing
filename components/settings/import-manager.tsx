'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  RefreshCw, Plus, Pencil, Trash2, Play, Eye, CheckCircle,
  AlertCircle, XCircle, ChevronDown, ChevronUp, Zap,
} from 'lucide-react'
import { format } from 'date-fns'
import type { GoogleSheetImport, ImportSummary, SupportedDataType } from '@/types/database'

// ── Types ────────────────────────────────────────────────────────────────────

interface PreviewResult {
  detectedHeaders: string[]
  resolvedMap: Record<string, number>
  missingRequired: string[]
  sampleRows: string[][]
  unrecognizedHeaders: string[]
}

interface SyncResult {
  id: string
  name: string
  summary: ImportSummary
  error?: string
}

// ── Preset configs ───────────────────────────────────────────────────────────

const PRESETS: Array<Omit<GoogleSheetImport, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_sync_at'>> = [
  {
    name: 'Apple Health Daily Metrics',
    spreadsheet_id: '1vFZPmCfeUP4PB0d-e6J-WAWIZJk0D2daJ-hPIX_JvqE',
    sheet_name: 'Daily Metrics',
    data_type: 'health_metrics',
    enabled: true,
    import_priority: 10,
  },
  {
    name: 'Apple Health Weight',
    spreadsheet_id: '1vFZPmCfeUP4PB0d-e6J-WAWIZJk0D2daJ-hPIX_JvqE',
    sheet_name: 'Weight',
    data_type: 'weight_logs',
    enabled: true,
    import_priority: 20,
  },
  {
    name: 'Strava Activities',
    spreadsheet_id: '1mb-cYYIA68o1sn54X4xrQYSeFoh2Wk-Ht78XTqoydHk',
    sheet_name: 'Strava',
    data_type: 'strava_activities',
    enabled: true,
    import_priority: 30,
  },
]

const DATA_TYPE_LABELS: Record<SupportedDataType, string> = {
  health_metrics:    'Health Metrics',
  weight_logs:       'Weight Logs',
  strava_activities: 'Strava Activities',
}

const DATA_TYPE_BADGE: Record<SupportedDataType, 'blue' | 'green' | 'yellow'> = {
  health_metrics:    'blue',
  weight_logs:       'green',
  strava_activities: 'yellow',
}

function shortenId(id: string) {
  return id.length > 20 ? `${id.slice(0, 10)}…${id.slice(-6)}` : id
}

// ── Empty form state ─────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  spreadsheet_id: '',
  sheet_name: '',
  data_type: 'health_metrics' as SupportedDataType,
  enabled: true,
  import_priority: 100,
}

// ── Main component ───────────────────────────────────────────────────────────

export function ImportManager() {
  const [imports, setImports] = useState<GoogleSheetImport[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Per-import preview/sync results
  const [previewTarget, setPreviewTarget]   = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)
  const [previewResult, setPreviewResult]   = useState<PreviewResult | null>(null)
  const [previewError, setPreviewError]     = useState('')

  const [syncingId, setSyncingId]         = useState<string | null>(null)
  const [syncingAll, setSyncingAll]       = useState(false)
  const [syncResult, setSyncResult]       = useState<ImportSummary | null>(null)
  const [syncAllResults, setSyncAllResults] = useState<SyncResult[] | null>(null)
  const [syncError, setSyncError]         = useState('')
  const [syncResultTarget, setSyncResultTarget] = useState<string | null>(null)

  // Fetch imports on mount
  const fetchImports = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/integrations/google-sheets/imports')
    if (res.ok) {
      const data = await res.json()
      setImports(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchImports() }, [fetchImports])

  // ── Form helpers ────────────────────────────────────────────────────────────

  function openAddForm(preset?: typeof EMPTY_FORM) {
    setEditingId(null)
    setForm(preset ?? { ...EMPTY_FORM })
    setSaveError('')
    setShowForm(true)
  }

  function openEditForm(imp: GoogleSheetImport) {
    setEditingId(imp.id)
    setForm({
      name:             imp.name,
      spreadsheet_id:   imp.spreadsheet_id,
      sheet_name:       imp.sheet_name,
      data_type:        imp.data_type,
      enabled:          imp.enabled,
      import_priority:  imp.import_priority,
    })
    setSaveError('')
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setSaveError('')
  }

  async function handleSave() {
    if (!form.name.trim() || !form.spreadsheet_id.trim() || !form.sheet_name.trim()) {
      setSaveError('Name, Spreadsheet ID, and Sheet Name are required.')
      return
    }
    setSaving(true)
    setSaveError('')
    const res = await fetch('/api/integrations/google-sheets/imports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, ...(editingId ? { id: editingId } : {}) }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSaveError(data.error ?? 'Save failed')
    } else {
      setShowForm(false)
      setEditingId(null)
      await fetchImports()
    }
    setSaving(false)
  }

  // ── Toggle enable/disable ────────────────────────────────────────────────────

  async function toggleEnabled(imp: GoogleSheetImport) {
    await fetch('/api/integrations/google-sheets/imports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...imp, enabled: !imp.enabled }),
    })
    await fetchImports()
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm('Delete this import configuration?')) return
    await fetch(`/api/integrations/google-sheets/imports?id=${id}`, { method: 'DELETE' })
    await fetchImports()
  }

  // ── Preview ───────────────────────────────────────────────────────────────────

  async function handlePreview(id: string) {
    if (previewTarget === id) {
      // Toggle off
      setPreviewTarget(null)
      setPreviewResult(null)
      return
    }
    setPreviewLoading(id)
    setPreviewError('')
    setPreviewResult(null)
    setPreviewTarget(id)

    const res = await fetch('/api/integrations/google-sheets/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importId: id }),
    })
    const data = await res.json()
    if (!res.ok) {
      setPreviewError(data.error ?? 'Preview failed')
    } else {
      setPreviewResult(data)
    }
    setPreviewLoading(null)
  }

  // ── Sync one ─────────────────────────────────────────────────────────────────

  async function handleSync(id: string) {
    setSyncingId(id)
    setSyncResult(null)
    setSyncAllResults(null)
    setSyncError('')
    setSyncResultTarget(id)

    const res = await fetch('/api/integrations/google-sheets/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importId: id }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSyncError(data.error ?? 'Sync failed')
    } else {
      setSyncResult(data as ImportSummary)
      await fetchImports()
    }
    setSyncingId(null)
  }

  // ── Sync all ─────────────────────────────────────────────────────────────────

  async function handleSyncAll() {
    setSyncingAll(true)
    setSyncResult(null)
    setSyncAllResults(null)
    setSyncError('')
    setSyncResultTarget('all')

    const res = await fetch('/api/integrations/google-sheets/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncAll: true }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSyncError(data.error ?? 'Sync failed')
    } else {
      setSyncAllResults(data.results as SyncResult[])
      await fetchImports()
    }
    setSyncingAll(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Google Sheets Imports</h3>
          <p className="text-xs text-gray-500 mt-0.5">Configured imports — synced daily at 03:00 UTC.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSyncAll}
            disabled={syncingAll || imports.filter((i) => i.enabled).length === 0}
          >
            <Zap className={`h-3.5 w-3.5 ${syncingAll ? 'animate-pulse' : ''}`} />
            {syncingAll ? 'Syncing…' : 'Sync All'}
          </Button>
          <Button size="sm" onClick={() => openAddForm()}>
            <Plus className="h-3.5 w-3.5" /> Add Import
          </Button>
        </div>
      </div>

      {/* Imports table */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : imports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center space-y-3">
          <p className="text-sm text-gray-500">No import configurations yet.</p>
          <p className="text-xs text-gray-400">Use the quick-add presets below or click &ldquo;Add Import&rdquo;.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Sheet</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Last Sync</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {imports.map((imp) => (
                <tr key={imp.id} className={`hover:bg-gray-50 ${!imp.enabled ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2.5 text-gray-900 font-medium">
                    <div>{imp.name}</div>
                    <div className="text-gray-400 font-normal">{shortenId(imp.spreadsheet_id)}</div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 hidden sm:table-cell">{imp.sheet_name}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={DATA_TYPE_BADGE[imp.data_type]}>
                      {DATA_TYPE_LABELS[imp.data_type]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 hidden md:table-cell whitespace-nowrap">
                    {imp.last_sync_at
                      ? format(new Date(imp.last_sync_at), 'dd MMM, HH:mm')
                      : <span className="text-gray-300">Never</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={imp.enabled ? 'green' : 'default'}>
                      {imp.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {/* Preview */}
                      <button
                        onClick={() => handlePreview(imp.id)}
                        disabled={previewLoading === imp.id}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"
                        title="Preview columns"
                      >
                        {previewLoading === imp.id
                          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          : previewTarget === imp.id
                            ? <ChevronUp className="h-3.5 w-3.5" />
                            : <Eye className="h-3.5 w-3.5" />
                        }
                      </button>
                      {/* Sync */}
                      <button
                        onClick={() => handleSync(imp.id)}
                        disabled={syncingId === imp.id}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-green-600 transition-colors"
                        title="Sync now"
                      >
                        {syncingId === imp.id
                          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          : <Play className="h-3.5 w-3.5" />
                        }
                      </button>
                      {/* Enable/Disable */}
                      <button
                        onClick={() => toggleEnabled(imp)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-yellow-600 transition-colors"
                        title={imp.enabled ? 'Disable' : 'Enable'}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      {/* Edit */}
                      <button
                        onClick={() => openEditForm(imp)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(imp.id)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Preview panel ──────────────────────────────────────────────────── */}
      {previewTarget && (
        <Card>
          <CardHeader>
            <CardTitle>
              Column Preview — {imports.find((i) => i.id === previewTarget)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {previewError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{previewError}</span>
              </div>
            )}
            {previewResult && (
              <>
                {/* Mapped fields */}
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5">
                    ✅ Mapped fields ({Object.keys(previewResult.resolvedMap).length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(previewResult.resolvedMap).map((f) => (
                      <span key={f} className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs text-green-700">{f}</span>
                    ))}
                  </div>
                </div>
                {/* Missing required */}
                {previewResult.missingRequired.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-600 mb-1.5 flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" /> Missing required fields
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {previewResult.missingRequired.map((f) => (
                        <span key={f} className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs text-red-700">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Unrecognized */}
                {previewResult.unrecognizedHeaders.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-yellow-600 mb-1.5 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> Unrecognized columns (ignored)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {previewResult.unrecognizedHeaders.map((h) => (
                        <span key={h} className="inline-flex items-center rounded-full bg-yellow-50 border border-yellow-200 px-2.5 py-0.5 text-xs text-yellow-700">{h}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Sample rows */}
                {previewResult.sampleRows.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1.5">Sample rows</p>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="text-xs min-w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            {previewResult.detectedHeaders.map((h, i) => (
                              <th key={i} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {previewResult.sampleRows.map((row, ri) => (
                            <tr key={ri} className="bg-white">
                              {previewResult.detectedHeaders.map((_, ci) => (
                                <td key={ci} className="px-3 py-2 text-gray-700 whitespace-nowrap">{row[ci] ?? '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {previewResult.missingRequired.length === 0 && (
                  <p className="text-xs text-green-700 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> All required fields found — ready to sync.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Sync result (single) ────────────────────────────────────────────── */}
      {syncError && syncResultTarget !== 'all' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{syncError}</span>
        </div>
      )}
      {syncResult && syncResultTarget !== 'all' && (
        <SyncResultCard
          result={syncResult}
          label={imports.find((i) => i.id === syncResultTarget)?.name ?? 'Sync'}
        />
      )}

      {/* ── Sync all results ────────────────────────────────────────────────── */}
      {syncAllResults && (
        <Card>
          <CardHeader>
            <CardTitle>Sync All Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {syncError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{syncError}</div>
            )}
            {syncAllResults.map((r) => (
              <div key={r.id}>
                <p className="text-xs font-medium text-gray-600 mb-1">{r.name}</p>
                <SyncResultCard result={r.summary} label="" compact />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Add/Edit form ────────────────────────────────────────────────────── */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Import' : 'Add Import'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              id="import-name"
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Apple Health Daily Metrics"
            />
            <Input
              id="import-spreadsheet-id"
              label="Google Spreadsheet ID"
              value={form.spreadsheet_id}
              onChange={(e) => setForm((f) => ({ ...f, spreadsheet_id: e.target.value }))}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              hint="Found in the sheet URL: docs.google.com/spreadsheets/d/[ID]/edit"
            />
            <Input
              id="import-sheet-name"
              label="Worksheet / Tab name"
              value={form.sheet_name}
              onChange={(e) => setForm((f) => ({ ...f, sheet_name: e.target.value }))}
              placeholder="Sheet1"
            />
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">Data Type</label>
              <select
                value={form.data_type}
                onChange={(e) => setForm((f) => ({ ...f, data_type: e.target.value as SupportedDataType }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="health_metrics">Health Metrics</option>
                <option value="weight_logs">Weight Logs</option>
                <option value="strava_activities">Strava Activities</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  className="rounded"
                />
                Enabled
              </label>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Priority</label>
                <input
                  type="number"
                  value={form.import_priority}
                  onChange={(e) => setForm((f) => ({ ...f, import_priority: Number(e.target.value) }))}
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                  min={1}
                />
              </div>
            </div>

            {saveError && <p className="text-xs text-red-600">{saveError}</p>}

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Import'}
              </Button>
              <Button size="sm" variant="secondary" onClick={cancelForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Quick-add presets ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick-add Presets</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const alreadyExists = imports.some(
              (i) =>
                i.spreadsheet_id === preset.spreadsheet_id &&
                i.sheet_name === preset.sheet_name &&
                i.data_type === preset.data_type
            )
            return (
              <button
                key={preset.name}
                disabled={alreadyExists}
                onClick={() => openAddForm({ ...preset })}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  alreadyExists
                    ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                    : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer'
                }`}
              >
                {alreadyExists ? '✓ ' : '+ '}{preset.name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Sync result card helper ───────────────────────────────────────────────────

function SyncResultCard({
  result,
  label,
  compact = false,
}: {
  result: ImportSummary
  label: string
  compact?: boolean
}) {
  const isSuccess = result.errors.length === 0
  const isPartial = !isSuccess && result.rows_imported > 0

  return (
    <div className={`p-${compact ? '3' : '4'} rounded-lg border text-sm space-y-2 ${
      isSuccess ? 'bg-green-50 border-green-200'
      : isPartial ? 'bg-yellow-50 border-yellow-200'
      : 'bg-red-50 border-red-200'
    }`}>
      <div className="flex items-center gap-2 font-medium">
        {isSuccess
          ? <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
          : isPartial
            ? <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
            : <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
        }
        <span>
          {label && `${label} — `}
          {isSuccess ? 'Import complete' : isPartial ? 'Partial import' : 'Import failed'}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        {[
          { label: 'Read',     value: result.rows_read,         color: 'text-gray-900' },
          { label: 'Imported', value: result.rows_imported,     color: 'text-green-700' },
          { label: 'Skipped',  value: result.rows_skipped,      color: 'text-gray-700' },
          { label: 'Deduped',  value: result.duplicates_removed, color: 'text-yellow-700' },
        ].map(({ label: l, value, color }) => (
          <div key={l} className="text-center p-2 bg-white/60 rounded-lg">
            <div className={`font-semibold ${color}`}>{value}</div>
            <div className="text-gray-500">{l}</div>
          </div>
        ))}
      </div>
      {result.errors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Errors:</p>
          <ul className="text-xs space-y-0.5">
            {result.errors.slice(0, 5).map((e, i) => (
              <li key={i} className="text-red-700">• {e}</li>
            ))}
            {result.errors.length > 5 && (
              <li className="text-gray-500">… and {result.errors.length - 5} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
