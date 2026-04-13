import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { Calendar, Briefcase, BarChart3, FileText, Settings, LogOut } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import SchedulePage from './pages/SchedulePage'
import JobsPage from './pages/JobsPage'
import DashboardPage from './pages/DashboardPage'
import WipPage from './pages/WipPage'
import SettingsPage from './pages/SettingsPage'

const navItems = [
  { to: '/schedule', label: 'Schedule', icon: Calendar },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/wip', label: 'WIP', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function App() {
  const { user, loading, signOut, displayName } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">
            <span className="text-orange">Rooflie</span>{' '}
            <span className="text-navy">Frontline</span>
          </h1>
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav bar */}
      <header className="bg-navy text-white shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 flex items-center justify-between h-14">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-orange">Rooflie</span> Frontline
          </h1>
          <nav className="flex gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                <Icon size={18} />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/70 hidden sm:inline">{displayName}</span>
            <button
              onClick={signOut}
              className="flex items-center gap-1 text-white/60 hover:text-white text-sm transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-navy border-t border-navy-light z-50 flex justify-around py-1 safe-area-bottom">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1.5 text-xs font-medium transition-colors ${
                isActive ? 'text-orange' : 'text-white/60'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Page content */}
      <main className="flex-1 pb-16 sm:pb-0">
        <Routes>
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/wip" element={<WipPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/schedule" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
