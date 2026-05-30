export const dynamic = 'force-dynamic'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ImportManager } from '@/components/settings/import-manager'
import { ImportLogTable } from '@/components/settings/import-log-table'
import { Activity, FileText, Table2, User } from 'lucide-react'
import Link from 'next/link'

export default async function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure data sources and manage automated imports.
        </p>
      </div>

      {/* ── Data Sources ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Data Sources</h2>

        {/* Google Sheets multi-import manager */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Table2 className="h-4 w-4 text-green-600" />
              <CardTitle className="text-gray-900 normal-case text-sm font-semibold tracking-normal">
                Google Sheets
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ImportManager />
          </CardContent>
        </Card>

        {/* Strava — placeholder */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />
                <CardTitle className="text-gray-900 normal-case text-sm font-semibold tracking-normal">
                  Strava — Native OAuth
                </CardTitle>
              </div>
              <Badge variant="default">Coming soon</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Direct OAuth integration with Strava for real-time activity sync.
              Until then, use the Google Sheets importer above with a Strava export.
            </p>
          </CardContent>
        </Card>

        {/* Manual entry */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-gray-900 normal-case text-sm font-semibold tracking-normal">
                  Manual entry
                </CardTitle>
              </div>
              <Badge variant="green">Active</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Log weight, food, activities, and daily check-ins directly in the dashboard.
              All manual entries are stored in Supabase and shown across the dashboard.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ── Personal Context ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Personal Context</h2>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-gray-900 normal-case text-sm font-semibold tracking-normal">
                  Health Profile &amp; Preferences
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-3">
              Import DNA analysis, food intolerance context, bike fitting, and self-reported observations.
              Used to generate more relevant insights. Not medical advice.
            </p>
            <Link
              href="/settings/context"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              Manage personal context →
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* ── Import History ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Import History</h2>
        <ImportLogTable />
      </section>
    </div>
  )
}
