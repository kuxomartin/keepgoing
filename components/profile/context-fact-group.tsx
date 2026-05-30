import { ContextFactRow } from './context-fact-row'
import type { PersonalContextFact } from '@/lib/profile/types'

interface Props {
  label: string
  facts: PersonalContextFact[]
}

export function ContextFactGroup({ label, facts }: Props) {
  const active   = facts.filter(f => f.is_active).length
  const inactive = facts.length - active

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
        <span className="text-xs text-gray-400">
          {active} active{inactive > 0 ? ` · ${inactive} off` : ''}
        </span>
      </div>
      <div>
        {facts.map(fact => (
          <ContextFactRow key={fact.id} fact={fact} />
        ))}
      </div>
    </div>
  )
}
