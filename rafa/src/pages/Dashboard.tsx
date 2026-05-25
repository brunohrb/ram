import { useEffect, useState } from 'react'
import { db } from '../lib/supabase'
import supabase from '../lib/supabase'
import { loadAuth } from '../lib/auth'
import type { Vehicle, VehicleStatus, Page } from '../types'
import { Lock, Unlock, Power, RefreshCw, Gauge, WifiOff } from 'lucide-react'

function FuelGauge({ level }: { level: number }) {
  const r = 54, circ = 2 * Math.PI * r, arc = circ * 0.75
  const fill = arc * (level / 100)
  const color = level < 20 ? '#ef4444' : level < 40 ? '#f59e0b' : '#22c55e'
  return (
    <svg viewBox="0 0 140 130" className="w-48 h-44">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#252525" strokeWidth="10"
        strokeDasharray={`${arc} ${circ - arc}`} transform="rotate(135 70 70)" strokeLinecap="round" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${fill} ${circ - fill}`} transform="rotate(135 70 70)" strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s ease-out, stroke 0.5s' }} />
      <text x="18" y="120" fill="#4b5563" fontSize="11" fontWeight="600">E</text>
      <text x="112" y="120" fill="#4b5563" fontSize="11" fontWeight="600">F</text>
      <text x="70" y="64" textAnchor="middle" fill="white" fontSize="30" fontWeight="700">{level}%</text>
      <text x="70" y="83" textAnchor="middle" fill="#6b7280" fontSize="11">Combustível</text>
    </svg>
  )
}

function TirePressures({ fl, fr, rl, rr }: { fl: number; fr: number; rl: number; rr: number }) {
  const color = (v: number) => v < 28 ? 'text-red-400' : v < 32 ? 'text-yellow-400' : 'text-green-400'
  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-[#2a2a2a]">
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Pneus</p>
      <div className="grid grid-cols-2 gap-y-4">
        {([['Diant. Esq.', fl], ['Diant. Dir.', fr], ['Tras. Esq.', rl], ['Tras. Dir.', rr]] as [string, number][]).map(([label, val]) => (
          <div key={label}>
            <p className="text-gray-500 text-xs mb-0.5">{label}</p>
            <p className={`text-lg font-bold ${color(val)}`}>{val} <span className="text-xs font-normal text-gray-500">psi</span></p>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Props { onNavigate: (page: Page) => void }

export default function Dashboard({ onNavigate }: Props) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [status, setStatus] = useState<VehicleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [syncFailed, setSyncFailed] = useState(false)

  const loadFromDB = async () => {
    const auth = loadAuth()
    if (!auth?.vehicleId) return
    const { data: v } = await db.from('vehicles').select('*').eq('id', auth.vehicleId).single()
    if (v) setVehicle(v as Vehicle)
    const { data: s } = await db.from('vehicle_status').select('*').eq('vehicle_id', auth.vehicleId).single()
    if (s) setStatus(s as VehicleStatus)
  }

  useEffect(() => { loadFromDB().finally(() => setLoading(false)) }, [])

  const refresh = async () => {
    setRefreshing(true)
    setSyncFailed(false)
    const auth = loadAuth()
    try {
      const { data, error } = await supabase.functions.invoke('fca-sync', {
        body: { username: auth?.username, password: auth?.password, pin: auth?.pin, vin: auth?.vin, vehicleId: auth?.vehicleId },
      })
      if (error || data?.error) setSyncFailed(true)
    } catch { setSyncFailed(true) }
    await loadFromDB()
    setRefreshing(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-jeep border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!vehicle || !status) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">Veículo não encontrado</div>
  )

  const hasTires = status.tire_pressure_fl && status.tire_pressure_fr && status.tire_pressure_rl && status.tire_pressure_rr

  return (
    <div className="pb-2 space-y-4">
      {/* Hero */}
      <div className="relative bg-[#111111] flex items-center justify-center" style={{ minHeight: 180 }}>
        <div className="py-10 px-6 text-center">
          <p className="text-jeep text-xs font-semibold uppercase tracking-widest">Jeep Connect</p>
          <h1 className="text-white text-2xl font-bold mt-1">{vehicle.name}</h1>
          <p className="text-gray-500 text-sm">{vehicle.model} · {vehicle.year ?? ''}</p>
        </div>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(13,13,13,0.2) 0%, rgba(13,13,13,0) 40%, rgba(13,13,13,0.6) 90%, #0d0d0d 100%)' }} />
        <button onClick={refresh}
          className="absolute top-3 right-3 p-2.5 rounded-xl bg-black/40 backdrop-blur-sm active:scale-90 transition-transform">
          <RefreshCw size={15} className={`text-white ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-4 space-y-4">
        {syncFailed && (
          <div className="flex items-center gap-2 bg-yellow-950/50 border border-yellow-700/50 rounded-2xl px-3 py-2.5">
            <WifiOff size={14} className="text-yellow-500 shrink-0" />
            <p className="text-yellow-400 text-xs">Sem conexão com o veículo — exibindo último dado salvo</p>
          </div>
        )}

        <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] flex justify-center py-2">
          <FuelGauge level={status.fuel_level} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onNavigate('commands')}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-colors active:scale-95 ${status.doors_locked ? 'bg-green-950/50 border-green-800/60' : 'bg-yellow-950/50 border-yellow-700/60'}`}>
            {status.doors_locked
              ? <Lock size={20} className="text-green-400 shrink-0" />
              : <Unlock size={20} className="text-yellow-400 shrink-0" />}
            <div className="text-left min-w-0">
              <p className="text-gray-400 text-xs">Portas</p>
              <p className={`text-sm font-semibold truncate ${status.doors_locked ? 'text-green-400' : 'text-yellow-400'}`}>
                {status.doors_locked ? 'Travadas' : 'Abertas'}
              </p>
            </div>
          </button>

          <button onClick={() => onNavigate('commands')}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-colors active:scale-95 ${status.engine_running ? 'bg-red-950/50 border-red-800/60' : 'bg-[#1a1a1a] border-[#2a2a2a]'}`}>
            <Power size={20} className={`shrink-0 ${status.engine_running ? 'text-red-400' : 'text-gray-500'}`} />
            <div className="text-left min-w-0">
              <p className="text-gray-400 text-xs">Motor</p>
              <p className={`text-sm font-semibold truncate ${status.engine_running ? 'text-red-400' : 'text-gray-400'}`}>
                {status.engine_running ? 'Ligado' : 'Desligado'}
              </p>
            </div>
          </button>
        </div>

        {status.mileage > 0 && (
          <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] px-4 py-3 flex items-center gap-3">
            <Gauge size={20} className="text-gray-400 shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">Odômetro</p>
              <p className="text-white font-bold text-base">
                {status.mileage.toLocaleString('pt-BR')} <span className="text-gray-500 text-sm font-normal">km</span>
              </p>
            </div>
          </div>
        )}

        {hasTires && (
          <TirePressures fl={status.tire_pressure_fl} fr={status.tire_pressure_fr}
            rl={status.tire_pressure_rl} rr={status.tire_pressure_rr} />
        )}

        <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] px-4 py-3">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-1">Jeep Connect</p>
          <p className="text-white text-base font-bold leading-tight">{vehicle.name}</p>
          <p className="text-gray-400 text-sm">{vehicle.model}</p>
          {vehicle.plate && <p className="text-gray-500 text-xs font-mono mt-0.5">{vehicle.plate}</p>}
          <p className="text-gray-700 text-xs mt-2">
            Atualizado em {new Date(status.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  )
}
