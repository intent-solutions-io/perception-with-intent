import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from './firebase'
import { ThemeProvider } from '@/hooks/useTheme.tsx'
import { ThemeToggle } from '@/components/ThemeToggle'
import { MobileNav } from '@/components/MobileNav'
import { Toaster } from '@/components/ui/sonner'
import Articles from './pages/Articles'
import Dashboard from './pages/Dashboard'
import Topics from './pages/Topics'
import DailyBriefs from './pages/DailyBriefs'
import Authors from './pages/Authors'
import About from './pages/About'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'

interface NavLinkProps {
  to: string
  children: React.ReactNode
}

function NavLink({ to, children }: NavLinkProps) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Link
      to={to}
      className={`relative px-1 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
      {isActive && (
        <span className="absolute inset-x-0 -bottom-[1px] h-0.5 bg-foreground rounded-full" />
      )}
    </Link>
  )
}

function Navigation() {
  const location = useLocation()
  const isLogin = location.pathname === '/login'
  const isAbout = location.pathname === '/about'

  // Don't show nav on login or about (landing) page
  if (isLogin || isAbout) return null

  const handleLogout = async () => {
    try {
      await signOut(auth)
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo and Desktop Nav */}
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="text-xl font-semibold text-foreground hover:text-foreground/80 transition-colors"
            >
              Perception
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <NavLink to="/">Feed</NavLink>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/briefs">Briefs</NavLink>
              <NavLink to="/authors">Authors</NavLink>
            </div>
          </div>

          {/* Right side: Theme toggle, Sign out, Mobile nav */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="hidden md:inline-flex items-center justify-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-accent"
            >
              Sign Out
            </button>
            <MobileNav onLogout={handleLogout} />
          </div>
        </div>
      </div>
    </nav>
  )
}

function AppContent() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Main Content */}
      <main>
        <Routes>
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Articles />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/topics"
            element={
              <ProtectedRoute>
                <Topics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/briefs"
            element={
              <ProtectedRoute>
                <DailyBriefs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/authors"
            element={
              <ProtectedRoute>
                <Authors />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      {/* Toast notifications */}
      <Toaster position="bottom-right" />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  )
}

export default App
