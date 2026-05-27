'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Activity, Utensils, Heart, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

const mobileNavItems = [
  { href: '/today', label: 'Today', icon: LayoutDashboard },
  { href: '/activities', label: 'Activities', icon: Activity },
  { href: '/food', label: 'Food', icon: Utensils },
  { href: '/recovery', label: 'Recovery', icon: Heart },
  { href: '/coach', label: 'Coach', icon: Brain },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-area-pb">
      <div className="flex">
        {mobileNavItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors',
                active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
