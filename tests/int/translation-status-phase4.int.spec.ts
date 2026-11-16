import { cleanup, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
vi.mock('@/SiteSettings/integrations', () => ({
  getIntegrations: async () => ({
    gtm: { containerId: null, disabled: false },
    translate: { apiKey: null, status: 'missing', monthlyCharLimit: 123456 },
  }),
}))
vi.mock('@/plugins/translation/admin/LanguageStatusTable', () => ({
  LanguageStatusTable: () => null,
}))
vi.mock('@/plugins/translation/inventory', () => ({
  getTranslationInventory: async () => [
    { input: { sourceCollection: 'pages', sourceId: 'one' } },
    { input: { sourceCollection: 'dictionary', sourceId: 'frontend' } },
  ],
}))
vi.mock('@/i18n/getI18nSettings', () => ({
  getI18nSettings: async () => ({
    targetLocales: [],
    configuredLocales: [{ code: 'de', label: 'Deutsch', status: 'off' }],
  }),
}))
import {
  getTranslationStatus,
  TranslationStatus,
} from '@/plugins/translation/admin/TranslationStatus'
it('counts completion against the full public inventory and links problems by locale/status', async () => {
  const payload = {
    findGlobal: async () => ({ month: '2026-11', characters: 123 }),
    find: async () => ({
      docs: [
        {
          sourceCollection: 'pages',
          sourceId: 'one',
          locale: 'de',
          status: 'ready',
          lastReadySourceVersion: 'v1',
          updatedAt: '2026-11-16T00:00:00Z',
        },
        {
          sourceCollection: 'pages',
          sourceId: 'deleted',
          locale: 'de',
          status: 'ready',
          lastReadySourceVersion: 'old',
        },
        {
          sourceCollection: 'dictionary',
          sourceId: 'frontend',
          locale: 'de',
          status: 'waiting_quota',
        },
      ],
    }),
  } as unknown as Payload
  const result = await getTranslationStatus(payload, undefined, new Date('2026-11-16T00:00:00Z'))
  expect(result.characters).toBe(123)
  expect(result.limit).toBe(123456)
  expect(result.reset).toBe('2026-12-01T00:00:00.000Z')
  expect(result.counts[0]).toMatchObject({ code: 'de', total: 2, ready: 1, failed: 0, waiting: 1 })
})

it('shows an empty usage track at zero and a proportional fill at one quarter', async () => {
  let characters = 0
  const payload = {
    findGlobal: async () => ({ month: new Date().toISOString().slice(0, 7), characters }),
    find: async () => ({ docs: [] }),
  } as unknown as Payload
  const summary = await getTranslationStatus(payload)
  try {
    render(await TranslationStatus({ payload, user: { id: 'test' } as never }))
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
    expect(
      (document.querySelector('[data-translation-usage-fill]') as HTMLElement).style.width,
    ).toBe('0%')
    cleanup()
    characters = summary.limit / 4
    render(await TranslationStatus({ payload, user: { id: 'test' } as never }))
    expect(
      (document.querySelector('[data-translation-usage-fill]') as HTMLElement).style.width,
    ).toBe('25%')
  } finally {
    cleanup()
  }
})
