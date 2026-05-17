import { useEffect, useState } from 'react'
import { db } from '../lib/supabase'
import type { VehicleStatus } from '../types'
import { MapPin, Navigation, RefreshCw } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

const vehicleIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:40px;height:40px;
    background:#cc0000;
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    border:3px solid white;
    box-shadow:0 3px 10px rgba(0,0,0,0.6);
  "></div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -44],
})

export default function Location() {
  const [status, setStatus] = useState<VehicleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    const { data: v } = await db.from('vehicles').select('id').limit(1).single()
    if (!v) return
    const { data: s } = await db.from('vehicle_status').select('*').eq('vehicle_id', v.id).single()
    if (s) setStatus(s as VehicleStatus)
  }

  useEffect(() => { load().finally(() => setLoading(false)) }, [])

  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const openMaps = () => {
    if (!status?.location_lat || !status?.location_lng) return
    const url = `https://maps.apple.com/?daddr=${status.location_lat},${status.location_lng}&dirflg=d`
    window.open(url, '_blank')
  }

  const lat = Number(status?.location_lat ?? -23.5505)
  const lng = Number(status?.location_lng ?? -46.6333)

  if (loading) return (
    <div className="flex items-center justify-center h-full bg-[#0d0d0d]">
      <div className="w-8 h-8 border-2 border-ram border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Map */}
      <div className="flex-1 min-h-0">
        <MapContainer
          center={[lat, lng]}
          zoom={16}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[lat, lng]} icon={vehicleIcon}>
            <Popup>
              <span style={{ color: '#111', fontWeight: 600 }}>Minha Ram</span>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* Info panel */}
      <div className="bg-[#1a1a1a] border-t border-[#2a2a2a] px-4 py-4 space-y-3 shrink-0"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-start gap-3">
          <MapPin size={18} className="text-ram mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm leading-snug">
              {status?.location_address ?? 'Localização desconhecida'}
            </p>
            {status?.updated_at && (
              <p className="text-gray-500 text-xs mt-0.5">
                Atualizado:{' '}
                {new Date(status.updated_at).toLocaleString('pt-BR', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}
          </div>
          <button
            onClick={refresh}
            className="p-2 rounded-lg bg-[#252525] active:scale-90 transition-transform shrink-0"
          >
            <RefreshCw size={14} className={`text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <button
          onClick={openMaps}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-ram text-white font-bold text-sm active:opacity-80 transition-opacity"
        >
          <Navigation size={16} />
          Como Chegar
        </button>
      </div>
    </div>
  )
}
