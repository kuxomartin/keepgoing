import { TopNav } from '@/components/layout/top-nav'
import { MobileNav } from '@/components/layout/mobile-nav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <TopNav />
      {/* Desktop: pt-16 for fixed top nav. Mobile: pb-24 for bottom nav. */}
      <main className="lg:pt-16 pb-24 lg:pb-0 min-h-screen">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
