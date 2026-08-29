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
}

const required = ['DATABASE_URI','PAYLOAD_SECRET','NEXT_PUBLIC_SERVER_URL','CRON_SECRET','PREVIEW_SECRET','R2_BUCKET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_ENDPOINT','R2_PUBLIC_URL'] as const
export function parseServerEnv(env: NodeJS.ProcessEnv): ServerEnv {
  const out = {} as Record<(typeof required)[number], string>
  for (const key of required) {
    const value = env[key]
    if (!value?.trim()) throw new Error(`Missing required environment variable: ${key}`)
    out[key] = value.trim()
  }
  out.R2_PUBLIC_URL = out.R2_PUBLIC_URL.replace(/\/+$/, '')
  out.NEXT_PUBLIC_SERVER_URL = out.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')
  return out
}
export const serverEnv = parseServerEnv(process.env)
