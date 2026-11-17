// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { isSmtpEmailAddress, parseServerEnv, parseSmtpEnv } from '@/utilities/env'

const serverBase = {
  DATABASE_URI: 'mongodb://127.0.0.1:27017/ecolitea2-test',
  PAYLOAD_SECRET: 'email-env-test-secret',
  NEXT_PUBLIC_SERVER_URL: 'https://server.example.invalid',
  CRON_SECRET: 'email-env-test-cron',
  PREVIEW_SECRET: 'email-env-test-preview',
  R2_BUCKET: 'email-env-test-bucket',
  R2_ACCESS_KEY_ID: 'email-env-test-access',
  R2_SECRET_ACCESS_KEY: 'email-env-test-secret',
  R2_ENDPOINT: 'https://storage.example.invalid',
  R2_PUBLIC_URL: 'https://media.example.invalid',
}

describe('SMTP environment parsing', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it.each([undefined, '', ' \t '])('ignores the entire group without SMTP_HOST (%s)', (host) => {
    expect(
      parseSmtpEnv({
        SMTP_HOST: host,
        SMTP_PORT: 'invalid',
        SMTP_SECURE: 'invalid',
        SMTP_FROM_ADDRESS: 'invalid',
      }),
    ).toBeUndefined()
  })

  it('uses SMTP defaults and does not fill absent fields from another source', () => {
    expect(parseSmtpEnv({ SMTP_HOST: ' smtp.example.invalid ' })).toEqual({
      host: 'smtp.example.invalid',
      port: 587,
      security: 'starttls',
    })
  })

  it('normalizes text settings while preserving the exact password', () => {
    expect(
      parseSmtpEnv({
        SMTP_HOST: ' smtp.example.invalid ',
        SMTP_PORT: ' 465 ',
        SMTP_SECURE: ' tls ',
        SMTP_USER: ' mailer ',
        SMTP_PASSWORD: ' password with spaces ',
        SMTP_FROM_ADDRESS: ' sender@example.invalid ',
        SMTP_FROM_NAME: ' Ecolitea ',
      }),
    ).toEqual({
      host: 'smtp.example.invalid',
      port: 465,
      security: 'tls',
      user: 'mailer',
      password: ' password with spaces ',
      fromAddress: 'sender@example.invalid',
      fromName: 'Ecolitea',
    })
  })

  it('treats blank optional values as absent and empty port/security as defaults', () => {
    expect(
      parseSmtpEnv({
        SMTP_HOST: 'smtp.example.invalid',
        SMTP_PORT: ' ',
        SMTP_SECURE: ' ',
        SMTP_USER: ' ',
        SMTP_PASSWORD: '',
        SMTP_FROM_ADDRESS: ' ',
        SMTP_FROM_NAME: ' ',
      }),
    ).toEqual({ host: 'smtp.example.invalid', port: 587, security: 'starttls' })
  })

  it.each(['none', 'starttls', 'tls'] as const)('accepts the %s security mode', (security) => {
    expect(
      parseSmtpEnv({ SMTP_HOST: 'smtp.example.invalid', SMTP_SECURE: security })?.security,
    ).toBe(security)
  })

  it.each(['1', '65535'])('accepts the port boundary %s', (port) => {
    expect(parseSmtpEnv({ SMTP_HOST: 'smtp.example.invalid', SMTP_PORT: port })?.port).toBe(
      Number(port),
    )
  })

  it.each(['0', '65536', '-1', '1.5', '587smtp', '1e3', '0x24b', 'Infinity'])(
    'rejects invalid SMTP_PORT %s without exposing the supplied value',
    (port) => {
      expect(() => parseSmtpEnv({ SMTP_HOST: 'smtp.example.invalid', SMTP_PORT: port })).toThrow(
        /^Invalid SMTP_PORT:/,
      )
    },
  )

  it.each(['true', 'false', 'STARTTLS', 'invalid-secret-value'])(
    'rejects an unknown SMTP_SECURE mode %s',
    (security) => {
      const parse = () => parseSmtpEnv({ SMTP_HOST: 'smtp.example.invalid', SMTP_SECURE: security })
      expect(parse).toThrow(/^Invalid SMTP_SECURE:/)
      expect(parse).not.toThrow(security)
    },
  )

  it.each(['sender@example.invalid', 'sender+quotes@sub.example.invalid', 'noreply@localhost'])(
    'accepts the sender address %s',
    (address) => {
      expect(
        parseSmtpEnv({ SMTP_HOST: 'smtp.example.invalid', SMTP_FROM_ADDRESS: address })
          ?.fromAddress,
      ).toBe(address)
    },
  )

  it.each([undefined, null, 123, '', 'sender@localhost.invalid\n', 'sender@localhost.invalid '])(
    'rejects non-address values in the shared settings validator (%s)',
    (address) => {
      expect(isSmtpEmailAddress(address)).toBe(false)
    },
  )

  it.each([
    'not-an-email',
    'sender @example.invalid',
    'sender@example..invalid',
    'sender@-example.invalid',
    'sender@example.invalid\r\nBcc: other@example.invalid',
  ])('rejects an invalid sender without exposing it', (address) => {
    const parse = () =>
      parseSmtpEnv({ SMTP_HOST: 'smtp.example.invalid', SMTP_FROM_ADDRESS: address })
    expect(parse).toThrow(/^Invalid SMTP_FROM_ADDRESS:/)
    expect(parse).not.toThrow(address)
    expect(isSmtpEmailAddress(address)).toBe(false)
  })

  it('does not validate SMTP in the startup server environment parser', () => {
    expect(
      parseServerEnv({ ...serverBase, SMTP_HOST: 'smtp.example.invalid', SMTP_PORT: 'invalid' }),
    ).toEqual({ ...serverBase, JOBS_AUTORUN: false })
  })

  it('allows importing the environment module with malformed SMTP configuration', async () => {
    vi.stubEnv('SMTP_HOST', 'smtp.example.invalid')
    vi.stubEnv('SMTP_PORT', 'invalid')
    vi.resetModules()
    await expect(import('@/utilities/env')).resolves.toHaveProperty('parseSmtpEnv')
  })
})
