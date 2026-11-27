import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import LocaleLink from '@/components/LocaleLink'
import en from '@/i18n/dictionaries/en.json'
afterEach(cleanup)
describe('dictionary-supplied legal language marker', () => {
  it('renders translated marker and English href for legal links', () => {
    const dictionary = { ...en, common: { ...en.common, english: '(Englisch)' } }
    render(<LocaleProvider locale="de" legalPaths={['/privacy']} englishLabel={dictionary.common.english}><LocaleLink href="/privacy">Datenschutz</LocaleLink></LocaleProvider>)
    const link = screen.getByRole('link', { name: 'Datenschutz (Englisch)' })
    expect(link.getAttribute('href')).toBe('/privacy')
  })
  it('uses the English dictionary fallback and keeps ordinary links localized', () => {
    render(<LocaleProvider locale="de" legalPaths={['/privacy']} englishLabel={en.common.english}><LocaleLink href="/privacy">Privacy</LocaleLink><LocaleLink href="/about">About</LocaleLink></LocaleProvider>)
    expect(screen.getByRole('link', { name: 'Privacy (English)' }).getAttribute('href')).toBe('/privacy')
    expect(screen.getByRole('link', { name: 'About' }).getAttribute('href')).toBe('/de/about')
  })
})
