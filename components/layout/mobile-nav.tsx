'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Utensils, Flame, Heart, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const mobileNavItems = [
  { href: '/today',     label: 'Today',     icon: LayoutDashboard },
  { href: '/recovery',  label: 'Recovery',  icon: Heart },
  { href: '/food',      label: 'Intake',    icon: Utensils },
  { href: '/nutrition', label: 'Nutrition', icon: Flame },
  { href: '/settings',  label: 'Settings',  icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-950 border-t border-gray-200 dark:border-zinc-800 z-30 pb-safe">
      <div className="flex">
        {mobileNavItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors min-h-[56px] justify-center',
                active
                  ? 'text-gray-900 dark:text-zinc-50'
                  : 'text-gray-400 dark:text-zinc-600 active:text-gray-600 dark:active:text-zinc-400',
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="leading-none">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
