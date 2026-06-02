'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Info, X } from 'lucide-react'
import { getMetric } from '@/lib/metrics-library'
import { cn } from '@/lib/utils'

interface MetricInfoProps {
  slug: string
  className?: string
}

type Placement = {
  vertical:   'bottom-full' | 'top-full'
  horizontal: 'right-0'    | 'left-0'
}

export function MetricInfo({ slug, className }: MetricInfoProps) {
  const metric = getMetric(slug)
  if (!metric) return null

  const [open,      setOpen]      = useState(false)
  const [isMobile,  setIsMobile]  = useState(false)
  const [placement, setPlacement] = useState<Placement>({ vertical: 'bottom-full', horizontal: 'right-0' })
  const containerRef = useRef<HTMLDivElement>(null)
  const closeTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detect mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function cancelClose() {
    if (closeTimer.current != null) { clearTimeout(closeTimer.current); closeTimer.current = null }
  }
  function scheduleClose() {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }

  function computePlacement() {
    if (!containerRef.current) return
    const rect     = containerRef.current.getBoundingClientRect()
    const tooltipW = Math.min(384, window.innerWidth - 24)
    const tooltipH = 220

    const vertical: Placement['vertical']     = rect.top >= tooltipH + 8 ? 'bottom-full' : 'top-full'
    const horizontal: Placement['horizontal'] = rect.right >= tooltipW + 8 ? 'right-0' : 'left-0'
    setPlacement({ vertical, horizontal })
  }

  useEffect(() => () => { cancelClose() }, [])

  // Close on outside interaction (desktop only — mobile uses backdrop)
  useEffect(() => {
    if (!open || isMobile) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    function onPointer(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown',   onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown',   onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open, isMobile])

  // Prevent body scroll when mobile sheet is open
  useEffect(() => {
    if (isMobile && open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isMobile, open])

  function openTooltip() {
    if (!isMobile) computePlacement()
    cancelClose()
    setOpen(true)
  }

  const arrowBelow = placement.vertical === 'bottom-full'

  return (
    <>
      <div
        ref={containerRef}
        className={cn('relative inline-flex items-center', className)}
        onMouseEnter={() => { if (!isMobile) openTooltip() }}
        onMouseLeave={() => { if (!isMobile) scheduleClose() }}
      >
        {/* ⓘ trigger */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); open ? setOpen(false) : openTooltip() }}
          onFocus={() => { if (!isMobile) openTooltip() }}
          onBlur={() => { if (!isMobile) scheduleClose() }}
          aria-label={`Learn about ${metric.title}`}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            'inline-flex flex-shrink-0 ml-0.5 rounded transition-colors cursor-pointer',
            'text-gray-300 hover:text-gray-500 focus-visible:text-gray-600',
            'focus:outline-none',
          )}
        >
          <Info className="h-3.5 w-3.5" />
        </button>

        {/* ── Desktop floating tooltip ── */}
        {!isMobile && open && (
          <div
            role="dialog"
            aria-label={metric.title}
            onMouseEnter={() => { cancelClose(); setOpen(true) }}
            onMouseLeave={scheduleClose}
            className={cn(
              'absolute z-[200]',
              placement.vertical   === 'bottom-full' ? 'bottom-full mb-2' : 'top-full mt-2',
              placement.horizontal === 'right-0'     ? 'right-0' : 'left-0',
              'bg-white border border-[#D9D9D9] shadow-xl',
            )}
            style={{ width: 'min(24rem, calc(100vw - 3rem))', maxWidth: 'calc(100vw - 3rem)' }}
          >
            {/* Hover bridge */}
            <div className={cn(
              'absolute left-0 right-0 h-3 pointer-events-auto',
              arrowBelow ? 'top-full' : 'bottom-full',
            )} />

            {/* Arrow */}
            {arrowBelow ? (
              <>
                <div className={cn('absolute top-full w-0 h-0 border-l-[7px] border-r-[7px] border-t-[7px] border-l-transparent border-r-transparent border-t-[#D9D9D9]', placement.horizontal === 'right-0' ? 'right-3.5' : 'left-3.5')} />
                <div className={cn('absolute w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-white', placement.horizontal === 'right-0' ? 'right-[15px]' : 'left-[15px]')} style={{ top: 'calc(100% - 1px)' }} />
              </>
            ) : (
              <>
                <div className={cn('absolute bottom-full w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-l-transparent border-r-transparent border-b-[#D9D9D9]', placement.horizontal === 'right-0' ? 'right-3.5' : 'left-3.5')} />
                <div className={cn('absolute w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent border-b-white', placement.horizontal === 'right-0' ? 'right-[15px]' : 'left-[15px]')} style={{ bottom: 'calc(100% - 1px)' }} />
              </>
            )}

            <div className="p-4 space-y-2">
              <div>
                <p className="font-semibold text-sm text-[#0D0D0D] leading-tight">{metric.title}</p>
                {metric.units && <p className="text-xs text-[#888888] mt-0.5">{metric.units}</p>}
              </div>
              <p className="text-sm text-[#888888] leading-relaxed">{metric.short_description}</p>
              <Link
                href={`/metrics/${metric.slug}`}
                className="inline-flex items-center gap-0.5 pt-1 text-sm font-semibold text-[#0D0D0D] hover:text-[#E5173F] transition-colors"
                onClick={() => setOpen(false)}
              >
                Learn more →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile bottom sheet + backdrop (rendered in document root via portal-like fixed positioning) ── */}
      {isMobile && open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[350] bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Sheet */}
          <div
            role="dialog"
            aria-label={metric.title}
            className="fixed bottom-0 left-0 right-0 z-[400] bg-[#272D35] border-t border-white/[0.1] rounded-t-2xl"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/[0.15]" />
            </div>

            <div className="px-6 pt-2 pb-2">
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base text-white leading-tight">{metric.title}</p>
                  {metric.units && (
                    <p className="text-xs text-white/40 mt-0.5">{metric.units}</p>
                  )}
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="flex-shrink-0 text-white/40 hover:text-white/70 transition-colors p-1 -mr-1"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Description */}
              <p className="text-sm text-white/55 leading-relaxed mb-4">
                {metric.short_description}
              </p>

              {/* Learn more */}
              <Link
                href={`/metrics/${metric.slug}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#E5173F] hover:text-[#FF3355] transition-colors"
                onClick={() => setOpen(false)}
              >
                Learn more →
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  )
}
