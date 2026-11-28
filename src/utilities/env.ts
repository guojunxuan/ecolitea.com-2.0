export type ServerEnv = {
  DATABASE_URI: string
  PAYLOAD_SECRET: string
  NEXT_PUBLIC_SERVER_URL: string
  CRON_SECRET: string
  PREVIEW_SECRET: string
  R2_BUCKET: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_ENDPOINT: string
  R2_PUBLIC_URL: string
  TURNSTILE_SECRET_KEY?: string
  QUOTE_IP_HASH_SALT?: string
  REVALIDATE_SECRET?: string
  JOBS_AUTORUN: boolean
}

export type SmtpEnvConfiguration = {
  host: string
  port: number
  security: 'none' | 'starttls' | 'tls'
  user?: string
  password?: string
  fromAddress?: string
  fromName?: string
}

// Match ordinary mailbox addresses while allowing Mailpit's local sender domain.
export const isSmtpEmailAddress = (value: unknown): value is string =>
  typeof value === 'string' &&
  !/\s/.test(value) &&
  /^(?!.*\.\.)[\w!#$%&'*+/=?^`{|}~-](?:[\w!#$%&'*+/=?^`{|}~.-]*[\w!#$%&'*+/=?^`{|}~-])?@(?:localhost|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,})$/i.test(
    value,
  )

// Resolve this optional group at send time. Invalid SMTP must not block startup.
export function parseSmtpEnv(env: Partial<NodeJS.ProcessEnv>): SmtpEnvConfiguration | undefined {
  const host = env.SMTP_HOST?.trim()
  if (!host) return undefined

  const portValue = env.SMTP_PORT?.trim() || '587'
  const port = Number(portValue)
  if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid SMTP_PORT: enter an integer from 1 to 65535.')

  const security = env.SMTP_SECURE?.trim() || 'starttls'
  if (security !== 'none' && security !== 'starttls' && security !== 'tls')
    throw new Error('Invalid SMTP_SECURE: choose none, starttls, or tls.')

  const fromAddress = env.SMTP_FROM_ADDRESS?.trim()
  if (fromAddress && !isSmtpEmailAddress(fromAddress))
    throw new Error('Invalid SMTP_FROM_ADDRESS: enter a valid email address.')

  const user = env.SMTP_USER?.trim()
  const password = env.SMTP_PASSWORD
  const fromName = env.SMTP_FROM_NAME?.trim()
  return {
    host,
    port,
    security,
    ...(user ? { user } : {}),
    ...(password ? { password } : {}),
    ...(fromAddress ? { fromAddress } : {}),
    ...(fromName ? { fromName } : {}),
  }
}

const required = [
  'DATABASE_URI',
  'PAYLOAD_SECRET',
  'NEXT_PUBLIC_SERVER_URL',
  'CRON_SECRET',
  'PREVIEW_SECRET',
  'R2_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_ENDPOINT',
  'R2_PUBLIC_URL',
] as const
const optional = ['TURNSTILE_SECRET_KEY', 'QUOTE_IP_HASH_SALT', 'REVALIDATE_SECRET'] as const
export function parseServerEnv(env: Partial<NodeJS.ProcessEnv>): ServerEnv {
  const out = {} as Record<(typeof required)[number], string>
  for (const key of required) {
    const value = env[key]
    if (!value?.trim()) throw new Error(`Missing required environment variable: ${key}`)
    out[key] = value.trim()
  }
  // Keep public property reads and assignment targets computed: generate-env also
  // replaces direct NEXT_PUBLIC_* accesses on objects other than process.env.
  for (const key of ['R2_PUBLIC_URL', 'NEXT_PUBLIC_SERVER_URL'] as const) {
    out[key] = out[key].replace(/\/+$/, '')
  }
  const result: ServerEnv = {
    ...out,
    JOBS_AUTORUN: env.JOBS_AUTORUN === 'true',
  }
  for (const key of optional) {
    const value = env[key]?.trim()
    if (value) result[key] = value
  }
  return result
}
// Integration tests run without production credentials. Keep the explicit
// parser strict while supplying isolated, non-routable defaults only in test
// mode so importing Payload config does not require a developer `.env` file.
const testDefaults: Record<(typeof required)[number], string> = {
  DATABASE_URI: 'mongodb://127.0.0.1:27017/ecolitea2-test',
  PAYLOAD_SECRET: 'ci-only-payload-secret-that-is-at-least-32-characters',
  NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000',
  CRON_SECRET: 'ci-only-cron-secret',
  PREVIEW_SECRET: 'ci-only-preview-secret',
  R2_BUCKET: 'ci-only-bucket',
  R2_ACCESS_KEY_ID: 'ci-only-access-key',
  R2_SECRET_ACCESS_KEY: 'ci-only-secret-key',
  R2_ENDPOINT: 'https://ci-only-account.r2.cloudflarestorage.com',
  R2_PUBLIC_URL: 'https://media.example.invalid',
}

const testOptionalDefaults = {
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  QUOTE_IP_HASH_SALT: 'ci-only-quote-ip-hash-salt',
}

export const serverEnv = parseServerEnv(
  process.env.NODE_ENV === 'test' || process.env.VITEST
    ? { ...testDefaults, ...testOptionalDefaults, ...process.env }
    : process.env,
)

// Preserve the validated startup origin, including normalization and requiredness.
// Reflect.get prevents generate-env from replacing public properties on serverEnv.
export function getConfiguredServerURL(): string {
  return Reflect.get(serverEnv, 'NEXT_PUBLIC_SERVER_URL') as string
}

// Read on the server during dynamic rendering and pass only the public key to clients.
// Reflect.get survives minification without becoming a NEXT_PUBLIC_* property read
// that Next's generate-env step could replace with a build-time value.
export function getTurnstileSiteKey(): string | undefined {
  const value = Reflect.get(process.env, 'NEXT_PUBLIC_TURNSTILE_SITE_KEY') as string | undefined
  return value?.trim() || undefined
}
