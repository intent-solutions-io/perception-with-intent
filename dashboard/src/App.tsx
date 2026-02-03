import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from './firebase'
import Dashboard from './pages/Dashboard'
import Topics from './pages/Topics'
import DailyBriefs from './pages/DailyBriefs'
import Authors from './pages/Authors'
import About from './pages/About'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'

function Navigation() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const isLogin = location.pathname === '/login'

  // Don't show nav on home page or login page
  if (isHome || isLogin) return null

  const handleLogout = async () => {
    try {
      await signOut(auth)
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <nav className="border-b border-zinc-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-8">
            <Link to="/" className="text-2xl font-bold text-primary hover:text-zinc-900 transition-colors">
              Perception
            </Link>
            <div className="hidden md:flex space-x-6">
              <Link to="/dashboard" className="text-zinc-600 hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link to="/topics" className="text-zinc-600 hover:text-primary transition-colors">
                Topics
              </Link>
              <Link to="/briefs" className="text-zinc-600 hover:text-primary transition-colors">
                Daily Briefs
              </Link>
              <Link to="/authors" className="text-zinc-600 hover:text-primary transition-colors">
                Authors
              </Link>
            </div>
          </div>
          <div>
            <button
              onClick={handleLogout}
              className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-white">
        <Navigation />

        {/* Main Content */}
        <main>
          <Routes>
            <Route path="/" element={<About />} />
            <Route path="/login" element={<Login />} />
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
      </div>
    </Router>
  )
}

export default App
