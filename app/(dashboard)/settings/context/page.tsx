export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { ContextImportForm } from '@/components/profile/context-import-form'
import { ContextFactGroup } from '@/components/profile/context-fact-group'
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@/lib/profile/types'
import type { PersonalContextFact, ContextCategory } from '@/lib/profile/types'

export default async function ContextPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('personal_context_facts')
    .select('*')
    .order('category', { ascending: true })
    .order('key',      { ascending: true })

  const facts = (data ?? []) as PersonalContextFact[]

  // Group by category
  const grouped: Partial<Record<ContextCategory, PersonalContextFact[]>> = {}
  for (const f of facts) {
    if (!grouped[f.category]) grouped[f.category] = []
    grouped[f.category]!.push(f)
  }

  const activeCats = CATEGORY_ORDER.filter(c => (grouped[c]?.length ?? 0) > 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Personal Context</h1>
        <p className="mt-1 text-sm text-gray-500 max-w-prose">
          Long-term profile data imported from DNA analysis, lab tests, bike fitting, and
          self-reported observations. Used to generate more relevant insights and recommendations.
          All findings are informational only — not medical advice.
        </p>
      </div>

      {/* Import */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Import JSON files</h2>
        <ContextImportForm />
      </section>

      {/* Fact groups */}
      {facts.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Imported context</h2>
            <span className="text-xs text-gray-400">{facts.length} facts total</span>
          </div>

          {activeCats.map(cat => (
            <ContextFactGroup
              key={cat}
              label={CATEGORY_LABELS[cat]}
              facts={grouped[cat]!}
            />
          ))}
        </section>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center">
          <p className="text-sm text-gray-400">No personal context imported yet.</p>
          <p className="text-xs text-gray-300 mt-1">
            Upload your JSON files above to enable personalised insights.
          </p>
        </div>
      )}
    </div>
  )
}
