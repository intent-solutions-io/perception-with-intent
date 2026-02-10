import { useEffect, useState, createContext, useContext, ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

const THEME_KEY = 'perception-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

function applyTheme(theme: Theme) {
  const root = window.document.documentElement
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme

  root.classList.remove('light', 'dark')
  root.classList.add(effectiveTheme)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [mounted, setMounted] = useState(false)

  // Compute the effective theme (resolved from system if needed)
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme

  useEffect(() => {
    setMounted(true)
    // Apply initial theme
    applyTheme(theme)

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(THEME_KEY, newTheme)
    applyTheme(newTheme)
  }

  const toggleTheme = () => {
    // Cycle through: light -> dark -> system -> light
    const nextTheme: Theme =
      theme === 'light' ? 'dark' :
      theme === 'dark' ? 'system' :
      'light'
    setTheme(nextTheme)
  }

  return {
    theme,
    effectiveTheme,
    setTheme,
    toggleTheme,
    mounted,
    isDark: effectiveTheme === 'dark',
    isLight: effectiveTheme === 'light',
  }
}

// Context for sharing theme across components
interface ThemeContextValue {
  theme: Theme
  effectiveTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  isDark: boolean
  isLight: boolean
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme
}

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme
    return getStoredTheme()
  })
  const [mounted, setMounted] = useState(false)

  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme
  const isDark = effectiveTheme === 'dark'
  const isLight = effectiveTheme === 'light'

  useEffect(() => {
    setMounted(true)
    applyTheme(theme)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(THEME_KEY, newTheme)
    applyTheme(newTheme)
  }

  const toggleTheme = () => {
    const nextTheme: Theme =
      theme === 'light' ? 'dark' :
      theme === 'dark' ? 'system' :
      'light'
    setTheme(nextTheme)
  }

  // Prevent flash of wrong theme
  if (!mounted) {
    return null
  }

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme, toggleTheme, isDark, isLight }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useThemeContext() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider')
  }
  return context
}
