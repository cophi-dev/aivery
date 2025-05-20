'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

interface ThemeSwitchProps {
  className?: string
}

export function ThemeSwitch({ className = '' }: ThemeSwitchProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Define toggleTheme before any conditional returns
  const toggleTheme = React.useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  // Effect to avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Render a placeholder if not mounted yet to avoid hydration issues
  if (!mounted) {
    return <div className={`h-8 w-8 ${className}`} />; // Placeholder to avoid layout shift
  }

  return (
    <button
      onClick={toggleTheme}
      className={`relative flex h-8 w-8 items-center justify-center rounded-full hover:opacity-80 transition-opacity overflow-hidden ${className}`}
      aria-label="Toggle theme"
    >
      <Sun
        className={`absolute h-5 w-5 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          theme === 'light' 
            ? 'scale-100 translate-y-0 opacity-100' 
            : 'scale-50 translate-y-5 opacity-0'
        }`}
      />
      <Moon
        className={`absolute h-5 w-5 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          theme === 'dark' 
            ? 'scale-100 translate-y-0 opacity-100' 
            : 'scale-50 translate-y-5 opacity-0'
        }`}
      />
    </button>
  )
} 