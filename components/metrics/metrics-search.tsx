'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { METRICS, CATEGORY_LABELS, CATEGORY_ORDER, type MetricCategory } from '@/lib/metrics-library'
import { cn } from '@/lib/utils'

const CATEGORY_COLORS: Record<MetricCategory, string> = {
  recovery: 'bg-rose-50 text-rose-700 border-rose-100',
  sleep:    'bg-indigo-50 text-indigo-700 border-indigo-100',
  nutrition:'bg-amber-50 text-amber-700 border-amber-100',
  body:     'bg-emerald-50 text-emerald-700 border-emerald-100',
  activity: 'bg-blue-50 text-blue-700 border-blue-100',
}

export function MetricsSearch() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return METRICS
    return METRICS.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.short_description.toLowerCase().includes(q) ||
      CATEGORY_LABELS[m.category].toLowerCase().includes(q)
    )
  }, [query])

  const byCategory = useMemo(() => {
    const grouped: Partial<Record<MetricCategory, typeof filtered>> = {}
    for (const m of filtered) {
      if (!grouped[m.category]) grouped[m.category] = []
      grouped[m.category]!.push(m)
    }
    return grouped
  }, [filtered])

  const hasResults = filtered.length > 0

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="search"
          placeholder="Search metrics…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {!hasResults && (
        <p className="text-sm text-gray-400 text-center py-8">
          No metrics found for &ldquo;{query}&rdquo;
        </p>
      )}

      {/* Grouped results */}
      {CATEGORY_ORDER.map(cat => {
        const items = byCategory[cat]
        if (!items?.length) return null
        return (
          <div key={cat}>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">
              {CATEGORY_LABELS[cat]}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map(m => (
                <Link
                  key={m.slug}
                  href={`/metrics/${m.slug}`}
                  className="group flex flex-col gap-1.5 bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-gray-900 group-hover:text-blue-700 transition-colors">
                      {m.title}
                    </span>
                    {m.units && (
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{m.units}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{m.short_description}</p>
                  <span className={cn(
                    'self-start text-[10px] font-medium px-1.5 py-0.5 rounded border mt-0.5',
                    CATEGORY_COLORS[m.category],
                  )}>
                    {CATEGORY_LABELS[m.category]}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
