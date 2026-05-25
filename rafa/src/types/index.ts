export type Page = 'dashboard' | 'commands' | 'location' | 'maintenance'

export interface StoredAuth {
  username: string
  password: string
  pin: string
  vin?: string
  vehicleId?: string
  vehicleName?: string
}

export interface Vehicle {
  id: string
  name: string
  model: string
  year: number
  plate: string | null
  vin: string | null
}

export interface VehicleStatus {
  id: string
  vehicle_id: string
  fuel_level: number
  mileage: number
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
}

export interface CommandLog {
  id: string
  vehicle_id: string
  command: string
  executed_at: string
  status: 'success' | 'failed' | 'pending'
}
