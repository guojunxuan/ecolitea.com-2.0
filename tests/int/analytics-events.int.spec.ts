import { afterEach, describe, expect, it, vi } from 'vitest'

import { trackEvent } from '@/consent/analytics'

afterEach(() => {
  vi.unstubAllGlobals()
  delete window.dataLayer
})

describe('business analytics events', () => {
  it('queues only the supplied event metadata before GTM loads', () => {
    delete window.dataLayer
    trackEvent('quote_submit', { product_slug: 'paper-bag' })
    trackEvent('form_submit', { form_title: 'Wholesale inquiry' })
    trackEvent('file_download', { file_name: 'catalog.pdf', product_slug: 'paper-bag' })
    trackEvent('contact_click', { method: 'email' })
    trackEvent('contact_click', { method: 'phone' })
    expect(window.dataLayer).toEqual([
      { event: 'quote_submit', product_slug: 'paper-bag' },
      { event: 'form_submit', form_title: 'Wholesale inquiry' },
      { event: 'file_download', file_name: 'catalog.pdf', product_slug: 'paper-bag' },
      { event: 'contact_click', method: 'email' },
      { event: 'contact_click', method: 'phone' },
    ])
  })

  it('preserves prior queued consent commands and events', () => {
    const prior = { event: 'previous' }
    window.dataLayer = [prior]
    trackEvent('contact_click', { method: 'phone' })
    expect(window.dataLayer).toEqual([prior, { event: 'contact_click', method: 'phone' }])
  })

  it('does nothing during server rendering', () => {
    vi.stubGlobal('window', undefined)
    expect(() => trackEvent('contact_click', { method: 'email' })).not.toThrow()
  })

  it('does not interrupt an action if a third-party data layer fails', () => {
    window.dataLayer = []
    window.dataLayer.push = () => {
      throw new Error('Tag unavailable')
    }
    expect(() => trackEvent('contact_click', { method: 'email' })).not.toThrow()
  })
})
