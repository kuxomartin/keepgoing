'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Heart, Moon, Activity, Utensils, Settings } from 'lucide-react'
import { WeightScaleIcon } from '@/components/icons/weight-scale-icon'
import { cn } from '@/lib/utils'

const mobileNavItems = [
  { href: '/today',      label: 'Today',      icon: LayoutDashboard, custom: false },
  { href: '/recovery',   label: 'Recovery',   icon: Heart,           custom: false },
  { href: '/sleep',      label: 'Sleep',      icon: Moon,            custom: false },
  { href: '/activities', label: 'Activities', icon: Activity,        custom: false },
  { href: '/food',       label: 'Intake',     icon: Utensils,        custom: false },
  { href: '/weight',     label: 'Weight',     icon: null,            custom: true  },
  { href: '/settings',   label: 'Settings',   icon: Settings,        custom: false },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#1B2128] border-t border-[#222222] z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-16">
        {mobileNavItems.map(({ href, label, icon: Icon, custom }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const iconCls = cn('flex-shrink-0', active ? 'h-[18px] w-[18px]' : 'h-5 w-5')

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0 transition-colors',
                active ? 'text-[#E5173F]' : 'text-[#666666] hover:text-[#888888]',
              )}
            >
              {custom ? (
                <WeightScaleIcon
                  className={iconCls}
                  strokeWidth={active ? 2.2 : 1.5}
                />
              ) : Icon ? (
                <Icon
                  className={iconCls}
                  strokeWidth={active ? 2.2 : 1.5}
                />
              ) : null}
              {active && (
                <span className="text-[9px] font-bold uppercase tracking-[0.06em] leading-none">
                  {label}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
