import { motion } from 'framer-motion'
import { useThemeContext } from '@/hooks/useTheme.tsx'

const iconVariants = {
  initial: { scale: 0.6, rotate: -90, opacity: 0 },
  animate: { scale: 1, rotate: 0, opacity: 1 },
  exit: { scale: 0.6, rotate: 90, opacity: 0 },
}

const transition = { duration: 0.15, ease: 'easeInOut' as const }

export function ThemeToggle() {
  const { theme, toggleTheme, effectiveTheme } = useThemeContext()

  const getIcon = () => {
    if (theme === 'system') {
      // Computer/monitor icon for system
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    }
    if (effectiveTheme === 'dark') {
      // Moon icon
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )
    }
    // Sun icon
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  }

  const getLabel = () => {
    if (theme === 'system') return 'System theme'
    if (theme === 'dark') return 'Dark mode'
    return 'Light mode'
  }

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={getLabel()}
      title={getLabel()}
    >
      <motion.div
        key={theme}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={iconVariants}
        transition={transition}
      >
        {getIcon()}
      </motion.div>
    </button>
  )
}
