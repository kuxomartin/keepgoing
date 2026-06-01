'use client'

import Link from 'next/link'

import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Activity, Utensils, Scale, Heart,
  Brain, Settings, LogOut, Flame, BookOpen, Moon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/today',      label: 'Today',      icon: LayoutDashboard },
  { href: '/recovery',   label: 'Recovery',   icon: Heart },
  { href: '/sleep',      label: 'Sleep',      icon: Moon },
  { href: '/activities', label: 'Activities', icon: Activity },
  { href: '/food',       label: 'Intake',     icon: Utensils },
  { href: '/nutrition',  label: 'Nutrition',  icon: Flame },
  { href: '/weight',     label: 'Weight',     icon: Scale },
  { href: '/coach',      label: 'Coach',      icon: Brain },
  { href: '/metrics',    label: 'Metrics',    icon: BookOpen },
  { href: '/settings',   label: 'Settings',   icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden lg:flex flex-col w-56 bg-white dark:bg-zinc-950 border-r border-[#D9D9D9] dark:border-zinc-800 min-h-screen fixed left-0 top-0 z-30">
      {/* Logo — navigates to /today */}
      <div className="border-b border-[#D9D9D9] dark:border-zinc-800">
        <Link href="/today" className="flex items-center gap-2.5 px-4 py-4 hover:opacity-80 transition-opacity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="KeepGoing" width={32} height={32} className="rounded-sm flex-shrink-0" />
          <span className="text-[11px] font-bold text-[#0D0D0D] dark:text-zinc-50 uppercase tracking-[0.1em]">KeepGoing</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-4 py-2 text-sm transition-colors relative',
                active
                  ? 'text-[#E5173F] font-semibold border-l-2 border-[#E5173F] pl-[14px]'
                  : 'font-medium text-[#888888] dark:text-zinc-400 hover:text-[#0D0D0D] dark:hover:text-zinc-100 border-l-2 border-transparent pl-[14px]',
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-3 border-t border-[#D9D9D9] dark:border-zinc-800">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-[#888888] dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-[#0D0D0D] dark:hover:text-zinc-300 transition-colors w-full"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
