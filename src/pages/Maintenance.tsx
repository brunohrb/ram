import { useEffect, useState } from 'react'
import { db } from '../lib/supabase'
import type { MaintenanceItem } from '../types'
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react'

const STATUS_CONFIG = {
  ok: {
    icon: CheckCircle2,
    color: 'text-green-400',
    border: 'border-green-800/40',
    bg: 'bg-green-950/30',
    label: 'Em dia',
  },
  upcoming: {
    icon: AlertCircle,
    color: 'text-yellow-400',
    border: 'border-yellow-700/40',
    bg: 'bg-yellow-950/30',
    label: 'Em breve',
  },
  overdue: {
    icon: XCircle,
    color: 'text-red-400',
    border: 'border-red-800/40',
    bg: 'bg-red-950/30',
    label: 'Atrasado',
  },
}

export default function Maintenance() {
  const [items, setItems] = useState<MaintenanceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: v } = await db.from('vehicles').select('id').limit(1).single()
      if (!v) return
      const { data } = await db
        .from('maintenance_items')
        .select('*')
        .eq('vehicle_id', v.id)
        .order('created_at', { ascending: true })
      setItems((data ?? []) as MaintenanceItem[])
    }
    load().finally(() => setLoading(false))
  }, [])

  const counts = {
    ok: items.filter(i => i.status === 'ok').length,
    upcoming: items.filter(i => i.status === 'upcoming').length,
    overdue: items.filter(i => i.status === 'overdue').length,
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-ram border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="px-4 pt-4 pb-2 space-y-4">
      <div>
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest">Ram Connect</p>
        <h1 className="text-2xl font-bold mt-0.5">Manutenção</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {(['ok', 'upcoming', 'overdue'] as const).map(s => {
          const { icon: Icon, color, label } = STATUS_CONFIG[s]
          return (
            <div key={s} className="bg-[#1a1a1a] rounded-2xl p-3 border border-[#2a2a2a] text-center">
              <Icon size={18} className={`${color} mx-auto mb-1`} />
              <p className="text-white text-lg font-bold leading-tight">{counts[s]}</p>
              <p className="text-gray-500 text-xs mt-0.5">{label}</p>
            </div>
          )
        })}
      </div>

      {/* Items sorted: overdue → upcoming → ok */}
      <div className="space-y-3">
        {[...items]
          .sort(a => (a.status === 'overdue' ? -1 : a.status === 'upcoming' ? 0 : 1))
          .map(item => {
            const { icon: Icon, color, border, bg } = STATUS_CONFIG[item.status]
            return (
              <div key={item.id} className={`rounded-2xl border p-4 ${bg} ${border}`}>
                <div className="flex items-start gap-3">
                  <Icon size={20} className={`${color} mt-0.5 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white font-semibold text-sm truncate">{item.name}</p>
                      <span className={`text-xs font-bold shrink-0 ${color}`}>
                        {STATUS_CONFIG[item.status].label.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {item.next_due_km != null && (
                        <p className="text-gray-400 text-xs">
                          Próx. troca: {Number(item.next_due_km).toLocaleString('pt-BR')} km
                        </p>
                      )}
                      {item.next_due_date && (
                        <p className="text-gray-400 text-xs">
                          Prazo:{' '}
                          {new Date(item.next_due_date).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      )}
                      {item.last_done_km != null && (
                        <p className="text-gray-600 text-xs">
                          Última: {Number(item.last_done_km).toLocaleString('pt-BR')} km
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
