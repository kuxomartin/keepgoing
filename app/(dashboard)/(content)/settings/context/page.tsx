export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
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

  const grouped: Partial<Record<ContextCategory, PersonalContextFact[]>> = {}
  for (const f of facts) {
    if (!grouped[f.category]) grouped[f.category] = []
    grouped[f.category]!.push(f)
  }

  const activeCats = CATEGORY_ORDER.filter(c => (grouped[c]?.length ?? 0) > 0)

  return (
    <div>

      <Link href="/settings"
        className="text-sm text-[#888888] hover:text-[#0D0D0D] dark:hover:text-zinc-100 transition-colors inline-block mb-8">
        ← Settings
      </Link>

      <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-4">Personal Context</p>

      <p className="text-base text-[#888888] leading-relaxed max-w-xl mb-8">
        Long-term profile data from DNA analysis, lab tests, bike fitting, and self-reported observations.
        Used to generate more relevant insights. Informational only — not medical advice.
      </p>

      {/* Import */}
      <div className="border-t border-[#D9D9D9] dark:border-zinc-800 pt-6 mb-8">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em] mb-4">Import JSON files</p>
        <ContextImportForm />
      </div>

      {/* Fact groups */}
      {facts.length > 0 ? (
        <div className="space-y-0">
          <div className="flex items-center justify-between border-b border-[#D9D9D9] dark:border-zinc-800 pb-4 mb-6">
            <p className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.15em]">Imported context</p>
            <span className="text-xs text-[#888888]">{facts.length} facts</span>
          </div>

          <div className="space-y-6">
            {activeCats.map(cat => (
              <ContextFactGroup
                key={cat}
                label={CATEGORY_LABELS[cat]}
                facts={grouped[cat]!}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-[#EDEDEB] dark:bg-zinc-900 px-6 py-10 text-center">
          <p className="text-sm text-[#888888]">No personal context imported yet.</p>
          <p className="text-xs text-[#888888]/60 mt-1">Upload your JSON files above to enable personalised insights.</p>
        </div>
      )}
    </div>
  )
}
