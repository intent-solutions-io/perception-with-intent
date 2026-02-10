import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface NavItem {
  to: string
  label: string
}

const navItems: NavItem[] = [
  { to: '/', label: 'Feed' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/briefs', label: 'Briefs' },
  { to: '/authors', label: 'Authors' },
]

interface MobileNavProps {
  onLogout: () => void
}

export function MobileNav({ onLogout }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()

  const toggleMenu = () => setIsOpen(!isOpen)
  const closeMenu = () => setIsOpen(false)

  return (
    <div className="md:hidden">
      {/* Hamburger Button */}
      <button
        onClick={toggleMenu}
        className="relative p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
      >
        <div className="w-5 h-5 flex flex-col justify-center items-center">
          <motion.span
            className="block h-0.5 w-5 bg-current rounded-full"
            animate={{
              rotate: isOpen ? 45 : 0,
              y: isOpen ? 2 : -3,
            }}
            transition={{ duration: 0.15 }}
          />
          <motion.span
            className="block h-0.5 w-5 bg-current rounded-full"
            animate={{
              opacity: isOpen ? 0 : 1,
              scaleX: isOpen ? 0 : 1,
            }}
            transition={{ duration: 0.15 }}
          />
          <motion.span
            className="block h-0.5 w-5 bg-current rounded-full"
            animate={{
              rotate: isOpen ? -45 : 0,
              y: isOpen ? -2 : 3,
            }}
            transition={{ duration: 0.15 }}
          />
        </div>
      </button>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 top-16 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40"
              onClick={closeMenu}
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute top-16 left-0 right-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-lg z-50"
            >
              <nav className="max-w-7xl mx-auto px-4 py-4">
                <ul className="space-y-1">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.to
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          onClick={closeMenu}
                          className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                            isActive
                              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                  <li className="pt-2 border-t border-zinc-200 dark:border-zinc-700 mt-2">
                    <button
                      onClick={() => {
                        closeMenu()
                        onLogout()
                      }}
                      className="block w-full text-left px-4 py-3 rounded-lg text-base font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      Sign Out
                    </button>
                  </li>
                </ul>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
