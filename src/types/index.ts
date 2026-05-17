export type Page = 'dashboard' | 'commands' | 'location' | 'trips' | 'maintenance'

export interface Vehicle {
  id: string
  name: string
  model: string
  year: number
  color: string
  plate: string | null
  vin: string | null
  created_at: string
}

export interface VehicleStatus {
  id: string
  vehicle_id: string
  fuel_level: number
  mileage: number
  battery_voltage: number
  tire_pressure_fl: number
  tire_pressure_fr: number
  tire_pressure_rl: number
  tire_pressure_rr: number
  engine_running: boolean
  doors_locked: boolean
  location_lat: number | null
  location_lng: number | null
  location_address: string | null
  updated_at: string
}

export interface Trip {
  id: string
  vehicle_id: string
  started_at: string
  ended_at: string | null
  distance_km: number | null
  duration_minutes: number | null
  avg_speed_kmh: number | null
  fuel_used_liters: number | null
  start_address: string | null
  end_address: string | null
  created_at: string
}

export interface MaintenanceItem {
  id: string
  vehicle_id: string
  name: string
  last_done_at: string | null
  last_done_km: number | null
  interval_km: number | null
  interval_months: number | null
  next_due_km: number | null
  next_due_date: string | null
  status: 'ok' | 'upcoming' | 'overdue'
  created_at: string
}

export interface CommandLog {
  id: string
  vehicle_id: string
  command: string
  executed_at: string
  status: 'success' | 'failed' | 'pending'
}
