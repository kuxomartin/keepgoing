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
  const closeTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  function cancelClose() {
    if (closeTimer.current != null) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  function scheduleClose() {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }

  // Cancel any pending close on unmount
  useEffect(() => () => { cancelClose() }, [])

  // Escape key closes
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Outside click closes (mobile tap-to-dismiss)
  useEffect(() => {
    if (!open) return
    function onPointer(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-flex items-center', className)}
      // Desktop hover: open on enter, schedule close on leave
      onMouseEnter={() => { cancelClose(); setOpen(true) }}
      onMouseLeave={scheduleClose}
    >
      {/* ⓘ trigger button */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        onFocus={() => { cancelClose(); setOpen(true) }}
        onBlur={scheduleClose}
        aria-label={`Learn about ${metric.title}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'inline-flex flex-shrink-0 ml-0.5 rounded transition-colors cursor-pointer',
          'text-gray-300 hover:text-gray-500 focus-visible:text-gray-600',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1',
        )}
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {/* Tooltip popover */}
      {open && (
        <div
          role="dialog"
          aria-label={metric.title}
          // Keep open while hovering tooltip itself; schedule close on leave
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className={cn(
            'absolute bottom-full right-0 z-50',
            'w-80 sm:w-96',
            'bg-white border border-gray-200 rounded-xl shadow-xl',
          )}
          style={{ maxWidth: 'min(24rem, calc(100vw - 1.5rem))' }}
        >
          {/*
            Invisible bridge fills the gap between tooltip bottom and the icon.
            Keeps onMouseEnter/onMouseLeave continuous when cursor crosses
            the mb-1 gap, so the tooltip never flickers during hover.
          */}
          <div className="absolute top-full left-0 right-0 h-3 pointer-events-auto" />

          {/* Arrow: outer border */}
          <div className="absolute top-full right-3.5 w-0 h-0
            border-l-[7px] border-r-[7px] border-t-[7px]
            border-l-transparent border-r-transparent border-t-gray-200" />
          {/* Arrow: inner fill */}
          <div className="absolute right-[15px] w-0 h-0
            border-l-[6px] border-r-[6px] border-t-[6px]
            border-l-transparent border-r-transparent border-t-white"
            style={{ top: 'calc(100% - 1px)' }}
          />

          <div className="p-4 space-y-2">
            <div>
              <p className="font-semibold text-sm text-gray-900 leading-tight">{metric.title}</p>
              {metric.units && (
                <p className="text-xs text-gray-400 mt-0.5 font-medium">{metric.units}</p>
              )}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{metric.short_description}</p>
            <Link
              href={`/metrics/${metric.slug}`}
              className="inline-flex items-center gap-0.5 pt-1 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              onClick={() => setOpen(false)}
            >
              Learn more →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
