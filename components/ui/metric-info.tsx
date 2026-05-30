'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'
import { getMetric } from '@/lib/metrics-library'
import { cn } from '@/lib/utils'

interface MetricInfoProps {
  slug: string
  className?: string
}

export function MetricInfo({ slug, className }: MetricInfoProps) {
  const metric = getMetric(slug)
  if (!metric) return null

  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        aria-label={`Learn about ${metric.title}`}
        className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 ml-0.5 cursor-pointer"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full right-0 mb-2 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3.5"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {/* Arrow */}
          <div className="absolute top-full right-3 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-200" />
          <div className="absolute top-full right-[13px] w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-white -mt-px" />

          <p className="font-semibold text-sm text-gray-900">{metric.title}</p>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{metric.short_description}</p>
          {metric.units && (
            <p className="text-[11px] text-gray-400 mt-1.5">
              Unit: <span className="font-medium text-gray-500">{metric.units}</span>
            </p>
          )}
          <Link
            href={`/metrics/${metric.slug}`}
            className="inline-block mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            onClick={() => setOpen(false)}
          >
            Learn more →
          </Link>
        </div>
      )}
    </div>
  )
}
