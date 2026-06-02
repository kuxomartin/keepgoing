import { TopNav } from '@/components/layout/top-nav'
import { MobileNav } from '@/components/layout/mobile-nav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#20252B]">
      <TopNav />
      {/* Desktop: pt-14 for fixed top nav. Mobile: pb-24 for bottom nav. */}
      <main data-main className="lg:pt-14 pb-28 lg:pb-0 min-h-screen">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
