import { Gauge, Zap, MapPin, Route, Wrench } from 'lucide-react'
import type { Page } from '../types'

const tabs: { id: Page; icon: React.ElementType; label: string }[] = [
  { id: 'dashboard', icon: Gauge, label: 'Status' },
  { id: 'commands', icon: Zap, label: 'Comandos' },
  { id: 'location', icon: MapPin, label: 'Local' },
  { id: 'trips', icon: Route, label: 'Viagens' },
  { id: 'maintenance', icon: Wrench, label: 'Manutenção' },
]

interface Props {
  active: Page
  onNavigate: (page: Page) => void
}

export default function BottomNav({ active, onNavigate }: Props) {
  return (
    <nav className="bottom-nav">
      <div className="flex">
        {tabs.map(({ id, icon: Icon, label }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors active:scale-95"
            >
              <Icon
                size={22}
                className={isActive ? 'text-ram' : 'text-gray-500'}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <span
                className={`text-[9px] font-medium leading-tight ${
                  isActive ? 'text-ram' : 'text-gray-600'
                }`}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
