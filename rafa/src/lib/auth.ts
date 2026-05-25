import type { StoredAuth } from '../types'

const KEY = 'jeep_auth'

export function saveAuth(auth: StoredAuth) {
  localStorage.setItem(KEY, btoa(JSON.stringify(auth)))
}

export function loadAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(atob(raw)) as StoredAuth
  } catch {
    return null
  }
}

export function clearAuth() {
  localStorage.removeItem(KEY)
}
