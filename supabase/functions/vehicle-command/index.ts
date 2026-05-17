// Edge Function: vehicle-command
// Autentica na API Stellantis/FCA e envia comandos remotos para o veículo.
//
// Fluxo: Gigya login → JWT → Cognito token → AWS credentials → PIN auth → Comando
//
// Secrets necessários no Supabase:
//   FCA_USERNAME  = e-mail do My Uconnect
//   FCA_PASSWORD  = senha do My Uconnect
//   FCA_PIN       = PIN de 4 dígitos configurado no app
//   VEHICLE_VIN   = número de chassi do veículo (17 caracteres)

// RAM US/LATAM portal (used for RAM trucks in Americas including Brazil)
const GIGYA_API_KEY = '3_7YjzjoSb7dYtCP5-D6FhPsCciggJFvM14hNPvXN9OsIiV1ujDqa4fNltDJYnHawO'
const COGNITO_API_KEY = 'OgNqp2eAv84oZvMrXPIzP8mR8a6d9bVm1aaH9LqU'
const MFA_API_KEY = 'fNQO6NjR1N6W0E5A6sTzR3YY4JGbuPv48Nj9aZci'

const GIGYA_BASE = 'https://login-us.ramtrucks.com'
const AUTHZ_BASE = 'https://authz.sdpr-02.fcagcv.com'
const CHANNELS_BASE = 'https://channels.sdpr-02.fcagcv.com'
const MFA_BASE = 'https://mfa.fcl-02.fcagcv.com'
const AWS_REGION = 'us-east-1'

// Mapa de comandos do app → código da API FCA
const COMMAND_MAP: Record<string, string> = {
  LOCK: 'RDL',
  UNLOCK: 'RDU',
  LIGHTS: 'HBLF',
  HORN: 'VF',
  START: 'REON',
  STOP: 'REOFF',
}

// ── AWS Signature V4 ──────────────────────────────────────────────────────────

function hex(arr: Uint8Array): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)))
}

async function sha256(data: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))))
}

interface AWSCreds {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
}

