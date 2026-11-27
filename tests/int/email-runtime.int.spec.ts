// @vitest-environment node
import type { Payload, SendEmailOptions } from 'payload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sealSecret } from '@/utilities/secretBox'
import { getEmailConfiguration, type EmailConfiguration } from '@/plugins/email/config'
import { createEmailAdapter } from '@/plugins/email/adapter'

const secret = 'isolated-email-runtime-test-secret'
const configured: EmailConfiguration = {
  source: 'settings',
  status: 'configured',
  connection: { host: 'smtp.example.test', port: 587, security: 'starttls' },
  from: { address: 'sender@example.test', name: 'Example' },
}
function fakePayload(settings: Record<string, unknown> = {}) {
  return {
    secret,
    findGlobal: vi.fn(async () => settings),
    logger: { warn: vi.fn(), error: vi.fn() },
  } as unknown as Payload
}
beforeEach(() => {
  for (const key of [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM_ADDRESS',
    'SMTP_FROM_NAME',
  ])
    vi.stubEnv(key, undefined)
})
afterEach(() => vi.unstubAllEnvs())

describe('email configuration boundary', () => {
  it('reads the entire connection from env without querying settings', async () => {
    vi.stubEnv('SMTP_HOST', 'env.example.test')
    vi.stubEnv('SMTP_PORT', '1025')
    vi.stubEnv('SMTP_SECURE', 'none')
    vi.stubEnv('SMTP_FROM_ADDRESS', 'env@example.test')
    const payload = fakePayload({ smtpUser: 'settings-user' })
    const result = await getEmailConfiguration(payload)
    expect(result).toMatchObject({ source: 'env', status: 'configured' })
    expect(result.connection).toEqual({ host: 'env.example.test', port: 1025, security: 'none' })
    expect(result.from).toEqual({ address: 'env@example.test' })
    expect(payload.findGlobal).not.toHaveBeenCalled()
  })
  it('decrypts settings credentials through the server boundary and supplies defaults', async () => {
    vi.stubEnv('SMTP_HOST', '')
    const payload = fakePayload({
      smtpHost: 'settings.example.test',
      smtpFromAddress: 'settings@example.test',
      smtpUser: 'smtp-user',
      smtpPasswordEncrypted: sealSecret('test-password', secret),
    })
    expect(await getEmailConfiguration(payload)).toEqual({
      source: 'settings',
      status: 'configured',
      connection: {
        host: 'settings.example.test',
        port: 587,
        security: 'starttls',
        user: 'smtp-user',
        password: 'test-password',
      },
      from: { address: 'settings@example.test' },
    })
    expect(payload.findGlobal).toHaveBeenCalledWith(
      expect.objectContaining({ overrideAccess: true }),
    )
  })
  it('reports no settings, partial settings, decryption failure, and invalid env safely', async () => {
    vi.stubEnv('SMTP_HOST', '')
    expect(await getEmailConfiguration(fakePayload())).toEqual({
      source: 'none',
      status: 'missing',
    })
    expect(await getEmailConfiguration(fakePayload({ smtpHost: 'smtp.example.test' }))).toEqual({
      source: 'settings',
      status: 'missing',
    })
    expect(
      await getEmailConfiguration(
        fakePayload({
          smtpHost: 'smtp.example.test',
          smtpFromAddress: 'sender@example.test',
          smtpPasswordEncrypted: 'bad',
        }),
      ),
    ).toEqual({ source: 'settings', status: 'undecryptable' })
    expect(
      await getEmailConfiguration(
        fakePayload({ smtpHost: 'smtp.example.test', smtpFromAddress: 'not-email' }),
      ),
    ).toEqual({ source: 'settings', status: 'invalid' })
    vi.stubEnv('SMTP_HOST', 'env.example.test')
    vi.stubEnv('SMTP_PORT', '0')
    expect(await getEmailConfiguration(fakePayload())).toEqual({ source: 'env', status: 'invalid' })
  })
})

