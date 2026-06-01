'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/today',      label: 'Today' },
  { href: '/recovery',   label: 'Recovery' },
  { href: '/sleep',      label: 'Sleep' },
  { href: '/activities', label: 'Activities' },
  { href: '/food',       label: 'Intake' },
  { href: '/nutrition',  label: 'Nutrition' },
  { href: '/weight',     label: 'Weight' },
  { href: '/coach',      label: 'Coach' },
  { href: '/metrics',    label: 'Metrics' },
  { href: '/settings',   label: 'Settings' },
]

export function TopNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="hidden lg:flex fixed top-0 left-0 right-0 h-16 z-30 bg-white dark:bg-zinc-950 border-b border-[#D9D9D9] dark:border-zinc-800 items-center px-6">
      {/* Logo */}
      <Link
        href="/today"
        className="flex items-center gap-2.5 flex-shrink-0 mr-6 hover:opacity-75 transition-opacity"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="KeepGoing" width={28} height={28} className="rounded-sm" />
        <span className="text-[11px] font-bold text-[#0D0D0D] dark:text-zinc-50 uppercase tracking-[0.1em]">
          KeepGoing
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex items-center flex-1 overflow-hidden">
        {navItems.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'px-2.5 h-16 flex items-center text-[13px] font-medium transition-colors whitespace-nowrap border-b-2 -mb-px',
                active
                  ? 'text-[#E5173F] border-[#E5173F]'
                  : 'text-[#888888] dark:text-zinc-500 border-transparent hover:text-[#0D0D0D] dark:hover:text-zinc-200',
              )}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="flex-shrink-0 ml-4 text-[12px] font-medium text-[#888888] hover:text-[#0D0D0D] dark:hover:text-zinc-200 transition-colors"
      >
        Sign out
      </button>
    </header>
  )
}
