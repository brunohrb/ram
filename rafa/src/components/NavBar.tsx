import { LayoutDashboard, Radio, MapPin, Wrench, LogOut } from 'lucide-react'
import { clearAuth } from '../lib/auth'
import type { Page } from '../types'

interface Props {
  page: Page
  onNavigate: (page: Page) => void
  onLogout: () => void
}

const tabs: { id: Page; icon: React.ReactNode; label: string }[] = [
  { id: 'dashboard', icon: <LayoutDashboard size={22} />, label: 'Início' },
  { id: 'commands', icon: <Radio size={22} />, label: 'Comandos' },
  { id: 'location', icon: <MapPin size={22} />, label: 'Local' },
  { id: 'maintenance', icon: <Wrench size={22} />, label: 'Revisão' },
]

export default function NavBar({ page, onNavigate, onLogout }: Props) {
  const handleLogout = () => {
    clearAuth()
    onLogout()
  }

  return (
    <nav className="bg-[#111111] border-t border-[#1e1e1e] flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onNavigate(tab.id)}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${page === tab.id ? 'text-jeep' : 'text-gray-600'}`}>
          {tab.icon}
          <span className="text-[10px] font-medium">{tab.label}</span>
        </button>
      ))}
      <button onClick={handleLogout}
        className="flex flex-col items-center justify-center py-2.5 gap-0.5 text-gray-700 px-3 transition-colors active:text-red-400">
        <LogOut size={22} />
        <span className="text-[10px] font-medium">Sair</span>
      </button>
    </nav>
  )
}
