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
  { href: '/weight',     label: 'Weight' },
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
    <header className="hidden lg:flex fixed top-0 left-0 right-0 h-14 z-30 bg-[#1B2128] border-b border-white/[0.08] items-center px-6">
      {/* Logo */}
      <Link
        href="/today"
        className="flex items-center gap-2.5 flex-shrink-0 mr-6 hover:opacity-70 transition-opacity"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="KeepGoing" width={26} height={26} className="rounded-sm" />
        <span className="text-[11px] font-bold text-white uppercase tracking-[0.1em]">
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
                'px-3 h-14 flex items-center text-[13px] font-medium transition-colors whitespace-nowrap border-b-2 -mb-px',
                active
                  ? 'text-[#E5173F] border-[#E5173F]'
                  : 'text-white/35 border-transparent hover:text-white/70',
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
        className="flex-shrink-0 ml-4 text-[12px] font-medium text-white/25 hover:text-white/60 transition-colors"
      >
        Sign out
      </button>
    </header>
  )
}
