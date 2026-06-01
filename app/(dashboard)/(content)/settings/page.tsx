export const dynamic = 'force-dynamic'

import { ImportManager } from '@/components/settings/import-manager'
import { ImportLogTable } from '@/components/settings/import-log-table'
import { ThemeToggle } from '@/components/settings/theme-toggle'
import Link from 'next/link'

// ── What each import type brings into the app ─────────────────────────────────
const IMPORTED_METRICS = [
  { label: 'HRV',           status: 'active',  note: 'from Apple Health via Health Auto Export' },
  { label: 'Steps',         status: 'active',  note: 'from Apple Health via Health Auto Export' },
  { label: 'Active energy', status: 'active',  note: 'from Apple Health via Health Auto Export' },
  { label: 'Resting energy',status: 'active',  note: 'from Apple Health via Health Auto Export' },
  { label: 'Resting HR',    status: 'active',  note: 'column name must be "Resting" in your sheet' },
  { label: 'VO₂ max',       status: 'active',  note: 'from Apple Health via Health Auto Export' },
  { label: 'Sleep',         status: 'missing', note: 'not found in your current sheet — add sleep column to fix' },
]

export default async function SettingsPage() {
  return (
    <div>

      <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-8">Settings</p>

      {/* ── Appearance ───────────────────────────────────────────────── */}
      <section className="border-b border-[#D9D9D9] dark:border-zinc-800 pb-8 mb-8">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-5">Appearance</p>
        <ThemeToggle />
      </section>

      {/* ── Data Sources ─────────────────────────────────────────────── */}
      <section className="border-b border-[#D9D9D9] dark:border-zinc-800 pb-8 mb-8">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-6">Data sources</p>

        <div className="space-y-8">

          {/* Google Sheets / Apple Health */}
          <div>
            <p className="text-base font-semibold text-[#0D0D0D] dark:text-zinc-50 mb-1">
              Apple Health → Health Auto Export → Google Sheets
            </p>
            <p className="text-sm text-[#888888] mb-5">
              Synced daily at 03:00 and 08:00 UTC. Health Auto Export writes Apple Health data to
              Google Sheets; KeepGoing reads those sheets and stores them in the database.
            </p>
            <ImportManager />
          </div>

          {/* What's currently imported */}
          <div className="border-t border-[#D9D9D9] dark:border-zinc-800 pt-6">
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
                    <span className="text-sm font-medium text-[#0D0D0D] dark:text-zinc-200">{label}</span>
                    <span className="text-xs text-[#888888] ml-2">{note}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sleep setup instructions */}
          <div className="border-t border-[#D9D9D9] dark:border-zinc-800 pt-6">
            <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em] mb-3">
              How to add sleep data
            </p>
            <p className="text-sm text-[#888888] leading-relaxed mb-3">
              Sleep data is not in your current Daily Metrics sheet. To add it:
            </p>
            <ol className="space-y-2 text-sm text-[#888888]">
              <li className="flex gap-2">
                <span className="text-[#0D0D0D] dark:text-zinc-300 font-semibold flex-shrink-0">1.</span>
                Open <span className="font-medium text-[#0D0D0D] dark:text-zinc-200 mx-1">Health Auto Export</span> on your iPhone.
              </li>
              <li className="flex gap-2">
                <span className="text-[#0D0D0D] dark:text-zinc-300 font-semibold flex-shrink-0">2.</span>
                Add <span className="font-medium text-[#0D0D0D] dark:text-zinc-200 mx-1">Sleep Analysis</span> or <span className="font-medium text-[#0D0D0D] dark:text-zinc-200 mx-1">Time Asleep</span> to your existing Daily Metrics export sheet.
              </li>
              <li className="flex gap-2">
                <span className="text-[#0D0D0D] dark:text-zinc-300 font-semibold flex-shrink-0">3.</span>
                Run a manual export in Health Auto Export to populate historical rows.
              </li>
              <li className="flex gap-2">
                <span className="text-[#0D0D0D] dark:text-zinc-300 font-semibold flex-shrink-0">4.</span>
                Click <span className="font-medium text-[#0D0D0D] dark:text-zinc-200 mx-1">Sync All</span> above to import the new sleep column.
              </li>
            </ol>
            <p className="text-xs text-[#888888] mt-3">
              Supported column names: Sleep Duration, Sleep, Total Sleep, Time Asleep, In Bed Duration, Asleep Duration.
              Values in hours (e.g. 7.5) or minutes (e.g. 450) are both handled automatically.
            </p>
          </div>

          {/* Strava */}
          <div className="border-t border-[#D9D9D9] dark:border-zinc-800 pt-6">
            <div className="flex items-center justify-between mb-1">
              <p className="text-base font-semibold text-[#0D0D0D] dark:text-zinc-50">Strava</p>
              <span className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.12em]">Coming soon</span>
            </div>
            <p className="text-sm text-[#888888]">
              Direct OAuth integration for real-time activity sync. Use Google Sheets in the meantime.
            </p>
          </div>

          {/* Manual */}
          <div className="border-t border-[#D9D9D9] dark:border-zinc-800 pt-6">
            <div className="flex items-center justify-between mb-1">
              <p className="text-base font-semibold text-[#0D0D0D] dark:text-zinc-50">Manual entry</p>
              <span className="text-[10px] font-bold text-[#16A34A] uppercase tracking-[0.12em]">Active</span>
            </div>
            <p className="text-sm text-[#888888]">
              Log weight, food, activities, and daily check-ins directly in the app.
            </p>
          </div>
        </div>
      </section>

      {/* ── Personal Context ──────────────────────────────────────────── */}
      <section className="border-b border-[#D9D9D9] dark:border-zinc-800 pb-8 mb-8">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-4">Personal context</p>
        <p className="text-sm text-[#888888] mb-4">
          Import DNA analysis, food intolerance context, bike fitting, and self-reported observations.
          Used to generate more relevant insights.
        </p>
        <Link href="/settings/context"
          className="text-sm font-semibold text-[#0D0D0D] dark:text-zinc-50 hover:text-[#E5173F] transition-colors">
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
