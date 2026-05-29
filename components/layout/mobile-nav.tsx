'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Utensils, Flame, Coffee, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const mobileNavItems = [
  { href: '/today',      label: 'Today',    icon: LayoutDashboard },
  { href: '/food',       label: 'Food',     icon: Utensils },
  { href: '/coffee/add', label: 'Coffee',   icon: Coffee },
  { href: '/nutrition',  label: 'Nutrition',icon: Flame },
  { href: '/settings',   label: 'Settings', icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 pb-safe"
    >
      <div className="flex">
        {mobileNavItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors min-h-[56px] justify-center',
                active ? 'text-blue-600' : 'text-gray-400 active:text-gray-600'
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
