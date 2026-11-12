import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { QuoteRequestDialog } from '@/components/Products/QuoteRequest/QuoteRequestDialog'
import { QuoteRequestForm } from '@/components/Products/QuoteRequest/QuoteRequestForm'
import type { Media } from '@/payload-types'
import { QUOTE_LIMITS } from '@/utilities/quoteRequests/validate'

// The real widget loads Cloudflare's script. This stand-in exposes the same contract.
vi.mock('@/components/Products/QuoteRequest/TurnstileWidget', () => ({
  TurnstileWidget: ({
    onToken,
    onUnavailable,
    resetKey,
  }: {
    onToken: (token: string | null) => void
    onUnavailable: () => void
    resetKey: number
  }) => (
    <div data-testid="turnstile" data-reset-key={resetKey}>
      <button type="button" onClick={() => onToken('tok-1')}>
        Pass verification
      </button>
      <button type="button" onClick={onUnavailable}>
        Break verification
      </button>
    </div>
  ),
}))

const product = { title: 'Paper Bag', slug: 'bag' }

const fillValid = () => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Work email' }), {
    target: { value: 'ada@example.com' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Company' }), {
    target: { value: 'Lovelace Ltd' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
    target: { value: 'Need 500 units' },
  })
}

const reply = (status: number, json: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(json), { status }))

