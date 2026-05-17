import { useState, useEffect } from 'react'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import Commands from './pages/Commands'
import Location from './pages/Location'
import Trips from './pages/Trips'
import Maintenance from './pages/Maintenance'
import type { Page } from './types'

const PAGES: Page[] = ['commands', 'location', 'trips', 'maintenance']

function getPage(): Page {
  const hash = window.location.hash.replace('#/', '').replace('#', '')
  return PAGES.includes(hash as Page) ? (hash as Page) : 'dashboard'
}

export default function App() {
  const [page, setPage] = useState<Page>(getPage)

  const navigate = (p: Page) => {
    setPage(p)
    window.location.hash = p === 'dashboard' ? '/' : `/${p}`
  }

  useEffect(() => {
    const handler = () => setPage(getPage())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  return (
    <div className="app-shell">
      {page === 'location' ? (
        <div className="page-map">
          <Location />
        </div>
      ) : (
        <div className="page-content">
          {page === 'dashboard' && <Dashboard onNavigate={navigate} />}
          {page === 'commands' && <Commands />}
          {page === 'trips' && <Trips />}
          {page === 'maintenance' && <Maintenance />}
        </div>
      )}
      <BottomNav active={page} onNavigate={navigate} />
    </div>
  )
}
