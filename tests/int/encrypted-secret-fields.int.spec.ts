// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { protectIntegrationSecrets } from '@/SiteSettings/fields/integrations'
import { openSecret } from '@/utilities/secretBox'

const secret = 'isolated-shared-secret-fields-32-characters'
const run = (data: Record<string, unknown>, role = 'admin') =>
  protectIntegrationSecrets({ data, req: { user: { role }, payload: { secret } } } as never)

describe('shared encrypted integration fields', () => {
  beforeEach(() => vi.stubEnv('SMTP_HOST', ''))
  afterEach(() => vi.unstubAllEnvs())
  it('preserves dormant SMTP credentials and rejects password changes during env override', () => {
    vi.stubEnv('SMTP_HOST', 'env-smtp.example.test')
    const data = {
      smtpPasswordEncrypted: 'stored-ciphertext',
      smtpPasswordLast4: '1234',
      smtpPasswordInput: '',
      smtpPasswordClear: false,
    }
    run(data)
    expect(data).toEqual({ smtpPasswordEncrypted: 'stored-ciphertext', smtpPasswordLast4: '1234' })
    for (const input of [{ smtpPasswordInput: 'new' }, { smtpPasswordClear: true }]) {
      let error: unknown
      try {
        run(input)
      } catch (caught) {
        error = caught
      }
      expect(error).toMatchObject({
        data: {
          errors: [
            {
              path: 'smtpPasswordInput',
              message: 'Environment variables currently override these settings.',
            },
          ],
        },
      })
    }
    const google = { googleTranslateApiKeyInput: 'google1234' } as Record<string, unknown>
    run(google)
    expect(openSecret(google.googleTranslateApiKeyEncrypted as string, secret)).toEqual({
      ok: true,
      value: 'google1234',
    })
  })
  it('handles SMTP replacement with exact password whitespace and deletes virtual values', () => {
    const data = { smtpPasswordInput: ' password 1234 ' } as Record<string, unknown>
    run(data)
    expect(openSecret(data.smtpPasswordEncrypted as string, secret)).toEqual({
      ok: true,
      value: ' password 1234 ',
    })
    expect(data.smtpPasswordLast4).toBe('234 ')
    expect(data).not.toHaveProperty('smtpPasswordInput')
  })
  it('clears SMTP storage and rejects replace plus clear', () => {
    const data = { smtpPasswordClear: true } as Record<string, unknown>
    run(data)
    expect(data).toEqual({ smtpPasswordEncrypted: null, smtpPasswordLast4: null })
    expect(() => run({ smtpPasswordInput: 'new', smtpPasswordClear: true })).toThrow()
  })
  it('rejects editor SMTP changes even for trusted Local API calls', () => {
    expect(() => run({ smtpPasswordInput: 'attacker' }, 'editor')).toThrow()
    expect(() => run({ smtpPasswordClear: true }, 'editor')).toThrow()
  })
  it('keeps Google trimming, empty-save and clear behavior', () => {
    const data = { googleTranslateApiKeyInput: '  google1234  ' } as Record<string, unknown>
    run(data)
    expect(openSecret(data.googleTranslateApiKeyEncrypted as string, secret)).toEqual({
      ok: true,
      value: 'google1234',
    })
    const empty = { googleTranslateApiKeyInput: '  ', googleTranslateApiKeyClear: false } as Record<
      string,
      unknown
    >
    run(empty)
    expect(empty).toEqual({})
    const clear = { googleTranslateApiKeyClear: true } as Record<string, unknown>
    run(clear)
    expect(clear).toEqual({
      googleTranslateApiKeyEncrypted: null,
      googleTranslateApiKeyLast4: null,
    })
  })
})
