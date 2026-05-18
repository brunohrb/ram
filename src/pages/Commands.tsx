import { useEffect, useState } from 'react'
import { CognitoIdentityClient, GetCredentialsForIdentityCommand } from '@aws-sdk/client-cognito-identity'
import { db } from '../lib/supabase'
import supabase from '../lib/supabase'
import type { Vehicle, VehicleStatus, CommandLog } from '../types'
import { Lock, Unlock, Power, Volume2, Lightbulb, Loader2, WifiOff } from 'lucide-react'

const CMD_LABELS: Record<string, string> = {
  LOCK: 'Travou as portas',
  UNLOCK: 'Destravou as portas',
  START: 'Ligou o motor',
  STOP: 'Desligou o motor',
  HORN: 'Buzinou',
  LIGHTS: 'Piscou as luzes',
}

export default function Commands() {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [status, setStatus] = useState<VehicleStatus | null>(null)
  const [logs, setLogs] = useState<CommandLog[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)
  const [confirmStart, setConfirmStart] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: v } = await db.from('vehicles').select('*').limit(1).single()
      if (!v) return
      setVehicle(v as Vehicle)
      const { data: s } = await db.from('vehicle_status').select('*').eq('vehicle_id', v.id).single()
      if (s) setStatus(s as VehicleStatus)
      const { data: l } = await db
        .from('commands_log')
        .select('*')
        .eq('vehicle_id', v.id)
        .order('executed_at', { ascending: false })
        .limit(8)
      setLogs((l ?? []) as CommandLog[])
    }
    load().finally(() => setLoading(false))
  }, [])

  // Mapeamento otimista: o que atualizar no estado local se o comando funcionar
  const OPTIMISTIC: Record<string, Partial<VehicleStatus>> = {
    LOCK: { doors_locked: true },
    UNLOCK: { doors_locked: false },
    START: { engine_running: true },
    STOP: { engine_running: false },
  }

  const run = async (command: string) => {
    if (!vehicle || !status || executing) return
    setExecuting(command)
    setLastError(null)
    try {
      // Phase 1: inicia auth no servidor (Gigya → JWT → Cognito)
      let { data, error } = await supabase.functions.invoke('vehicle-command', {
        body: { command },
      })

      // Phase 2: servidor não consegue chamar AWS direto (restrição de rede);
      // browser faz GetCredentialsForIdentity e reenviar com as credenciais
      if (!error && data?.needs_aws_creds) {
        try {
          const { uid, identityId, token, region } = data
          // Diagnostic: show what we're sending to AWS
          const awsUrl = `https://cognito-identity.${region}.amazonaws.com/`
          const awsBody = JSON.stringify({
            IdentityId: identityId,
            Logins: { 'cognito-identity.amazonaws.com': token ? token.slice(0, 20) + '…' : 'MISSING' },
          })
          const awsRes = await fetch(awsUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-amz-json-1.1',
              'X-Amz-Target': 'AmazonCognitoIdentity.GetCredentialsForIdentity',
            },
            body: JSON.stringify({
              IdentityId: identityId,
              Logins: { 'cognito-identity.amazonaws.com': token },
            }),
          })
          const awsData = await awsRes.json()
          if (!awsData?.Credentials?.AccessKeyId) {
            throw new Error(
              `AWS[${region}] HTTP${awsRes.status}: ${JSON.stringify(awsData)} | id:${identityId?.slice(0, 30)} | tokenOk:${!!token} | req:${awsBody}`
            )
          }
          const { AccessKeyId: accessKeyId, SecretKey: secretKey, SessionToken: sessionToken } = awsData.Credentials
          const res2 = await supabase.functions.invoke('vehicle-command', {
            body: { command, uid, accessKeyId, secretKey, sessionToken },
          })
          data = res2.data
          error = res2.error
        } catch (awsErr) {
          data = { success: false, error: awsErr instanceof Error ? awsErr.message : String(awsErr) }
          error = null
        }
      }

      if (error || !data?.success) {
        const msg = data?.error ?? error?.message ?? 'Erro desconhecido'
        setLastError(msg)
        await db.from('commands_log').insert({ vehicle_id: vehicle.id, command, status: 'failed' })
        return
      }

      // Atualiza estado local otimisticamente
      const updates = OPTIMISTIC[command]
      if (updates) {
        await db
          .from('vehicle_status')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('vehicle_id', vehicle.id)
        setStatus(prev => prev ? { ...prev, ...updates } : prev)
      }

      // Registra sucesso no log
      const { data: log } = await db
        .from('commands_log')
        .insert({ vehicle_id: vehicle.id, command, status: 'success' })
        .select()
        .single()
      if (log) setLogs(prev => [log as CommandLog, ...prev.slice(0, 7)])
    } finally {
      setExecuting(null)
      setConfirmStart(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-ram border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!vehicle || !status) return null

  const btn = (
    id: string,
    icon: React.ReactNode,
    label: string,
    sub: string,
    active: boolean,
    activeClass: string,
    onClick: () => void,
    disabled = false,
  ) => (
    <button
      onClick={onClick}
      disabled={!!executing || disabled}
      className={`flex flex-col items-center justify-center h-32 rounded-2xl border-2 transition-all active:scale-95 select-none disabled:opacity-40 ${
        active ? activeClass : 'bg-[#1a1a1a] border-[#2a2a2a]'
      }`}
    >
      {executing === id
        ? <Loader2 size={30} className="animate-spin text-gray-400" />
        : icon
      }
      <p className="mt-2 text-sm font-semibold text-white">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
    </button>
  )

  return (
    <div className="px-4 pt-4 pb-2 space-y-5">
      <div>
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest">Ram Connect</p>
        <h1 className="text-2xl font-bold mt-0.5">Comandos</h1>
        <p className="text-gray-400 text-sm">{vehicle.model}</p>
      </div>

      {/* Erro do Edge Function */}
      {lastError && (
        <div className="flex items-start gap-3 bg-red-950/50 border border-red-800/60 rounded-2xl p-3">
          <WifiOff size={16} className="text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-red-400 text-xs font-semibold">Comando não enviado</p>
            <p className="text-gray-400 text-xs mt-0.5 break-words">{lastError}</p>
          </div>
          <button onClick={() => setLastError(null)} className="text-gray-600 text-xs">✕</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Lock */}
        {btn(
          'LOCK',
          <Lock size={30} className={status.doors_locked ? 'text-green-400' : 'text-gray-400'} />,
          'Travar',
          status.doors_locked ? 'TRAVADO' : 'ABERTO',
          status.doors_locked,
          'bg-green-950/50 border-green-700/60',
          () => run('LOCK'),
          status.doors_locked,
        )}

        {/* Unlock */}
        {btn(
          'UNLOCK',
          <Unlock size={30} className={!status.doors_locked ? 'text-yellow-400' : 'text-gray-400'} />,
          'Destravar',
          !status.doors_locked ? 'ABERTO' : 'TRAVADO',
          !status.doors_locked,
          'bg-yellow-950/50 border-yellow-700/60',
          () => run('UNLOCK'),
          !status.doors_locked,
        )}

        {/* Engine — with confirm step */}
        {confirmStart && !status.engine_running ? (
          <div className="col-span-2 bg-[#1a1a1a] rounded-2xl border-2 border-ram/60 p-5">
            <p className="text-white font-bold text-center text-base mb-1">Confirmar partida?</p>
            <p className="text-gray-400 text-sm text-center mb-4">O motor será ligado remotamente.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmStart(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#252525] text-gray-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => run('START')}
                className="flex-1 py-2.5 rounded-xl bg-ram text-white text-sm font-bold active:opacity-80"
              >
                {executing === 'START'
                  ? <Loader2 size={16} className="animate-spin mx-auto" />
                  : 'Ligar Motor'
                }
              </button>
            </div>
          </div>
        ) : (
          btn(
            status.engine_running ? 'STOP' : 'START',
            <Power size={30} className={status.engine_running ? 'text-red-400' : 'text-gray-400'} />,
            status.engine_running ? 'Desligar' : 'Ligar Motor',
            status.engine_running ? 'LIGADO' : 'DESLIGADO',
            status.engine_running,
            'bg-red-950/50 border-red-700/60 pulse-red',
            () => {
              if (status.engine_running) run('STOP')
              else setConfirmStart(true)
            },
          )
        )}

        {/* Horn */}
        {btn(
          'HORN',
          <Volume2 size={30} className="text-gray-400" />,
          'Buzinar',
          '1×',
          false,
          '',
          () => run('HORN'),
        )}

        {/* Lights */}
        {btn(
          'LIGHTS',
          <Lightbulb size={30} className="text-gray-400" />,
          'Piscar Luzes',
          '3×',
          false,
          '',
          () => run('LIGHTS'),
        )}
      </div>

      {/* Log */}
      {logs.length > 0 && (
        <div className="space-y-2">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Histórico</p>
          <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] divide-y divide-[#2a2a2a]">
            {logs.map(log => (
              <div key={log.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      log.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-white text-sm">{CMD_LABELS[log.command] ?? log.command}</span>
                </div>
                <span className="text-gray-600 text-xs">
                  {new Date(log.executed_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
