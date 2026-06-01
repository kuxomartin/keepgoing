'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Utensils, Heart, Moon, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const mobileNavItems = [
  { href: '/today',    label: 'Today',    icon: LayoutDashboard },
  { href: '/recovery', label: 'Recovery', icon: Heart },
  { href: '/sleep',    label: 'Sleep',    icon: Moon },
  { href: '/food',     label: 'Intake',   icon: Utensils },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-950 border-t border-[#D9D9D9] dark:border-zinc-800 z-30 pb-safe">
      <div className="flex">
        {mobileNavItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors min-h-[56px] justify-center relative',
                active
                  ? 'text-[#E5173F]'
                  : 'text-[#888888] dark:text-zinc-500',
              )}
            >
              {/* Active indicator dot */}
              {active && (
                <span
                  className="absolute top-1.5 w-1 h-1 rounded-full bg-[#E5173F]"
                  aria-hidden
                />
              )}
              <Icon className="h-5 w-5" />
              <span className="leading-none">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
