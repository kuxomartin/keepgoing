export const dynamic = 'force-dynamic'

import { ImportManager } from '@/components/settings/import-manager'
import { ImportLogTable } from '@/components/settings/import-log-table'
import { HaeStatusPanel } from '@/components/settings/hae-status-panel'
import Link from 'next/link'
import { Suspense } from 'react'

// ── What each import type brings into the app ─────────────────────────────────
const IMPORTED_METRICS = [
  { label: 'HRV',           status: 'active',  note: 'from Apple Health via Health Auto Export' },
  { label: 'Steps',         status: 'active',  note: 'from Apple Health via Health Auto Export' },
  { label: 'Active energy', status: 'active',  note: 'from Apple Health via Health Auto Export' },
  { label: 'Resting energy',status: 'active',  note: 'from Apple Health via Health Auto Export' },
  { label: 'Resting HR',    status: 'active',  note: 'column name must be "Resting" in your sheet' },
  { label: 'VO₂ max',       status: 'active',  note: 'from Apple Health via Health Auto Export' },
  { label: 'Sleep',         status: 'active',  note: 'imported from Apple Health Sleep sheet' },
]

export default async function SettingsPage() {
  return (
    <div>

      <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-8">Settings</p>

      {/* ── Data Sources ─────────────────────────────────────────────── */}
      <section className="border-b border-white/[0.08] pb-8 mb-8">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-6">Data sources</p>

        <div className="space-y-8">

          {/* Health Auto Export — Direct REST API (new) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-base font-semibold text-[#E7EDF2]">
                Health Auto Export → Direct API
              </p>
              <span className="text-[10px] font-bold text-[#16A34A] uppercase tracking-[0.12em]">New</span>
            </div>
            <p className="text-sm text-[#888888] mb-5">
              Apple Health data is sent directly to KeepGoing via the Health Auto Export REST API.
              No Google Sheets intermediary. Data arrives within seconds of the scheduled automation.
            </p>
            <Suspense fallback={<p className="text-xs text-white/20">Loading status…</p>}>
              <HaeStatusPanel />
            </Suspense>
          </div>

          {/* Google Sheets / Apple Health — Legacy */}
          <div className="border-t border-white/[0.08] pt-6">
            <div className="flex items-center justify-between mb-1">
              <p className="text-base font-semibold text-[#E7EDF2]">
                Apple Health → Health Auto Export → Google Sheets
              </p>
              <span className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Legacy</span>
            </div>
            <p className="text-sm text-[#888888] mb-5">
              Original flow via Google Sheets. Synced daily at 03:00 and 08:00 UTC.
              Keep enabled while validating the new direct API flow.
            </p>
            <ImportManager />
          </div>

          {/* What's currently imported */}
          <div className="border-t border-white/[0.08] pt-6">
            <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-4">
              Imported metrics — current status
            </p>
            <div className="space-y-2">
              {IMPORTED_METRICS.map(({ label, status, note }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 w-14 flex-shrink-0 ${
                    status === 'active' ? 'text-[#16A34A]' : 'text-[#E5173F]'
                  }`}>
                    {status === 'active' ? '✓ Ok' : '✗ Missing'}
                  </span>
                  <div>
                    <span className="text-sm font-medium text-[#E7EDF2]">{label}</span>
                    <span className="text-xs text-[#888888] ml-2">{note}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strava */}
          <div className="border-t border-white/[0.08] pt-6">
            <div className="flex items-center justify-between mb-1">
              <p className="text-base font-semibold text-[#E7EDF2]">Strava</p>
              <span className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Coming soon</span>
            </div>
            <p className="text-sm text-[#888888]">
              Direct OAuth integration for real-time activity sync. Use Google Sheets in the meantime.
            </p>
          </div>

          {/* Manual */}
          <div className="border-t border-white/[0.08] pt-6">
            <div className="flex items-center justify-between mb-1">
              <p className="text-base font-semibold text-[#E7EDF2]">Manual entry</p>
              <span className="text-[10px] font-bold text-[#16A34A] uppercase tracking-[0.12em]">Active</span>
            </div>
            <p className="text-sm text-[#888888]">
              Log weight, food, activities, and daily check-ins directly in the app.
            </p>
          </div>
        </div>
      </section>

      {/* ── Personal Context ──────────────────────────────────────────── */}
      <section className="border-b border-white/[0.08] pb-8 mb-8">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-4">Personal context</p>
        <p className="text-sm text-[#888888] mb-4">
          Import DNA analysis, food intolerance context, bike fitting, and self-reported observations.
          Used to generate more relevant insights.
        </p>
        <Link href="/settings/context"
          className="text-sm font-semibold text-[#E7EDF2] hover:text-[#E5173F] transition-colors">
          Manage personal context →
        </Link>
      </section>

      {/* ── Import History ────────────────────────────────────────────── */}
      <section>
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-5">Import history</p>
        <ImportLogTable />
      </section>

    </div>
  )
}
