import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({
  fields: { 'languages.0.code': { value: 'de' }, 'languages.0.status': { value: 'off' } },
}))
vi.mock('@payloadcms/ui', async () => {
  const { createContext } = await import('react')
  const FieldPathContext = createContext('translationStatus')
  return {
    FieldPathContext,
    useFormFields: (selector: (args: unknown[]) => unknown) => selector([fixture.fields]),
    useField: ({ path }: { path: string }) => ({
      value: 'off',
      setValue: vi.fn(),
      disabled: false,
      showError: false,
      path,
    }),
    SelectInput: ({
      path,
      label,
      Label,
    }: {
      path: string
      label: string
      Label: React.ReactNode
    }) => (
      <>
        {Label}
        <select aria-label={label} data-path={path} defaultValue="off">
          <option>off</option>
          <option>live</option>
        </select>
      </>
    ),
  }
})
import { LanguageStatusTable } from '@/plugins/translation/admin/LanguageStatusTable'
afterEach(cleanup)
it('keeps off language statistics visible and binds status to the native array path', () => {
  render(
    <LanguageStatusTable
      summary={{
        month: '2026-11',
        currentTime: 0,
        total: 2,
        characters: 0,
        limit: 100,
        reset: '2026-12-01',
        counts: [
          {
            code: 'de',
            label: 'Deutsch',
            status: 'off',
            ready: 1,
            total: 2,
            failed: 1,
            waiting: 0,
            updated: undefined,
          },
        ],
      }}
    />,
  )
  expect(screen.getByText('Deutsch')).toBeTruthy()
  expect(screen.getByText('1 / 2')).toBeTruthy()
  expect(screen.getByRole('combobox').getAttribute('data-path')).toBe('languages.0.status')
  expect(screen.getByRole('link', { name: '1 failed' }).getAttribute('href')).toContain(
    'where[locale][equals]=de&where[status][equals]=failed',
  )
})
