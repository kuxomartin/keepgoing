'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import type { DataImportLog } from '@/types/database'

export function ImportLogTable() {
  const [logs, setLogs] = useState<DataImportLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('data_import_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      setLogs((data as DataImportLog[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p className="text-sm text-gray-400">Loading import history…</p>
  if (logs.length === 0) return <p className="text-sm text-gray-400">No imports yet.</p>

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Date</th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Source</th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
            <th className="px-4 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Read</th>
            <th className="px-4 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Imported</th>
            <th className="px-4 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Skipped</th>
            <th className="px-4 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Deduped</th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Error</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {logs.map((log) => {
            const meta = log.metadata as Record<string, unknown> | null
            const dupes = typeof meta?.duplicates_removed === 'number' ? meta.duplicates_removed : null

            return (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                  {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm')}
                </td>
                <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                  <span className="capitalize">{log.source.replace(/_/g, ' ')}</span>
                  {typeof meta?.dataType === 'string' && (
                    <span className="ml-1 text-gray-400">· {meta.dataType.replace(/_/g, ' ')}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Badge variant={log.status === 'success' ? 'green' : log.status === 'partial' ? 'yellow' : 'red'}>
                    {log.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-right text-gray-700">{log.rows_read}</td>
                <td className="px-4 py-2.5 text-right font-medium text-green-700">{log.rows_imported}</td>
                <td className="px-4 py-2.5 text-right text-gray-400">{log.rows_skipped}</td>
                <td className="px-4 py-2.5 text-right text-yellow-600 hidden md:table-cell">
                  {dupes !== null ? dupes : '—'}
                </td>
                <td className="px-4 py-2.5 text-red-600 max-w-xs truncate hidden lg:table-cell">
                  {log.error_message ?? '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
