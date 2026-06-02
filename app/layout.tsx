import type { Metadata } from 'next'
import { Geist, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/theme-provider'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'KeepGoing — Personal Coach',
  description: 'Your personal training, nutrition, and recovery dashboard',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon.png',    sizes: '192x192', type: 'image/png' },
    ],
    apple: { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
  },
}

// Prevent flash of unstyled theme on first paint
const themeScript = `
  try {
    var t = localStorage.getItem('kg-theme');
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch(e) {}
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="min-h-full font-sans antialiased bg-[#20252B] text-[#E7EDF2] transition-colors duration-200">
        {/* Runs before React hydrates — prevents flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeProvider>
          {children}
        </ThemeProvider>

      </body>
    </html>
  )
}
