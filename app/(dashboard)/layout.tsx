import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Sidebar />
      <main className="lg:pl-56 pb-24 lg:pb-0 min-h-screen">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
