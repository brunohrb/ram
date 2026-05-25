import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import supabase from '../lib/supabase'
import { saveAuth } from '../lib/auth'
import type { StoredAuth } from '../types'

interface Props { onLogin: (auth: StoredAuth) => void }

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password || !pin) { setError('Preencha todos os campos'); return }
    if (pin.length < 4) { setError('PIN deve ter 4 dígitos'); return }

    setLoading(true)
    setError(null)

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('fca-sync', {
        body: { username, password, pin, discover: true },
      })

      if (fnErr || data?.error) {
        setError(data?.error ?? fnErr?.message ?? 'Erro ao conectar. Verifique suas credenciais.')
        return
      }

      const auth: StoredAuth = {
        username,
        password,
        pin,
        vin: data.vin,
        vehicleId: data.vehicleId,
        vehicleName: data.vehicleName,
      }
      saveAuth(auth)
      onLogin(auth)
    } catch (e) {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0d0d0d]"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="w-20 h-20 rounded-3xl bg-jeep flex items-center justify-center mx-auto mb-4 shadow-lg shadow-jeep/30">
          <svg viewBox="0 0 40 40" className="w-12 h-12" fill="none">
            <rect x="6" y="14" width="28" height="18" rx="3" stroke="white" strokeWidth="2.5" />
            <circle cx="12" cy="32" r="4" fill="white" />
            <circle cx="28" cy="32" r="4" fill="white" />
            <rect x="10" y="8" width="20" height="8" rx="2" stroke="white" strokeWidth="2" />
            <circle cx="16" cy="20" r="3" fill="white" />
            <circle cx="24" cy="20" r="3" fill="white" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Jeep Connect</h1>
        <p className="text-gray-500 text-sm mt-1">Entre com sua conta Jeep</p>
      </div>

      {/* Form */}
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div>
          <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">E-mail</label>
          <input
            type="email"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="seu@email.com"
            autoComplete="email"
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-jeep text-sm"
          />
        </div>

        <div>
          <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">Senha</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3.5 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-jeep text-sm"
            />
            <button type="button" onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 p-1">
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">PIN de segurança</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            autoComplete="off"
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-jeep text-sm tracking-widest"
          />
        </div>

        {error && (
          <div className="bg-red-950/60 border border-red-800/60 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-4 rounded-xl bg-jeep text-white font-bold text-base active:opacity-80 transition-opacity disabled:opacity-50 mt-2 shadow-lg shadow-jeep/30">
          {loading
            ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> Conectando...</span>
            : 'Entrar'
          }
        </button>
      </form>

      <p className="text-gray-700 text-xs mt-8 text-center">
        Use o mesmo e-mail, senha e PIN do app Jeep Connect
      </p>
    </div>
  )
}
