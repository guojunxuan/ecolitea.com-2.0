import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConsentProvider, useConsent } from '@/consent/ConsentProvider'
import { serializeConsent } from '@/consent/cookie'

function Probe() {
  const consent = useConsent()
  return <>
    {consent.bannerVisible && <div role="region" aria-label="Cookie consent" />}
    <output>{JSON.stringify(consent.state)}</output>
    <button onClick={consent.acceptAll}>Accept</button>
    <button onClick={consent.rejectOptional}>Reject</button>
    <button onClick={consent.dismissBanner}>Dismiss</button>
  </>
}
const mount = (gtmDisabled = false) => render(<ConsentProvider gtmDisabled={gtmDisabled}><Probe /></ConsentProvider>)
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_GTM_MEASUREMENT_ID', 'GTM-TEST000')
  for (const cookie of document.cookie.split(';')) document.cookie = `${cookie.split('=')[0].trim()}=; Path=/; Max-Age=0`
  document.querySelectorAll('script[data-ecolitea-gtm]').forEach((script) => script.remove())
  delete window.dataLayer
  delete window.gtag
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false })
})
afterEach(() => { cleanup(); vi.unstubAllEnvs() })

describe('ConsentProvider', () => {
  it('shows the undecided banner after mount and dismisses only in memory', () => {
    mount()
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).not.toBeNull()
    fireEvent.click(screen.getByText('Dismiss'))
    expect(screen.queryByRole('region')).toBeNull()
    expect(document.cookie).not.toContain('ec_consent=')
    expect(document.querySelector('script[data-ecolitea-gtm]')).toBeNull()
  })
  it.each([true, false])('restores a valid decision with analytics=%s', (analytics) => {
    document.cookie = `ec_consent=${serializeConsent({ analytics, marketing: false, decidedAt: new Date().toISOString() })}; Path=/`
    mount()
    expect(screen.queryByRole('region')).toBeNull()
    expect(!!document.querySelector('script[data-ecolitea-gtm]')).toBe(analytics)
  })
  it('accepts all with GPC marketing forced off and persists the effective state', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
    mount()
    fireEvent.click(screen.getByText('Accept'))
    expect(screen.getByRole('status').textContent).toContain('"marketing":false')
    expect(decodeURIComponent(document.cookie)).toContain('"analytics":true')
    expect(screen.queryByRole('region')).toBeNull()
  })
  it('persists rejection and never loads while disabled', () => {
    mount(true)
    fireEvent.click(screen.getByText('Accept'))
    expect(document.querySelector('script[data-ecolitea-gtm]')).toBeNull()
    fireEvent.click(screen.getByText('Reject'))
    expect(decodeURIComponent(document.cookie)).toContain('"analytics":false,"marketing":false')
  })
})
