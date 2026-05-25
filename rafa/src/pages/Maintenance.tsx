import { useEffect, useState } from 'react'
import { db } from '../lib/supabase'
import { loadAuth } from '../lib/auth'
import type { MaintenanceItem } from '../types'
import { Wrench, CheckCircle, AlertCircle, Clock } from 'lucide-react'

export default function Maintenance() {
  const [items, setItems] = useState<MaintenanceItem[]>([])
  const [loading, setLoading] = useState(true)
  const auth = loadAuth()

  useEffect(() => {
    if (!auth?.vehicleId) { setLoading(false); return }
    db.from('maintenance_items').select('*').eq('vehicle_id', auth.vehicleId).order('status')
      .then(({ data }) => { if (data) setItems(data as MaintenanceItem[]) })
      .finally(() => setLoading(false))
  }, [])

  const Icon = ({ status }: { status: string }) => {
    if (status === 'overdue') return <AlertCircle size={20} className="text-red-400 shrink-0" />
    if (status === 'upcoming') return <Clock size={20} className="text-yellow-400 shrink-0" />
    return <CheckCircle size={20} className="text-green-400 shrink-0" />
  }

  const badge = (status: string) => {
    if (status === 'overdue') return 'text-red-400 bg-red-950/50 border-red-800/60'
    if (status === 'upcoming') return 'text-yellow-400 bg-yellow-950/50 border-yellow-700/60'
    return 'text-green-400 bg-green-950/50 border-green-800/60'
  }

  const label = (status: string) => status === 'overdue' ? 'Atrasado' : status === 'upcoming' ? 'Próximo' : 'OK'

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-jeep border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <div>
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest">Jeep Connect</p>
        <h1 className="text-2xl font-bold mt-0.5">Manutenção</h1>
        <p className="text-gray-400 text-sm">{auth?.vehicleName ?? 'Commander'}</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Wrench size={40} className="text-gray-700 mb-4" />
          <p className="text-gray-500 text-sm">Nenhum item de manutenção</p>
          <p className="text-gray-700 text-xs mt-1">Faça um sync para buscar dados da FCA</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Icon status={item.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{item.name}</p>
                    {item.next_due_km && (
                      <p className="text-gray-500 text-xs mt-0.5">Próxima revisão: {item.next_due_km.toLocaleString('pt-BR')} km</p>
                    )}
                    {item.next_due_date && (
                      <p className="text-gray-500 text-xs">{new Date(item.next_due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    )}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge(item.status)}`}>{label(item.status)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
