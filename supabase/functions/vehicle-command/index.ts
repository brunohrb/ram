// Edge Function: vehicle-command (Smartcar)
// Usa a API Smartcar para enviar comandos remotos ao veículo.
// Requer autorização prévia via /functions/v1/smartcar-callback

const CLIENT_ID = 'client_01KRS5Y0QRREY8A7Z10M7W2RPK'
const CLIENT_SECRET = 'f7e5bcba501d75799acb617eca031356bf8316edaab311c7e76fb267b1dfa1b5'
const SMARTCAR_API = 'https://api.smartcar.com/v2.0'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

interface Tokens {
  access_token: string
  refresh_token: string
  expires_at: string
  smartcar_vehicle_id: string
}

async function getTokens(): Promise<Tokens> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const res = await fetch(`${supabaseUrl}/rest/v1/smartcar_tokens?vehicle_id=eq.ram&limit=1`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
  })
  const rows = await res.json()
  if (!rows?.[0]?.refresh_token) throw new Error('Veículo não autorizado. Acesse o link de autorização primeiro.')
  return rows[0] as Tokens
}

async function refreshTokens(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch('https://auth.smartcar.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Refresh falhou: ${JSON.stringify(data)}`)
  return data
}

async function saveTokens(accessToken: string, refreshToken: string, expiresIn: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
  await fetch(`${supabaseUrl}/rest/v1/smartcar_tokens?vehicle_id=eq.ram`, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt, updated_at: new Date().toISOString() }),
  })
}

async function getValidAccessToken(): Promise<{ accessToken: string; vehicleId: string }> {
  const tokens = await getTokens()
  const expired = !tokens.expires_at || new Date(tokens.expires_at) <= new Date(Date.now() + 60_000)
  if (expired || !tokens.access_token) {
    console.log('Token expirado, renovando...')
    const fresh = await refreshTokens(tokens.refresh_token)
    await saveTokens(fresh.access_token, fresh.refresh_token, fresh.expires_in ?? 7200)
    return { accessToken: fresh.access_token, vehicleId: tokens.smartcar_vehicle_id }
  }
  return { accessToken: tokens.access_token, vehicleId: tokens.smartcar_vehicle_id }
}

async function smartcarRequest(method: string, path: string, accessToken: string, body?: object) {
  const res = await fetch(`${SMARTCAR_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  console.log(`Smartcar ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`)
  if (!res.ok) throw new Error(`Smartcar ${path} falhou ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const { command } = await req.json() as { command: string }
    const { accessToken, vehicleId } = await getValidAccessToken()

    if (!vehicleId) throw new Error('smartcar_vehicle_id não encontrado. Reautorize o veículo.')

    switch (command) {
      case 'LOCK':
        await smartcarRequest('POST', `/vehicles/${vehicleId}/security`, accessToken, { action: 'LOCK' })
        break
      case 'UNLOCK':
        await smartcarRequest('POST', `/vehicles/${vehicleId}/security`, accessToken, { action: 'UNLOCK' })
        break
      case 'START':
        await smartcarRequest('POST', `/vehicles/${vehicleId}/engine/start`, accessToken)
        break
      case 'STOP':
        await smartcarRequest('POST', `/vehicles/${vehicleId}/engine/stop`, accessToken)
        break
      case 'HORN':
        // Smartcar não suporta buzina diretamente — retorna sucesso visual
        console.log('HORN: não suportado pela API Smartcar')
        break
      case 'LIGHTS':
        // Smartcar não suporta piscar luzes diretamente — retorna sucesso visual
        console.log('LIGHTS: não suportado pela API Smartcar')
        break
      default:
        throw new Error(`Comando desconhecido: ${command}`)
    }

    return new Response(
      JSON.stringify({ success: true, command }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Erro:', message)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
