'use client'

import { useState, useRef } from 'react'
import type { ImportSummary, ContextCategory } from '@/lib/profile/types'
import { CATEGORY_LABELS } from '@/lib/profile/types'

export function ContextImportForm() {
  const healthRef  = useRef<HTMLInputElement>(null)
  const selfRef    = useRef<HTMLInputElement>(null)
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<ImportSummary | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    if (healthRef.current?.files?.[0]) {
      formData.append('health_profile', healthRef.current.files[0])
    }
    if (selfRef.current?.files?.[0]) {
      formData.append('self_reported', selfRef.current.files[0])
    }

    if (!formData.has('health_profile') && !formData.has('self_reported')) {
      setError('Select at least one JSON file to import.')
      setLoading(false)
      return
    }

    try {
      const res  = await fetch('/api/profile/import', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Import failed')
      } else {
        setResult(json as ImportSummary)
        // Reset file inputs
        if (healthRef.current) healthRef.current.value = ''
        if (selfRef.current)   selfRef.current.value   = ''
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Health profile JSON
            </label>
            <input
              ref={healthRef}
              type="file"
              accept=".json,application/json"
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-200 file:text-xs file:font-medium file:text-gray-700 file:bg-gray-50 hover:file:bg-gray-100 file:cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Self-reported JSON
            </label>
            <input
              ref={selfRef}
              type="file"
              accept=".json,application/json"
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-200 file:text-xs file:font-medium file:text-gray-700 file:bg-gray-50 hover:file:bg-gray-100 file:cursor-pointer"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Importing…' : 'Import JSON files'}
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 space-y-2">
          <p className="text-sm font-medium text-green-800">
            Import complete — {result.facts_imported} facts imported
            {result.facts_skipped > 0 && `, ${result.facts_skipped} skipped`}.
          </p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5">
            {Object.entries(result.categories).map(([cat, count]) => (
              <li key={cat} className="text-xs text-green-700">
                {CATEGORY_LABELS[cat as ContextCategory] ?? cat}: {count}
              </li>
            ))}
          </ul>
          <p className="text-xs text-green-600">Re-import is idempotent — existing facts are updated, not duplicated.</p>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Accepted: martin_health_profile_v2.json + martin_self_reported.json.
        All findings are informational only — not medical advice.
      </p>
    </div>
  )
}
