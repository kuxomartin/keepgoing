export const dynamic = 'force-dynamic'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ImportManager } from '@/components/settings/import-manager'
import { ImportLogTable } from '@/components/settings/import-log-table'
import { Activity, FileText, Table2 } from 'lucide-react'

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

      {/* ── Import History ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Import History</h2>
        <ImportLogTable />
      </section>
    </div>
  )
}
