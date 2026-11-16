import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import en from '@/i18n/dictionaries/en.json'
import { getDictionary } from '@/i18n/getDictionary'
import { DictionaryProvider } from '@/i18n/DictionaryProvider'
import { CookieSettingsButton } from '@/consent/CookieSettingsButton'
import { ConsentProvider } from '@/consent/ConsentProvider'
import { QuoteRequestDialog } from '@/components/Products/QuoteRequest/QuoteRequestDialog'

vi.mock('@/i18n/getI18nSettings', () => ({
  getI18nSettings: async () => {
    const config = (await import('@/i18n/config')) as unknown as {
      publicLocales?: unknown[]
      targetLocales?: unknown[]
    }
    return { publicLocales: [], targetLocales: config.targetLocales, regions: [] }
  },
}))
vi.mock('@/i18n/config', () => ({
  sourceLocale: 'en',
  targetLocales: [{ code: 'de', status: 'live' }],
}))
vi.mock('@/components/Products/QuoteRequest/TurnstileWidget', () => ({
  TurnstileWidget: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken('stub-token')}>
      Pass verification
    </button>
  ),
}))
const translations = (fields: Record<string, string>) => {
  const find = vi.fn(async () => ({ docs: [{ fields, lastReadySourceVersion: 'ready-version' }] }))
  return { payload: { find } as unknown as Payload, find }
}
const priorShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
  })
})
afterEach(() => {
  cleanup()
  if (priorShowModal)
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', priorShowModal)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
describe('frontend dictionary delivery', () => {
  it('returns the exact English copy without querying Payload', async () => {
    const { payload, find } = translations({})
    expect(await getDictionary('en', { payload })).toEqual(en)
    expect(find).not.toHaveBeenCalled()
  })
  it('reads German fields and falls back for each missing key', async () => {
    const { payload } = translations({
      'consent.settings': 'Cookie-Einstellungen',
      'quote.title': 'Angebot anfordern',
    })
    const dictionary = await getDictionary('de', { payload })
    expect(dictionary.consent.settings).toBe('Cookie-Einstellungen')
    expect(dictionary.quote.title).toBe('Angebot anfordern')
    expect(dictionary.quote.errors.emailInvalid).toBe(en.quote.errors.emailInvalid)
    expect(dictionary.quote.emailPlaceholder).toBe('name@company.com')
  })
  it('falls back to English when the dictionary has no ready checkpoint', async () => {
    const payload = { find: vi.fn(async () => ({ docs: [] })) } as unknown as Payload
    expect(await getDictionary('de', { payload })).toEqual(en)
  })
  it('delivers translated copy to consent and Quote clients, including validation', async () => {
    vi.stubEnv('NEXT_PUBLIC_GTM_MEASUREMENT_ID', '')
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '')
    const { payload } = translations({
      'consent.settings': 'Cookie-Einstellungen',
      'quote.trigger': 'Angebot anfordern',
      'quote.title': 'Ihr Angebot',
      'quote.nameLabel': 'Name DE',
      'quote.send': 'Senden',
      'quote.errors.nameRequired': 'Name ist erforderlich.',
    })
    render(
      <DictionaryProvider dictionary={await getDictionary('de', { payload })}>
        <ConsentProvider gtmDisabled>
          <CookieSettingsButton />
          <QuoteRequestDialog product={{ title: 'Tee', slug: 'tea' }} />
        </ConsentProvider>
      </DictionaryProvider>,
    )
    expect(screen.getByRole('button', { name: 'Cookie-Einstellungen' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Angebot anfordern' }))
    expect(screen.getByRole('heading', { name: 'Ihr Angebot' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }))
    expect(screen.getByText('Name ist erforderlich.')).toBeTruthy()
  })
  it('preserves translated confirmation templates and product emphasis', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'stub-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })),
    )
    const { payload } = translations({
      'quote.successTitle': 'Danke, {name}!',
      'quote.successMessage': 'Ihre Anfrage für {product} ist eingegangen.',
    })
    render(
      <DictionaryProvider dictionary={await getDictionary('de', { payload })}>
        <QuoteRequestDialog product={{ title: 'Tee', slug: 'tea' }} />
      </DictionaryProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Request a quote' }))
    for (const [name, value] of [
      ['Name', 'Ada'],
      ['Company', 'Example'],
      ['Work email', 'ada@example.invalid'],
      ['Message', '500 units'],
    ]) {
      fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Pass verification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Danke, Ada!' })).toBeTruthy())
    expect(screen.getByText('Tee').closest('p')?.textContent).toBe(
      'Ihre Anfrage für Tee ist eingegangen.',
    )
    expect(screen.getByText('Tee').tagName).toBe('STRONG')
  })
})
