// Edge Function: vehicle-command
// FCA auth: Gigya → JWT → Cognito (via AWS SDK) → SigV4 → PIN → Comando

import { CognitoIdentityClient, GetCredentialsForIdentityCommand } from 'npm:@aws-sdk/client-cognito-identity'

const GIGYA_API_KEY = '3_7YjzjoSb7dYtCP5-D6FhPsCciggJFvM14hNPvXN9OsIiV1ujDqa4fNltDJYnHawO'
const COGNITO_API_KEY = 'OgNqp2eAv84oZvMrXPIzP8mR8a6d9bVm1aaH9LqU'
const MFA_API_KEY = 'fNQO6NjR1N6W0E5A6sTzR3YY4JGbuPv48Nj9aZci'

const GIGYA_BASE = 'https://login-us.ramtrucks.com'
const AUTHZ_BASE = 'https://authz.sdpr-02.fcagcv.com'
const CHANNELS_BASE = 'https://channels.sdpr-02.fcagcv.com'
const MFA_BASE = 'https://mfa.fcl-02.fcagcv.com'
const AWS_REGION = 'us-east-1'

const COMMAND_MAP: Record<string, string> = {
  LOCK: 'RDL', UNLOCK: 'RDU', LIGHTS: 'HBLF', HORN: 'VF', START: 'REON', STOP: 'REOFF',
}

// ── AWS SigV4 ─────────────────────────────────────────────────────────────────

function hex(arr: Uint8Array) {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}
async function hmac(key: Uint8Array, data: string) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)))
}
async function sha256(data: string) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))))
}

interface AWSCreds { accessKeyId: string; secretAccessKey: string; sessionToken: string }

async function signRequest(method: string, url: string, body: string, creds: AWSCreds, extraHeaders: Record<string, string> = {}) {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)
  const { hostname, pathname, search } = new URL(url)
  const signedKeys = ['content-type', 'host', 'x-amz-date', 'x-amz-security-token']
  const allHeaders: Record<string, string> = {
    'content-type': 'application/json',
    'host': hostname,
    'x-amz-date': amzDate,
    'x-amz-security-token': creds.sessionToken,
    ...extraHeaders,
  }
  const canonicalHeaders = signedKeys.map(k => `${k}:${allHeaders[k]}`).join('\n') + '\n'
  const credScope = `${dateStamp}/${AWS_REGION}/execute-api/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credScope, await sha256(
    [method, pathname, search.slice(1), canonicalHeaders, signedKeys.join(';'), await sha256(body)].join('\n')
  )].join('\n')
  const kDate = await hmac(new TextEncoder().encode('AWS4' + creds.secretAccessKey), dateStamp)
  const kRegion = await hmac(kDate, AWS_REGION)
  const kService = await hmac(kRegion, 'execute-api')
  const sig = hex(await hmac(await hmac(kService, 'aws4_request'), stringToSign))
  return {
    ...allHeaders,
    'Authorization': `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${credScope}, SignedHeaders=${signedKeys.join(';')}, Signature=${sig}`,
  }
}

// ── Auth steps ────────────────────────────────────────────────────────────────

function reqId() { return crypto.randomUUID().replace(/-/g, '').slice(0, 16) }

async function gigyaLogin(username: string, password: string) {
  const res = await fetch(`${GIGYA_BASE}/accounts.login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ loginID: username, password, sessionExpiration: '7776000', APIKey: GIGYA_API_KEY, format: 'json' }).toString(),
  })
  const data = await res.json()
  const loginToken = data.sessionInfo?.login_token ?? data.sessionInfo?.cookieValue
  if (!loginToken) throw new Error(`Gigya login falhou: ${data.errorMessage ?? JSON.stringify(data)}`)
  return { loginToken: loginToken as string, uid: data.UID as string }
}

async function getJWT(loginToken: string) {
  const url = new URL(`${GIGYA_BASE}/accounts.getJWT`)
  url.searchParams.set('APIKey', GIGYA_API_KEY)
  url.searchParams.set('login_token', loginToken)
  url.searchParams.set('fields', 'profile.firstName,profile.lastName,profile.email,country,locale,data.disclaimerCodeGSDP')
  url.searchParams.set('format', 'json')
  const res = await fetch(url.toString())
  const data = await res.json()
  if (!data.id_token) throw new Error(`getJWT falhou: ${data.errorMessage ?? JSON.stringify(data)}`)
  return data.id_token as string
}

async function cognitoExchange(idToken: string) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Api-Key': COGNITO_API_KEY,
    'clientrequestid': reqId(),
    'x-clientapp-name': 'CWP',
    'x-clientapp-version': '1.0',
    'x-originator-type': 'web',
    'locale': 'en_us',
  }
  const res = await fetch(`${AUTHZ_BASE}/v2/cognito/identity/token`, {
    method: 'POST', headers, body: JSON.stringify({ gigya_token: idToken }),
  })
  const data = await res.json()
  console.log(`cognitoExchange: ${JSON.stringify(data).slice(0, 300)}`)
  if (!data.IdentityId) throw new Error(`Cognito exchange falhou: ${JSON.stringify(data)}`)
  return { identityId: data.IdentityId as string, token: (data.Token ?? data.token ?? '') as string }
}