describe('dynamic email adapter', () => {
  it('resolves on send, reuses connections, refreshes sender, and replaces changed connections', async () => {
    let config = structuredClone(configured)
    const resolveConfiguration = vi.fn(async () => config)
    const messages: SendEmailOptions[] = []
    const sendMail = async (message: SendEmailOptions) => {
      messages.push(message)
    }
    const createTransport = vi.fn(() => ({ sendMail, close: vi.fn() }))
    const adapter = createEmailAdapter({ resolveConfiguration, createTransport })({
      payload: fakePayload(),
    })
    expect(resolveConfiguration).not.toHaveBeenCalled()
    const message = {
      to: 'recipient@example.test',
      subject: 'Hello',
      text: 'content',
      from: 'wrong@example.test',
    }
    expect(await adapter.sendEmail(message)).toEqual({ status: 'sent' })
    config = { ...config, from: { address: 'changed@example.test' } }
    await adapter.sendEmail(message)
    expect(createTransport).toHaveBeenCalledTimes(1)
    expect(messages[1].from).toEqual({ address: 'changed@example.test', name: '' })
    config = {
      ...config,
      connection: {
        ...config.connection!,
        host: 'changed.example.test',
        security: 'tls',
        port: 465,
      },
    }
    await adapter.sendEmail(message)
    expect(createTransport).toHaveBeenCalledTimes(2)
    expect(createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ secure: true, requireTLS: false }),
    )
    expect(messages[0].text).toBe('content')
  })
  it('skips safely when unconfigured and logs metadata without addresses or body', async () => {
    const payload = fakePayload()
    const createTransport = vi.fn()
    const adapter = createEmailAdapter({
      resolveConfiguration: async () => ({ source: 'none', status: 'missing' }),
      createTransport,
    })({ payload })
    expect(
      await adapter.sendEmail({
        to: ['person@example.test', { address: 'other@other.test', name: 'Other' }],
        subject: 'Test subject',
        text: 'private body',
      }),
    ).toMatchObject({ status: 'skipped' })
    expect(createTransport).not.toHaveBeenCalled()
    const logs = JSON.stringify(vi.mocked(payload.logger.warn).mock.calls)
    expect(logs).toContain('example.test')
    expect(logs).toContain('Test subject')
    expect(logs).not.toContain('person@')
    expect(logs).not.toContain('private body')
  })
  it('returns sanitized SMTP errors without throwing or leaking server text', async () => {
    const payload = fakePayload()
    const config = {
      ...configured,
      connection: { ...configured.connection!, user: 'login-name', password: 'ultra-secret' },
    }
    const adapter = createEmailAdapter({
      resolveConfiguration: async () => config,
      createTransport: () => ({
        sendMail: async () => {
          throw Object.assign(new Error('ultra-secret private body login-name'), {
            code: 'EAUTH',
            responseCode: 535,
          })
        },
      }),
    })({ payload })
    const result = await adapter.sendEmail({
      to: 'recipient@example.test',
      subject: `${'A'.repeat(195)}ultra-secret`,
      text: 'private body',
    })
    expect(result).toEqual({ status: 'failed', error: 'SMTP authentication failed (535).' })
    const output = JSON.stringify([result, vi.mocked(payload.logger.error).mock.calls])
    expect(output).not.toContain('ultra-secret')
    expect(output).not.toContain('ultra')
    expect(output).not.toContain('login-name')
    expect(output).not.toContain('private body')
  })
  it('logs actual recipient domains and counts when display names contain an email', async () => {
    const payload = fakePayload()
    const adapter = createEmailAdapter({
      resolveConfiguration: async () => ({ source: 'none', status: 'missing' }),
    })({ payload })
    await adapter.sendEmail({
      to: '"support@brand.test" <recipient@example.test>',
      cc: { address: 'team@other.test', name: 'The Team' },
    })
    expect(payload.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientCount: 2,
        recipientDomains: ['example.test', 'other.test'],
      }),
    )
  })
  it('bounds configuration resolution and never sends after timeout', async () => {
    let resolve!: (config: EmailConfiguration) => void
    const createTransport = vi.fn()
    const adapter = createEmailAdapter({
      timeoutMs: 10,
      resolveConfiguration: () =>
        new Promise((done) => {
          resolve = done
        }),
      createTransport,
    })({ payload: fakePayload() })
    expect(await adapter.sendEmail({ to: 'recipient@example.test' })).toEqual({
      status: 'failed',
      error: 'Email delivery timed out.',
    })
    resolve(configured)
    await new Promise((done) => setTimeout(done, 10))
    expect(createTransport).not.toHaveBeenCalled()
  })
  it('bounds transport sends and closes the timed-out transport', async () => {
    const close = vi.fn()
    let signal: AbortSignal | undefined
    const adapter = createEmailAdapter({
      timeoutMs: 10,
      resolveConfiguration: async () => configured,
      createTransport: () => ({
        sendMail: (message) => {
          signal = message.signal
          return new Promise(() => {})
        },
        close,
      }),
    })({ payload: fakePayload() })
    expect(await adapter.sendEmail({ to: 'recipient@example.test' })).toEqual({
      status: 'failed',
      error: 'Email delivery timed out.',
    })
    expect(close).toHaveBeenCalledOnce()
    expect(signal?.aborted).toBe(true)
  })
})
