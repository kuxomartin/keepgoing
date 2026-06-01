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

type Placement = {
  vertical:   'bottom-full' | 'top-full'
  horizontal: 'right-0'    | 'left-0'
}

export function MetricInfo({ slug, className }: MetricInfoProps) {
  const metric = getMetric(slug)
  if (!metric) return null

  const [open,      setOpen]      = useState(false)
  const [placement, setPlacement] = useState<Placement>({ vertical: 'bottom-full', horizontal: 'right-0' })
  const containerRef = useRef<HTMLDivElement>(null)
  const closeTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  function cancelClose() {
    if (closeTimer.current != null) { clearTimeout(closeTimer.current); closeTimer.current = null }
  }
  function scheduleClose() {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }

  /** Compute best tooltip placement so it never leaves the viewport. */
  function computePlacement() {
    if (!containerRef.current) return
    const rect      = containerRef.current.getBoundingClientRect()
    const tooltipW  = Math.min(384, window.innerWidth - 24) // 24rem or viewport−24px
    const tooltipH  = 220  // rough estimate

    // Prefer above; fall back to below
    const vertical: Placement['vertical']     = rect.top >= tooltipH + 8 ? 'bottom-full' : 'top-full'
    // Prefer left-aligned (right-0 = tooltip right-edge = button right-edge, extends LEFT)
    const horizontal: Placement['horizontal'] = rect.right >= tooltipW + 8 ? 'right-0' : 'left-0'

    setPlacement({ vertical, horizontal })
  }

  useEffect(() => () => { cancelClose() }, [])

  useEffect(() => {
    if (!open) return
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
  }, [open])

  function openTooltip() {
    computePlacement()
    cancelClose()
    setOpen(true)
  }

  // Arrow direction mirrors tooltip direction
  const arrowBelow = placement.vertical === 'bottom-full'  // tooltip above → arrow points down

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={openTooltip}
      onMouseLeave={scheduleClose}
    >
      {/* ⓘ trigger */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); open ? setOpen(false) : openTooltip() }}
        onFocus={openTooltip}
        onBlur={scheduleClose}
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

      {/* Tooltip — positioned to stay within viewport */}
      {open && (
        <div
          role="dialog"
          aria-label={metric.title}
          onMouseEnter={() => { cancelClose(); setOpen(true) }}
          onMouseLeave={scheduleClose}
          className={cn(
            'absolute z-[200]',
            // Vertical: above (bottom-full) or below (top-full)
            placement.vertical   === 'bottom-full' ? 'bottom-full mb-2' : 'top-full mt-2',
            // Horizontal: align right edge (extends left) or left edge (extends right)
            placement.horizontal === 'right-0'     ? 'right-0' : 'left-0',
            'bg-white border border-[#D9D9D9] shadow-xl',
          )}
          style={{ width: 'min(24rem, calc(100vw - 1.5rem))' }}
        >
          {/* Hover bridge — keeps tooltip open when cursor crosses the gap */}
          <div className={cn(
            'absolute left-0 right-0 h-3 pointer-events-auto',
            arrowBelow ? 'top-full' : 'bottom-full',
          )} />

          {/* Arrow — points toward the trigger button */}
          {arrowBelow ? (
            <>
              {/* Arrow for tooltip-above: points downward */}
              <div className={cn(
                'absolute top-full w-0 h-0',
                'border-l-[7px] border-r-[7px] border-t-[7px]',
                'border-l-transparent border-r-transparent border-t-[#D9D9D9]',
                placement.horizontal === 'right-0' ? 'right-3.5' : 'left-3.5',
              )} />
              <div className={cn(
                'absolute w-0 h-0',
                'border-l-[6px] border-r-[6px] border-t-[6px]',
                'border-l-transparent border-r-transparent border-t-white',
                placement.horizontal === 'right-0' ? 'right-[15px]' : 'left-[15px]',
              )} style={{ top: 'calc(100% - 1px)' }} />
            </>
          ) : (
            <>
              {/* Arrow for tooltip-below: points upward */}
              <div className={cn(
                'absolute bottom-full w-0 h-0',
                'border-l-[7px] border-r-[7px] border-b-[7px]',
                'border-l-transparent border-r-transparent border-b-[#D9D9D9]',
                placement.horizontal === 'right-0' ? 'right-3.5' : 'left-3.5',
              )} />
              <div className={cn(
                'absolute w-0 h-0',
                'border-l-[6px] border-r-[6px] border-b-[6px]',
                'border-l-transparent border-r-transparent border-b-white',
                placement.horizontal === 'right-0' ? 'right-[15px]' : 'left-[15px]',
              )} style={{ bottom: 'calc(100% - 1px)' }} />
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
  )
}
