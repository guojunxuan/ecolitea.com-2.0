// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { openSecret, sealSecret } from '@/utilities/secretBox'
import { getIntegrations } from '@/SiteSettings/integrations'
import { validGtmId } from '@/consent/gtm'
import { integrationFields, validateMonthlyCharLimit } from '@/SiteSettings/fields/integrations'

const secret = 'isolated-integration-secret-32-characters'
describe('integration secrets and normalized settings', () => {
  it('keeps native virtual inputs editable after Payload sanitization', async () => {
    const { buildConfig } = await import('payload')
    const { mongooseAdapter } = await import('@payloadcms/db-mongodb')
    const config = await buildConfig({
      secret,
      db: mongooseAdapter({ url: 'mongodb://127.0.0.1:27017/ecolitea2-test' }),
      collections: [],
      globals: [{ slug: 'site-settings', fields: integrationFields }],
    })
    for (const name of ['googleTranslateApiKeyInput', 'googleTranslateApiKeyClear']) {
      const field = config.globals[0].fields.find((field) => 'name' in field && field.name === name)
      expect(field).toMatchObject({ admin: { readOnly: false } })
    }
  })
  it('round trips using random authenticated ciphertext', () => {
    const one = sealSecret('test-translate-key-1234', secret)
    expect(one).toMatch(/^v1:/)
    expect(one).not.toContain('test-translate-key')
    expect(sealSecret('test-translate-key-1234', secret)).not.toBe(one)
    expect(openSecret(one, secret)).toEqual({ ok: true, value: 'test-translate-key-1234' })
  })
  it('returns typed failure for tampering, invalid versions and rotated secrets', () => {
    const encrypted = sealSecret('key', secret)
    const parts = encrypted.split(':')
    parts[2] = Buffer.alloc(16).toString('base64url')
    for (const value of [parts.join(':'), 'v2:a:b:c', 'garbage', 'v1::::'])
      expect(openSecret(value, secret)).toEqual({ ok: false })
    expect(openSecret(encrypted, 'rotated-secret')).toEqual({ ok: false })
  })
  it.each(['G-123', 'gtm-ABC', 'GTM-a', 'GTM-', '', undefined])(
    'rejects invalid GTM ID %s',
    (value) => {
      expect(validGtmId(value)).toBeNull()
    },
  )
  it('normalizes a trimmed valid ID', () => expect(validGtmId('  GTM-ABC12  ')).toBe('GTM-ABC12'))
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, null])(
    'rejects invalid monthly limit %s',
    (value) => {
      expect(validateMonthlyCharLimit(value)).not.toBe(true)
    },
  )
  it('reads trusted settings at runtime and normalizes missing values', async () => {
    const findGlobal = vi
      .fn()
      .mockResolvedValue({ gtmContainerId: 'bad', translationMonthlyCharLimit: -1 })
    const payload = { findGlobal, secret } as unknown as Payload
    expect(await getIntegrations(payload)).toEqual({
      gtm: { containerId: null, disabled: false },
      translate: { apiKey: null, status: 'missing', monthlyCharLimit: 450000 },
    })
    expect(findGlobal).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'site-settings', depth: 0, overrideAccess: true }),
    )
    findGlobal.mockResolvedValue({
      gtmContainerId: 'GTM-ABC',
      disableGtm: true,
      googleTranslateApiKeyEncrypted: sealSecret('key1234', secret),
      translationMonthlyCharLimit: 123,
    })
    expect(await getIntegrations(payload)).toEqual({
      gtm: { containerId: 'GTM-ABC', disabled: true },
      translate: { apiKey: 'key1234', status: 'configured', monthlyCharLimit: 123 },
    })
    findGlobal.mockResolvedValue({ googleTranslateApiKeyEncrypted: 'broken' })
    expect((await getIntegrations(payload)).translate).toEqual({
      apiKey: null,
      status: 'undecryptable',
      monthlyCharLimit: 450000,
    })
  })
})
