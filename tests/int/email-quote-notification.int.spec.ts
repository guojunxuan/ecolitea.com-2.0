// @vitest-environment node
import type { CollectionAfterChangeHook, PayloadRequest, SendEmailOptions } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { QuoteRequests } from '@/collections/QuoteRequests'
import type { QuoteRequest } from '@/payload-types'

const quote: QuoteRequest = {
  id: 'quote-123',
  name: 'Ada <script>alert("name")</script>',
  email: "ada'o@example.invalid",
  company: 'Tea & Co\r\nBcc: hidden@example.invalid',
  message: '<img src=x onerror=alert(1)>\nNeed "500" units & samples.',
  productTitle: 'Paper <Bag>\r\nInjected: header',
  productSlug: 'paper-bag',
  status: 'new',
  createdAt: '2026-11-17T00:00:00.000Z',
  updatedAt: '2026-11-17T00:00:00.000Z',
}

const setup = (settings: Record<string, unknown> = {}) => {
  const messages: SendEmailOptions[] = []
  const payload = {
    config: { serverURL: 'https://cms.example.invalid/', routes: { admin: '/manage' } },
    findGlobal: vi.fn(async () => ({ salesEmail: 'sales@example.invalid', ...settings })),
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    sendEmail: vi.fn(async (message: SendEmailOptions) => {
      messages.push(message)
      return { status: 'sent' }
    }),
  }
  const req = { payload } as unknown as PayloadRequest
  const invoke = async (operation: 'create' | 'update' = 'create') => {
    const hooks = QuoteRequests.hooks?.afterChange ?? []
    expect(hooks).toHaveLength(1)
    let doc = quote
    for (const hook of hooks) {
      const result = await hook({ doc, operation, req } as Parameters<CollectionAfterChangeHook>[0])
      doc = result ?? doc
    }
    return doc
  }
  return { invoke, messages, payload, req }
}

afterEach(() => vi.useRealTimers())

describe('quote notification after successful creation', () => {
  it('sends escaped HTML, readable text, a safe subject, Reply-To and the configured Admin URL', async () => {
    const { invoke, messages, payload, req } = setup({
      quoteNotificationRecipients: [
        { email: 'team@example.invalid' },
        { email: 'other@tea.invalid' },
      ],
    })
    expect(await invoke()).toBe(quote)
    expect(payload.findGlobal).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'site-settings', overrideAccess: true, depth: 0, req }),
    )
    expect(messages).toHaveLength(1)
    const message = messages[0]
    expect(message.to).toEqual(['team@example.invalid', 'other@tea.invalid'])
    expect(message.replyTo).toBe(quote.email)
    expect(message.subject).toBe(
      'New quote request: Paper <Bag>Injected: header — Tea & CoBcc: hidden@example.invalid',
    )
    expect(message.subject).not.toMatch(/[\r\n]/)
    expect(message.html).toContain('Paper &lt;Bag&gt;')
    expect(message.html).toContain('Ada &lt;script&gt;alert(&quot;name&quot;)&lt;/script&gt;')
    expect(message.html).toContain('ada&#39;o@example.invalid')
    expect(message.html).toContain('Tea &amp; Co')
    expect(message.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(message.html).not.toContain('<script>')
    expect(message.html).not.toContain('<img')
    for (const value of [
      quote.name,
      quote.email,
      quote.company,
      quote.message,
      quote.productSlug,
    ]) {
      expect(message.text).toContain(value)
    }
    expect(message.html).toContain(
      'https://cms.example.invalid/manage/collections/quote-requests/quote-123',
    )
    expect(message.text).toContain(
      'https://cms.example.invalid/manage/collections/quote-requests/quote-123',
    )
  })

  it.each([undefined, []])('falls back to salesEmail with recipients %s', async (recipients) => {
    const { invoke, messages } = setup({ quoteNotificationRecipients: recipients })
    await invoke()
    expect(messages[0].to).toEqual(['sales@example.invalid'])
  })

  it('does not send on updates', async () => {
    const { invoke, payload } = setup()
    expect(await invoke('update')).toBe(quote)
    expect(payload.findGlobal).not.toHaveBeenCalled()
    expect(payload.sendEmail).not.toHaveBeenCalled()
  })

  it('does not send when notifications are disabled', async () => {
    const { invoke, payload } = setup({ quoteNotificationsEnabled: false })
    expect(await invoke()).toBe(quote)
    expect(payload.sendEmail).not.toHaveBeenCalled()
  })

  it('warns safely when no recipient exists', async () => {
    const { invoke, payload } = setup({ salesEmail: null })
    expect(await invoke()).toBe(quote)
    expect(payload.sendEmail).not.toHaveBeenCalled()
    expect(payload.logger.warn).toHaveBeenCalledOnce()
    expect(JSON.stringify(payload.logger.warn.mock.calls)).not.toContain(quote.message)
  })

  it('isolates a settings lookup failure from the saved quote', async () => {
    const { invoke, payload } = setup()
    payload.findGlobal.mockRejectedValueOnce(new Error('smtp://credential:secret@private.invalid'))
    expect(await invoke()).toBe(quote)
    expect(payload.sendEmail).not.toHaveBeenCalled()
    const logs = JSON.stringify(payload.logger.warn.mock.calls)
    expect(logs).toContain('settings_lookup_failed')
    expect(logs).not.toContain('credential')
    expect(logs).not.toContain(quote.message)
  })

  it('isolates a thrown transport failure and logs only safe recipient metadata', async () => {
    const { invoke, payload } = setup()
    payload.sendEmail.mockRejectedValueOnce(new Error('password=top-secret; body=private message'))
    expect(await invoke()).toBe(quote)
    const logs = JSON.stringify(payload.logger.warn.mock.calls)
    expect(logs).toContain('delivery_failed')
    expect(logs).toContain('example.invalid')
    expect(logs).not.toContain('sales@')
    expect(logs).not.toContain('top-secret')
    expect(logs).not.toContain(quote.message)
  })

  it('isolates a nonthrowing adapter failure result', async () => {
    const { invoke, payload } = setup()
    payload.sendEmail.mockResolvedValueOnce({
      status: 'failed',
      error: 'password=top-secret',
    } as never)
    expect(await invoke()).toBe(quote)
    expect(JSON.stringify(payload.logger.warn.mock.calls)).toContain('delivery_failed')
    expect(JSON.stringify(payload.logger.warn.mock.calls)).not.toContain('top-secret')
  })

  it.each(['lookup', 'send'] as const)('bounds a hanging %s to ten seconds', async (phase) => {
    vi.useFakeTimers()
    const { invoke, payload } = setup()
    if (phase === 'lookup') payload.findGlobal.mockImplementation(() => new Promise(() => {}))
    else payload.sendEmail.mockImplementation(() => new Promise(() => {}))
    const pending = invoke()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await pending).toBe(quote)
    expect(JSON.stringify(payload.logger.warn.mock.calls)).toContain('timeout')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not send late when a settings lookup finishes after the deadline', async () => {
    vi.useFakeTimers()
    const { invoke, payload } = setup()
    let resolveLookup!: (value: { salesEmail: string }) => void
    payload.findGlobal.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve
        }),
    )
    const pending = invoke()
    await vi.advanceTimersByTimeAsync(10_000)
    await pending
    resolveLookup({ salesEmail: 'late@example.invalid' })
    await vi.advanceTimersByTimeAsync(0)
    expect(payload.sendEmail).not.toHaveBeenCalled()
  })
})