describe('QuoteRequestForm', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'test-site-key')
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('provides accessible required fields, placeholders and a live message count', () => {
    render(<QuoteRequestForm product={product} onSuccess={vi.fn()} />)
    const controls = [
      ['Name', 'Your full name'],
      ['Company', 'Company name'],
      ['Work email', 'name@company.com'],
      ['Message', 'Quantity, customization, target delivery date…'],
    ]
    for (const [label, placeholder] of controls) {
      const control = screen.getByRole('textbox', { name: label })
      expect(control.getAttribute('aria-required')).toBe('true')
      expect(control.getAttribute('placeholder')).toBe(placeholder)
      expect(
        document.querySelector(`label[for="${control.id}"] [aria-hidden="true"]`)?.textContent,
      ).toBe('*')
    }
    expect(document.querySelector('form')?.noValidate).toBe(true)
    expect(screen.getByText(`0 / ${QUOTE_LIMITS.message}`)).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Hello' },
    })
    expect(screen.getByText(`5 / ${QUOTE_LIMITS.message}`)).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Message' }).getAttribute('maxLength')).toBe(
      String(QUOTE_LIMITS.message),
    )
    fireEvent.blur(screen.getByRole('textbox', { name: 'Name' }))
    const errorId = screen.getByRole('textbox', { name: 'Name' }).getAttribute('aria-describedby')!
    expect(document.getElementById(errorId)?.textContent).toBe('Name is required.')
    expect(screen.getByText('We only use your details to respond to this request.')).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Send request' })
        .querySelector('svg')
        ?.getAttribute('aria-hidden'),
    ).toBe('true')
  })

  it('renders a populated product thumbnail through Media alongside its category', () => {
    const thumbnail = {
      id: 'image',
      url: '/bag.jpg',
      alt: 'Paper bag thumbnail',
      mimeType: 'image/jpeg',
      width: 800,
      height: 600,
      updatedAt: '2026-11-12T00:00:00Z',
      createdAt: '2026-11-12T00:00:00Z',
    } as Media
    render(
      <QuoteRequestForm
        product={{ ...product, categoryTitle: 'Packaging', thumbnail }}
        onSuccess={vi.fn()}
      />,
    )
    expect(screen.getByText('Packaging')).toBeTruthy()
    const image = screen.getByRole('img', { name: 'Paper bag thumbnail' })
    expect(image.getAttribute('data-media-kind')).toBe('image')
    expect(image.getAttribute('sizes')).toBe('48px')
    expect(screen.getByText('Paper Bag')).toBeTruthy()
  })

  it('omits the thumbnail and category when unavailable', () => {
    render(<QuoteRequestForm product={product} onSuccess={vi.fn()} />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByText('Packaging')).toBeNull()
    expect(screen.getByText('Paper Bag')).toBeTruthy()
  })

  it('keeps the category without reserving a missing thumbnail', () => {
    render(
      <QuoteRequestForm product={{ ...product, categoryTitle: 'Packaging' }} onSuccess={vi.fn()} />,
    )
    expect(screen.getByText('Packaging')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('shows the product read-only and validates fields before sending', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    render(<QuoteRequestForm product={product} onSuccess={vi.fn()} />)
    expect(screen.getByText('Paper Bag')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pass verification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    expect(screen.getByText('Name is required.')).toBeTruthy()
    expect(screen.getByText('Message is required.')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Work email' }), {
      target: { value: 'nope' },
    })
    fireEvent.blur(screen.getByRole('textbox', { name: 'Work email' }))
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('asks for verification before sending', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    render(<QuoteRequestForm product={product} onSuccess={vi.fn()} />)
    fillValid()
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    expect(screen.getByRole('alert').textContent).toContain('complete the verification')
    expect(screen.getByRole('alert').querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('posts the product slug and token, then reports success', async () => {
    const fetchSpy = reply(200, { ok: true })
    vi.stubGlobal('fetch', fetchSpy)
    const onSuccess = vi.fn()
    render(<QuoteRequestForm product={product} onSuccess={onSuccess} />)
    fillValid()
    fireEvent.click(screen.getByRole('button', { name: 'Pass verification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Sending…' }).disabled).toBe(true)
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('Ada'))
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/quote-requests/submit')
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'Ada',
      email: 'ada@example.com',
      company: 'Lovelace Ltd',
      message: 'Need 500 units',
      productSlug: 'bag',
      turnstileToken: 'tok-1',
    })
  })

  it.each([
    ['verification', 403, 'Verification failed, please try again.'],
    ['rate_limited', 429, 'Too many requests, please try again later.'],
    ['server', 500, 'Something went wrong. Please try again.'],
  ])('keeps entered values and resets verification on %s', async (code, status, message) => {
    vi.stubGlobal('fetch', reply(status, { ok: false, code }))
    const onSuccess = vi.fn()
    render(<QuoteRequestForm product={product} onSuccess={onSuccess} />)
    fillValid()
    fireEvent.click(screen.getByRole('button', { name: 'Pass verification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(message))
    expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('Ada')
    expect((screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement).value).toBe(
      'Need 500 units',
    )
    expect(screen.getByTestId('turnstile').getAttribute('data-reset-key')).toBe('1')
    expect(onSuccess).not.toHaveBeenCalled()
    // The single-use token was consumed, so submitting again requires a fresh one.
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    expect(screen.getByRole('alert').textContent).toContain('complete the verification')
  })

  it('maps server field errors back onto the fields', async () => {
    vi.stubGlobal(
      'fetch',
      reply(400, {
        ok: false,
        code: 'validation',
        fieldErrors: { email: 'Enter a valid email address.' },
      }),
    )
    render(<QuoteRequestForm product={product} onSuccess={vi.fn()} />)
    fillValid()
    fireEvent.click(screen.getByRole('button', { name: 'Pass verification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() => expect(screen.getByText('Enter a valid email address.')).toBeTruthy())
    expect(screen.getByRole('textbox', { name: 'Work email' }).getAttribute('aria-invalid')).toBe(
      'true',
    )
  })

  it('shows a server product error even though the product is read-only', async () => {
    vi.stubGlobal(
      'fetch',
      reply(400, {
        ok: false,
        code: 'validation',
        fieldErrors: { productSlug: 'Product not found.' },
      }),
    )
    render(<QuoteRequestForm product={product} onSuccess={vi.fn()} />)
    fillValid()
    fireEvent.click(screen.getByRole('button', { name: 'Pass verification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Product not found.'))
  })

  it('does not submit a previously issued token after verification becomes unavailable', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    render(<QuoteRequestForm product={product} onSuccess={vi.fn()} />)
    fillValid()
    fireEvent.click(screen.getByRole('button', { name: 'Pass verification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Break verification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('Verification is unavailable')
  })

  it('treats a network failure as a retryable server error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    )
    render(<QuoteRequestForm product={product} onSuccess={vi.fn()} />)
    fillValid()
    fireEvent.click(screen.getByRole('button', { name: 'Pass verification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('Something went wrong. Please try again.'),
    )
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Send request' }).disabled).toBe(
      false,
    )
  })

  it('explains when verification cannot load or no site key is configured', () => {
    render(<QuoteRequestForm product={product} onSuccess={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Break verification' }))
    expect(screen.getByRole('alert').textContent).toContain('Verification is unavailable')
    cleanup()
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '')
    render(<QuoteRequestForm product={product} onSuccess={vi.fn()} />)
    expect(screen.getByRole('alert').textContent).toContain('Verification is unavailable')
    expect(screen.queryByTestId('turnstile')).toBeNull()
  })
})

describe('QuoteRequestDialog', () => {
  // jsdom has no modal dialog support, so model the open attribute and close event.
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'test-site-key')
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    document.documentElement.style.overflow = ''
  })
  const dialogOf = () => document.querySelector('dialog')!

  it('mounts the form only while open, labels the dialog and returns focus on close', () => {
    render(<QuoteRequestDialog product={product} />)
    const trigger = screen.getByRole('button', { name: 'Request a quote' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(screen.queryByTestId('turnstile')).toBeNull()

    fireEvent.click(trigger)
    const dialog = dialogOf()
    expect(dialog.hasAttribute('open')).toBe(true)
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(dialog.getAttribute('aria-labelledby')).toBe(
      within(dialog).getByRole('heading', { name: 'Request a quote', hidden: true }).id,
    )
    expect(within(dialog).getByText('Paper Bag')).toBeTruthy()
    expect(screen.getByTestId('turnstile')).toBeTruthy()
    expect(screen.getByText('Get pricing')).toBeTruthy()
    expect(
      screen.getByText(
        'Tell us what you need and our team will reply with pricing and lead times.',
      ),
    ).toBeTruthy()
    expect(document.activeElement).toBe(
      within(dialog).getByRole('heading', { name: 'Request a quote' }),
    )

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close', hidden: true }))
    expect(dialog.hasAttribute('open')).toBe(false)
    expect(document.documentElement.style.overflow).toBe('')
    expect(document.activeElement).toBe(trigger)
    expect(screen.queryByTestId('turnstile')).toBeNull()
  })

  it('closes on a backdrop click but not on a click inside the panel', () => {
    render(<QuoteRequestDialog product={product} />)
    fireEvent.click(screen.getByRole('button', { name: 'Request a quote' }))
    const dialog = dialogOf()
    fireEvent.click(within(dialog).getByRole('heading', { name: 'Request a quote', hidden: true }))
    expect(dialog.hasAttribute('open')).toBe(true)
    fireEvent.click(dialog)
    expect(dialog.hasAttribute('open')).toBe(false)
  })

  it('keeps a reopened form when a dismissed submission finishes later', async () => {
    let resolveResponse!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveResponse = resolve
          }),
      ),
    )
    render(<QuoteRequestDialog product={product} />)
    const trigger = screen.getByRole('button', { name: 'Request a quote' })
    fireEvent.click(trigger)
    fillValid()
    fireEvent.click(screen.getByRole('button', { name: 'Pass verification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    fireEvent.click(within(dialogOf()).getByRole('button', { name: 'Close', hidden: true }))
    fireEvent.click(trigger)
    await act(async () => {
      resolveResponse(Response.json({ ok: true }))
    })
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeTruthy()
    expect(screen.queryByText(/We've received your request/)).toBeNull()
  })

  it.each(['Ada Lovelace', 'A'.repeat(100)])(
    'confirms success with the full trimmed name (%s)',
    async (name) => {
      vi.stubGlobal('fetch', reply(200, { ok: true }))
      render(<QuoteRequestDialog product={product} />)
      fireEvent.click(screen.getByRole('button', { name: 'Request a quote' }))
      fillValid()
      fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
        target: { value: `  ${name}  ` },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Pass verification' }))
      fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
      await waitFor(() =>
        expect(
          within(dialogOf()).getByText(/We've received your request for/, { selector: 'p' })
            .textContent,
        ).toBe("We've received your request for Paper Bag and will get back to you shortly."),
      )
      const heading = screen.getByRole('heading', { name: `Thank you, ${name}!` })
      expect(document.activeElement).toBe(heading)
      expect(dialogOf().getAttribute('aria-labelledby')).toBe(heading.id)
      expect(screen.getByText('Paper Bag').tagName).toBe('STRONG')
      expect(screen.queryByText('ada@example.com')).toBeNull()
      expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull()
      fireEvent.click(within(dialogOf()).getAllByRole('button', { name: 'Close', hidden: true })[0])
      expect(dialogOf().hasAttribute('open')).toBe(false)
      // Reopening starts from a clean form.
      fireEvent.click(screen.getByRole('button', { name: 'Request a quote' }))
      expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('')
    },
  )
})

// Exercise the actual integration separately from the form's controlled widget stand-in.
const { TurnstileWidget: RealTurnstileWidget } = await vi.importActual<
  typeof import('@/components/Products/QuoteRequest/TurnstileWidget')
>('@/components/Products/QuoteRequest/TurnstileWidget')

describe('TurnstileWidget', () => {
  afterEach(() => {
    cleanup()
    delete window.turnstile
    document
      .querySelectorAll('script[src*="challenges.cloudflare.com/turnstile"]')
      .forEach((script) => script.remove())
    vi.useRealTimers()
  })

  it('reports script failure and retries the loader on a subsequent mount', async () => {
    const onUnavailable = vi.fn()
    const { unmount } = render(
      <RealTurnstileWidget
        siteKey="test"
        resetKey={0}
        onToken={vi.fn()}
        onUnavailable={onUnavailable}
      />,
    )
    const script = document.querySelector<HTMLScriptElement>(
      'script[src*="challenges.cloudflare.com/turnstile"]',
    )!
    expect(script).toBeTruthy()
    fireEvent.error(script)
    await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1))
    unmount()
    render(
      <RealTurnstileWidget
        siteKey="test"
        resetKey={0}
        onToken={vi.fn()}
        onUnavailable={onUnavailable}
      />,
    )
    expect(
      document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]'),
    ).toBeTruthy()
    fireEvent.error(document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')!)
    await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(2))
  })

  it('reports a script that never finishes loading', async () => {
    vi.useFakeTimers()
    const onUnavailable = vi.fn()
    render(
      <RealTurnstileWidget
        siteKey="test"
        resetKey={0}
        onToken={vi.fn()}
        onUnavailable={onUnavailable}
      />,
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(onUnavailable).toHaveBeenCalledTimes(1)
  })

  it('reports a loaded script without its API', async () => {
    const onUnavailable = vi.fn()
    render(
      <RealTurnstileWidget
        siteKey="test"
        resetKey={0}
        onToken={vi.fn()}
        onUnavailable={onUnavailable}
      />,
    )
    fireEvent.load(document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')!)
    await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1))
  })

  it('uses current callbacks, clears expired tokens, resets and removes the widget', async () => {
    const renderWidget = vi.fn(() => 'widget-1')
    const reset = vi.fn()
    const remove = vi.fn()
    window.turnstile = { render: renderWidget, reset, remove }
    const onToken = vi.fn()
    const onUnavailable = vi.fn()
    const { rerender, unmount } = render(
      <RealTurnstileWidget siteKey="test" resetKey={0} onToken={vi.fn()} onUnavailable={vi.fn()} />,
    )
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1))
    rerender(
      <RealTurnstileWidget
        siteKey="test"
        resetKey={1}
        onToken={onToken}
        onUnavailable={onUnavailable}
      />,
    )
    const options = (
      renderWidget.mock.calls[0] as unknown as [
        HTMLElement,
        {
          callback: (token: string) => void
          'expired-callback': () => void
          'error-callback': () => void
        },
      ]
    )[1]
    act(() => options.callback('token'))
    act(() => options['expired-callback']())
    act(() => options['error-callback']())
    expect(onToken.mock.calls).toEqual([['token'], [null], [null]])
    expect(onUnavailable).toHaveBeenCalledTimes(1)
    expect(reset).toHaveBeenCalledWith('widget-1')
    unmount()
    expect(remove).toHaveBeenCalledWith('widget-1')
  })

  it('reports render errors and does not render after unmount', async () => {
    const onUnavailable = vi.fn()
    const renderWidget = vi.fn(() => {
      throw new Error('widget unavailable')
    })
    window.turnstile = { render: renderWidget, reset: vi.fn(), remove: vi.fn() }
    const { unmount } = render(
      <RealTurnstileWidget
        siteKey="test"
        resetKey={0}
        onToken={vi.fn()}
        onUnavailable={onUnavailable}
      />,
    )
    await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1))
    unmount()
    renderWidget.mockClear()
    const next = render(
      <RealTurnstileWidget siteKey="test" resetKey={0} onToken={vi.fn()} onUnavailable={vi.fn()} />,
    )
    next.unmount()
    await act(async () => {})
    expect(renderWidget).not.toHaveBeenCalled()
  })
})
