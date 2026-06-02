import { cn } from '@/lib/utils'
import type { ActivityProposal } from '@/lib/insights/activity-proposal'

interface Props {
  proposal: ActivityProposal
}

export function ActivityProposalCard({ proposal }: Props) {
  return (
    <div className="flex flex-col gap-8">

      {/* Section header */}
      <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.18em]">
        Today&apos;s Activity
      </p>

      {proposal.showMinimumOnly ? (
        /* Recover day — show only floor */
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em]">
            Rest Day
          </p>
          <p className="text-base text-white/50 leading-snug">
            No training today. Full rest is the right call.
          </p>

          {/* Why */}
          <div className="space-y-1 mt-1">
            {proposal.why.map((line, i) => (
              <p key={i} className="text-sm text-white/35 leading-snug">{line}</p>
            ))}
          </div>

          {/* Minimum floor */}
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-2">
              If anything
            </p>
            <p className="text-sm font-semibold text-white/55">{proposal.minimum}</p>
          </div>
        </div>

      ) : (
        /* Active day — Optimal + Minimum */
        <div className="flex flex-col gap-6">

          {/* Optimal */}
          <div>
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-3">
              Optimal
            </p>
            <p
              className="font-display font-bold text-white leading-tight"
              style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', letterSpacing: '-0.02em' }}
            >
              {proposal.optimal}
            </p>
          </div>

          {/* Why */}
          <div className="space-y-1">
            {proposal.why.map((line, i) => (
              <p key={i} className={cn('text-sm leading-snug', i === 0 ? 'text-white/50' : 'text-white/35')}>
                {line}
              </p>
            ))}
          </div>

          {/* Minimum */}
          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.12em] mb-2">
              Minimum
            </p>
            <p className="text-sm font-semibold text-white/55">{proposal.minimum}</p>
          </div>
        </div>
      )}
    </div>
  )
}
