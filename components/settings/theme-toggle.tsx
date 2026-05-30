'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/providers/theme-provider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
          {isDark ? 'Dark mode' : 'Light mode'}
        </p>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
          {isDark ? 'Switch to light for daytime use' : 'Switch to dark for a more focused look'}
        </p>
      </div>
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-sm font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {isDark ? 'Light' : 'Dark'}
      </button>
    </div>
  )
}
