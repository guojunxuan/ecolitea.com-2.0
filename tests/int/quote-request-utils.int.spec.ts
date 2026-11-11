import { describe, expect, it, vi } from 'vitest'

import { parseServerEnv } from '@/utilities/env'

import { getClientIp, hashClientIp } from '@/utilities/quoteRequests/clientIp'
import { verifyTurnstileToken } from '@/utilities/quoteRequests/turnstile'
import { QUOTE_LIMITS, validateQuoteRequestInput } from '@/utilities/quoteRequests/validate'

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

  it('treats whitespace-only optional settings as missing', () => {
    const env = parseServerEnv({ ...base, TURNSTILE_SECRET_KEY: ' ', QUOTE_IP_HASH_SALT: '\t' })
    expect(env.TURNSTILE_SECRET_KEY).toBeUndefined()
    expect(env.QUOTE_IP_HASH_SALT).toBeUndefined()
  })
})

describe('validateQuoteRequestInput', () => {
  const valid = {
    name: ' Ada ',
    email: 'ada@example.com',
    company: 'Lovelace Ltd',
    message: 'Need 500 units',
    productSlug: 'bag',
    turnstileToken: 'tok',
  }

  it('trims fields and returns data', () => {
    const result = validateQuoteRequestInput(valid)
    expect(result).toEqual({ ok: true, data: { ...valid, name: 'Ada' } })
  })

  it('reports every missing required field', () => {
    const result = validateQuoteRequestInput({})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(
        ['company', 'email', 'message', 'name', 'productSlug'].sort(),
      )
    }
  })

  it('rejects malformed email, over-long values and non-objects', () => {
    const bad = validateQuoteRequestInput({
      ...valid,
      email: 'nope',
      message: 'x'.repeat(QUOTE_LIMITS.message + 1),
    })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(Object.keys(bad.fieldErrors).sort()).toEqual(['email', 'message'])
    expect(validateQuoteRequestInput(null).ok).toBe(false)
    expect(validateQuoteRequestInput('text').ok).toBe(false)
  })

  it('coerces a missing or non-string token to an empty string without a field error', () => {
    const result = validateQuoteRequestInput({ ...valid, turnstileToken: 42 })
    expect(result.ok && result.data.turnstileToken).toBe('')
  })

  it('rejects whitespace-only user fields and accepts exact length limits', () => {
    const blank = validateQuoteRequestInput({
      ...valid,
      name: ' ',
      email: '\t',
      company: '\n',
      message: ' ',
      productSlug: ' ',
    })
    expect(blank.ok).toBe(false)
    if (!blank.ok) expect(Object.keys(blank.fieldErrors)).toHaveLength(5)
    const boundary = {
      ...valid,
      name: 'x'.repeat(QUOTE_LIMITS.name),
      email: `${'a'.repeat(QUOTE_LIMITS.email - 12)}@example.com`,
      company: 'x'.repeat(QUOTE_LIMITS.company),
      message: 'x'.repeat(QUOTE_LIMITS.message),
    }
    expect(validateQuoteRequestInput(boundary).ok).toBe(true)
    const over = validateQuoteRequestInput({
      ...boundary,
      name: `${boundary.name}x`,
      email: `x${boundary.email}`,
      company: `${boundary.company}x`,
      message: `${boundary.message}x`,
    })
    expect(over.ok).toBe(false)
    if (!over.ok)
      expect(Object.keys(over.fieldErrors).sort()).toEqual(['company', 'email', 'message', 'name'])
  })
})

describe('verifyTurnstileToken', () => {
  const call = (fetchImpl: typeof fetch, token = 'tok', secret = 's') =>
    verifyTurnstileToken({ token, secret, ip: '1.2.3.4', fetchImpl })

  it('accepts only success: true', async () => {
    const ok = vi.fn(async () => Response.json({ success: true }))
    expect(await call(ok as unknown as typeof fetch)).toBe(true)
    const body = (ok.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams
    expect(body.get('secret')).toBe('s')
    expect(body.get('response')).toBe('tok')
    expect(body.get('remoteip')).toBe('1.2.3.4')

    const no = vi.fn(async () => Response.json({ success: false }))
    expect(await call(no as unknown as typeof fetch)).toBe(false)
  })

  it('fails closed on empty token, missing secret, HTTP errors and network errors', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ success: true }))
    expect(await call(fetchImpl as unknown as typeof fetch, '')).toBe(false)
    expect(await call(fetchImpl as unknown as typeof fetch, 'tok', '')).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
    const http = vi.fn(async () => new Response('x', { status: 503 }))
    expect(await call(http as unknown as typeof fetch)).toBe(false)
    const boom = vi.fn(async () => {
      throw new Error('network')
    })
    expect(await call(boom as unknown as typeof fetch)).toBe(false)
  })

  it('rejects malformed JSON and responses without a boolean true', async () => {
    for (const result of [{}, { success: 'true' }, null]) {
      expect(await call(vi.fn(async () => Response.json(result)) as typeof fetch)).toBe(false)
    }
    expect(await call(vi.fn(async () => new Response('not-json')) as typeof fetch)).toBe(false)
  })
})

describe('client IP helpers', () => {
  it('prefers the first x-forwarded-for entry, then x-real-ip', () => {
    expect(getClientIp(new Headers({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }))).toBe('9.9.9.9')
    expect(getClientIp(new Headers({ 'x-real-ip': '8.8.8.8' }))).toBe('8.8.8.8')
    expect(getClientIp(new Headers())).toBeUndefined()
  })

  it('hashes deterministically per salt and never returns the raw IP', () => {
    const a = hashClientIp('1.2.3.4', 'salt-a')
    expect(a).toBe(hashClientIp('1.2.3.4', 'salt-a'))
    expect(a).not.toBe(hashClientIp('1.2.3.4', 'salt-b'))
    expect(a).not.toBe(hashClientIp('1.2.3.5', 'salt-a'))
    expect(a).not.toContain('1.2.3.4')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('uses the fallback address for blank forwarded headers and a shared unknown bucket', () => {
    expect(
      getClientIp(new Headers({ 'x-forwarded-for': ' , proxy', 'x-real-ip': ' 8.8.8.8 ' })),
    ).toBe('8.8.8.8')
    expect(hashClientIp(undefined, 'salt')).toBe(hashClientIp(undefined, 'salt'))
    expect(hashClientIp(undefined, 'salt')).not.toBe(hashClientIp('1.2.3.4', 'salt'))
  })
})