async function signRequest(
  method: string,
  url: string,
  body: string,
  creds: AWSCreds,
  extraHeaders: Record<string, string> = {},
  service = 'execute-api',
): Promise<Record<string, string>> {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').replace('Z', 'Z')
    .replace(/(\d{8})T(\d{6})Z/, '$1T$2Z')
  const dateStamp = amzDate.slice(0, 8)

  const { hostname, pathname, search } = new URL(url)

  const signedHeaderKeys = ['content-type', 'host', 'x-amz-date', 'x-amz-security-token']
  const allHeaders: Record<string, string> = {
    'content-type': 'application/json',
    'host': hostname,
    'x-amz-date': amzDate,
    'x-amz-security-token': creds.sessionToken,
    ...extraHeaders,
  }

  const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${allHeaders[k]}`).join('\n') + '\n'
  const signedHeaders = signedHeaderKeys.join(';')
  const payloadHash = await sha256(body)
  const canonicalRequest = [method, pathname, search.slice(1), canonicalHeaders, signedHeaders, payloadHash].join('\n')

  const credScope = `${dateStamp}/${AWS_REGION}/${service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credScope, await sha256(canonicalRequest)].join('\n')

  const kDate = await hmac(new TextEncoder().encode('AWS4' + creds.secretAccessKey), dateStamp)
  const kRegion = await hmac(kDate, AWS_REGION)
  const kService = await hmac(kRegion, service)
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = hex(await hmac(kSigning, stringToSign))

  return {
    ...allHeaders,
    'Authorization': `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}

// ── Auth steps ────────────────────────────────────────────────────────────────

function reqId() { return crypto.randomUUID().replace(/-/g, '').slice(0, 16) }

async function gigyaLogin(username: string, password: string) {
  const body = new URLSearchParams({
    loginID: username,
    password,
    sessionExpiration: '7776000',
    APIKey: GIGYA_API_KEY,
    pageURL: 'https://myuconnect.fiat.com/login',
    format: 'json',
  })
  const res = await fetch(`${GIGYA_BASE}/accounts.login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await res.json()
  const loginToken = data.sessionInfo?.login_token ?? data.sessionInfo?.cookieValue
  if (!loginToken)
    throw new Error(`Gigya login falhou: ${data.errorMessage ?? JSON.stringify(data)}`)
  return { loginToken: loginToken as string, uid: data.UID as string }
}

async function getJWT(loginToken: string) {
  const url = new URL(`${GIGYA_BASE}/accounts.getJWT`)
  url.searchParams.set('APIKey', GIGYA_API_KEY)
  url.searchParams.set('login_token', loginToken)
  url.searchParams.set('fields', 'profile.firstName,profile.lastName,profile.email,country,locale,data.disclaimerCodeGSDP')
  url.searchParams.set('pageURL', 'https://connect.ramtrucks.com/us/en/dashboard')
  url.searchParams.set('format', 'json')
  const res = await fetch(url.toString())
  const data = await res.json()
  if (!data.id_token) throw new Error(`getJWT falhou: ${data.errorMessage ?? JSON.stringify(data)}`)
  return data.id_token as string
}

async function cognitoExchange(idToken: string) {
  const res = await fetch(`${AUTHZ_BASE}/v2/cognito/identity/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': COGNITO_API_KEY,
      'clientrequestid': reqId(),
      'x-clientapp-name': 'CWP',
      'x-clientapp-version': '1.0',
      'x-originator-type': 'web',
      'locale': 'en_us',
    },
    body: JSON.stringify({ gigya_token: idToken }),
  })
  const data = await res.json()
  console.log(`cognitoExchange keys: ${Object.keys(data).join(', ')}`)
  if (!data.IdentityId) throw new Error(`Cognito exchange falhou: ${JSON.stringify(data)}`)
  // If FCA already returns AWS credentials in the exchange, return them directly
  if (data.Credentials?.AccessKeyId) {
    console.log('cognitoExchange: credentials included in response')
    return {
      identityId: data.IdentityId as string,
      token: data.Token as string,
      credentials: {
        accessKeyId: data.Credentials.AccessKeyId as string,
        secretAccessKey: data.Credentials.SecretKey as string,
        sessionToken: data.Credentials.SessionToken as string,
      },
    }
  }
  return { identityId: data.IdentityId as string, token: data.Token as string, credentials: undefined }
}

async function getAWSCreds(identityId: string, token: string): Promise<AWSCreds> {
  const region = identityId.split(':')[0] || AWS_REGION
  const url = `https://cognito-identity.${region}.amazonaws.com/`
  const body = JSON.stringify({
    IdentityId: identityId,
    Logins: { 'cognito-identity.amazonaws.com': token },
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AmazonCognitoIdentity.GetCredentialsForIdentity',
    },
    body,
  })
  const data = await res.json()
  if (!data?.Credentials?.AccessKeyId) throw new Error(`AWS creds blocked: ${JSON.stringify(data).slice(0, 100)}`)
  return {
    accessKeyId: data.Credentials.AccessKeyId as string,
    secretAccessKey: data.Credentials.SecretKey as string,
    sessionToken: data.Credentials.SessionToken as string,
  }
}

async function pinAuth(uid: string, pin: string, creds: AWSCreds): Promise<string> {
  const url = `${MFA_BASE}/v1/accounts/${uid}/ignite/pin/authenticate`
  const body = JSON.stringify({ pin: btoa(pin) })
  const headers = await signRequest('POST', url, body, creds, {
    'X-Api-Key': MFA_API_KEY,
    'clientrequestid': reqId(),
    'x-originator-type': 'web',
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
    'X-Api-Key': COGNITO_API_KEY,
    'clientrequestid': reqId(),
    'x-clientapp-version': '1.0',
    'x-originator-type': 'web',
  })

  const res = await fetch(url, { method: 'POST', headers, body })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Comando ${command} falhou ${res.status}: ${err}`)
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const body = await req.json() as {
      command: string
      uid?: string
      accessKeyId?: string
      secretKey?: string
      sessionToken?: string
    }
    const { command } = body

    const pin = Deno.env.get('FCA_PIN') ?? ''
    const vin = Deno.env.get('VEHICLE_VIN') ?? ''

    // Phase 2: browser fetched AWS creds, use them directly
    if (body.uid && body.accessKeyId && body.secretKey && body.sessionToken) {
      if (!pin || !vin) throw new Error('Secrets não configurados: FCA_PIN, VEHICLE_VIN')
      const creds: AWSCreds = {
        accessKeyId: body.accessKeyId,
        secretAccessKey: body.secretKey,
        sessionToken: body.sessionToken,
      }
      const pinToken = await pinAuth(body.uid, pin, creds)
      console.log(`Enviando ${command} (${COMMAND_MAP[command]}) para VIN ${vin}`)
      await sendVehicleCommand(body.uid, vin, command, pinToken, creds)
      return new Response(
        JSON.stringify({ success: true, command, fca_command: COMMAND_MAP[command] }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    // Phase 1: full auth flow
    const username = Deno.env.get('FCA_USERNAME') ?? ''
    const password = Deno.env.get('FCA_PASSWORD') ?? ''
    if (!username || !password || !pin || !vin)
      throw new Error('Secrets não configurados: FCA_USERNAME, FCA_PASSWORD, FCA_PIN, VEHICLE_VIN')

    console.log(`Autenticando para comando: ${command}`)
    const { loginToken, uid } = await gigyaLogin(username, password)
    const idToken = await getJWT(loginToken)
    const { identityId, token, credentials } = await cognitoExchange(idToken)
    const region = identityId.split(':')[0] || AWS_REGION

    const runCommand = async (creds: AWSCreds) => {
      const pinToken = await pinAuth(uid, pin, creds)
      console.log(`Enviando ${command} (${COMMAND_MAP[command]}) para VIN ${vin}`)
      await sendVehicleCommand(uid, vin, command, pinToken, creds)
      return new Response(
        JSON.stringify({ success: true, command, fca_command: COMMAND_MAP[command] }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    if (credentials) return await runCommand(credentials)

    try {
      return await runCommand(await getAWSCreds(identityId, token))
    } catch {
      // AWS blocked server-side; delegate GetCredentialsForIdentity to browser
      console.log('AWS creds blocked server-side, delegating to client browser')
      return new Response(
        JSON.stringify({ needs_aws_creds: true, uid, identityId, token, region }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Erro:', message)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