async function getAWSCreds(identityId: string, token: string, gigyaJwt: string): Promise<AWSCreds> {
  const client = new CognitoIdentityClient({ region: identityId.split(':')[0] ?? AWS_REGION })
  const logins: Record<string, string> = {}
  if (token) logins['cognito-identity.amazonaws.com'] = token
  if (gigyaJwt) logins['accounts.us1.gigya.com'] = gigyaJwt

  for (const [key, val] of Object.entries(logins)) {
    try {
      console.log(`Tentando Cognito com provider: ${key}`)
      const result = await client.send(new GetCredentialsForIdentityCommand({
        IdentityId: identityId,
        Logins: { [key]: val },
      }))
      if (!result.Credentials?.AccessKeyId) throw new Error('Sem credenciais na resposta')
      console.log(`Cognito OK com provider: ${key}`)
      return {
        accessKeyId: result.Credentials.AccessKeyId!,
        secretAccessKey: result.Credentials.SecretKey!,
        sessionToken: result.Credentials.SessionToken!,
      }
    } catch (e) {
      console.log(`Cognito falhou com ${key}: ${e}`)
    }
  }

  // Tenta sem Logins (identity pool público)
  try {
    const result = await client.send(new GetCredentialsForIdentityCommand({ IdentityId: identityId }))
    if (result.Credentials?.AccessKeyId) {
      return {
        accessKeyId: result.Credentials.AccessKeyId!,
        secretAccessKey: result.Credentials.SecretKey!,
        sessionToken: result.Credentials.SessionToken!,
      }
    }
  } catch (e) { console.log(`Cognito sem Logins falhou: ${e}`) }

  throw new Error('Não foi possível obter credenciais AWS do Cognito')
}

async function pinAuth(uid: string, pin: string, creds: AWSCreds): Promise<string> {
  const url = `${MFA_BASE}/v1/accounts/${uid}/ignite/pin/authenticate`
  const body = JSON.stringify({ pin: btoa(pin) })
  const headers = await signRequest('POST', url, body, creds, {
    'X-Api-Key': MFA_API_KEY, 'clientrequestid': reqId(), 'x-originator-type': 'web',
  })
  const res = await fetch(url, { method: 'POST', headers, body })
  const data = await res.json()
  if (!data.token) throw new Error(`PIN auth falhou: ${JSON.stringify(data)}`)
  return data.token as string
}

async function sendVehicleCommand(uid: string, vin: string, command: string, pinToken: string, creds: AWSCreds) {
  const fcaCmd = COMMAND_MAP[command]
  if (!fcaCmd) throw new Error(`Comando desconhecido: ${command}`)
  const url = `${CHANNELS_BASE}/v1/accounts/${uid}/vehicles/${vin}/remote`
  const body = JSON.stringify({ command: fcaCmd, pinAuth: pinToken })
  const headers = await signRequest('POST', url, body, creds, {
    'X-Api-Key': COGNITO_API_KEY, 'clientrequestid': reqId(), 'x-clientapp-version': '1.0', 'x-originator-type': 'web',
  })
  const res = await fetch(url, { method: 'POST', headers, body })
  if (!res.ok) throw new Error(`Comando ${command} falhou ${res.status}: ${await res.text()}`)
}

// ── Handler ───────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  try {
    const { command } = await req.json() as { command: string }
    const username = Deno.env.get('FCA_USERNAME') ?? ''
    const password = Deno.env.get('FCA_PASSWORD') ?? ''
    const pin = Deno.env.get('FCA_PIN') ?? ''
    const vin = Deno.env.get('VEHICLE_VIN') ?? ''
    if (!username || !password || !pin || !vin)
      throw new Error('Secrets não configurados: FCA_USERNAME, FCA_PASSWORD, FCA_PIN, VEHICLE_VIN')

    console.log(`Autenticando para comando: ${command}`)
    const { loginToken, uid } = await gigyaLogin(username, password)
    const idToken = await getJWT(loginToken)
    const { identityId, token } = await cognitoExchange(idToken)
    const creds = await getAWSCreds(identityId, token, idToken)
    const pinToken = await pinAuth(uid, pin, creds)
    console.log(`Enviando ${command} (${COMMAND_MAP[command]}) para VIN ${vin}`)
    await sendVehicleCommand(uid, vin, command, pinToken, creds)

    return new Response(
      JSON.stringify({ success: true, command, fca_command: COMMAND_MAP[command] }),
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
