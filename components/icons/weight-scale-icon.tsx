/** Custom bathroom scale icon — rounded rectangle body, dial arc, needle. */
export function WeightScaleIcon({
  className,
  strokeWidth = 1.5,
}: {
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Platform — rounded rectangle body */}
      <rect x="2" y="11" width="20" height="10" rx="2.5" />
      {/* Dial arc at top */}
      <path d="M7 11 A5 5 0 0 1 17 11" />
      {/* Needle pointing toward upper-right */}
      <line x1="12" y1="11" x2="15.5" y2="7" />
      {/* Pivot dot */}
      <circle cx="12" cy="11" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}
