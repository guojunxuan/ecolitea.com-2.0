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
  out.R2_PUBLIC_URL = out.R2_PUBLIC_URL.replace(/\/+$/, '')
  out.NEXT_PUBLIC_SERVER_URL = out.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')
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

// Public build-time values use literal reads so Next can inline them. Keep this
// model separate from the server contract; client components must not import
// this module because serverEnv validates server-only configuration on load.
export const publicEnv = {
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
}
