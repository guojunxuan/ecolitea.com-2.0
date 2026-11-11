import { describe, expect, it } from 'vitest'

import { parseServerEnv } from '@/utilities/env'

const base = {
  DATABASE_URI: 'mongodb://127.0.0.1:27017/x-test',
  PAYLOAD_SECRET: 'a'.repeat(32),
  NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000/',
  CRON_SECRET: 'c',
  PREVIEW_SECRET: 'p',
  R2_BUCKET: 'b',
  R2_ACCESS_KEY_ID: 'k',
  R2_SECRET_ACCESS_KEY: 's',
  R2_ENDPOINT: 'https://e.invalid',
  R2_PUBLIC_URL: 'https://m.invalid/',
}

describe('quote request environment', () => {
  it('keeps Turnstile secret and IP salt optional', () => {
    const env = parseServerEnv(base)
    expect(env.TURNSTILE_SECRET_KEY).toBeUndefined()
    expect(env.QUOTE_IP_HASH_SALT).toBeUndefined()
  })

  it('trims provided Turnstile secret and IP salt', () => {
    const env = parseServerEnv({
      ...base,
      TURNSTILE_SECRET_KEY: ' secret ',
      QUOTE_IP_HASH_SALT: ' salt ',
    })
    expect(env.TURNSTILE_SECRET_KEY).toBe('secret')
    expect(env.QUOTE_IP_HASH_SALT).toBe('salt')
  })
})
