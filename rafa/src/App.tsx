import { useState } from 'react'
import { loadAuth } from './lib/auth'
import type { Page, StoredAuth } from './types'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Commands from './pages/Commands'
import Location from './pages/Location'
import Maintenance from './pages/Maintenance'
import NavBar from './components/NavBar'

export default function App() {
  const [auth, setAuth] = useState<StoredAuth | null>(() => loadAuth())
  const [page, setPage] = useState<Page>('dashboard')

  if (!auth) return <Login onLogin={a => { setAuth(a); setPage('dashboard') }} />

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0d0d0d] overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <main className="flex-1 overflow-y-auto overscroll-contain">
        {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
        {page === 'commands' && <Commands />}
        {page === 'location' && <Location />}
        {page === 'maintenance' && <Maintenance />}
      </main>
      <NavBar page={page} onNavigate={setPage} onLogout={() => setAuth(null)} />
    </div>
  )
}
