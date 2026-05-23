import { useEffect, useState } from 'react'
import { db } from '../lib/supabase'
import type { Trip } from '../types'
import { Route, Clock, Fuel, ArrowRight } from 'lucide-react'

function formatDuration(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const diff = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  if (diff < 7) return `Há ${diff} dias`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function Trips() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: v } = await db.from('vehicles').select('id').limit(1).single()
      if (!v) return
      const { data } = await db
        .from('trips')
        .select('*')
        .eq('vehicle_id', v.id)
        .order('started_at', { ascending: false })
        .limit(20)
      setTrips((data ?? []) as Trip[])
    }
    load().finally(() => setLoading(false))
  }, [])

  const totalKm = trips.reduce((s, t) => s + Number(t.distance_km || 0), 0)
  const totalFuel = trips.reduce((s, t) => s + Number(t.fuel_used_liters || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-ram border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="px-4 pt-4 pb-2 space-y-4">
      <div>
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest">Ram Connect</p>
        <h1 className="text-2xl font-bold mt-0.5">Viagens</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: trips.length, label: 'viagens' },
          { value: totalKm.toFixed(0), label: 'km total' },
          { value: totalFuel.toFixed(1) + ' L', label: 'consumidos' },
        ].map(({ value, label }) => (
          <div key={label} className="bg-[#1a1a1a] rounded-2xl p-3 border border-[#2a2a2a] text-center">
            <p className="text-white text-lg font-bold leading-tight">{value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {trips.length === 0 ? (
        <div className="text-center text-gray-500 py-16 text-sm">
          Nenhuma viagem registrada ainda
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map(trip => (
            <div key={trip.id} className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-medium truncate">{trip.start_address || '—'}</span>
                <ArrowRight size={13} className="text-gray-500 shrink-0" />
                <span className="text-white text-sm font-medium truncate">{trip.end_address || '—'}</span>
                <span className="ml-auto text-gray-500 text-xs shrink-0">{formatDate(trip.started_at)}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-300">
                {trip.distance_km != null && (
                  <span className="flex items-center gap-1.5">
                    <Route size={13} className="text-gray-500" />
                    {Number(trip.distance_km).toFixed(1)} km
                  </span>
                )}
                {trip.duration_minutes != null && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} className="text-gray-500" />
                    {formatDuration(trip.duration_minutes)}
                  </span>
                )}
                {trip.fuel_used_liters != null && (
                  <span className="flex items-center gap-1.5">
                    <Fuel size={13} className="text-gray-500" />
                    {Number(trip.fuel_used_liters).toFixed(1)} L
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
