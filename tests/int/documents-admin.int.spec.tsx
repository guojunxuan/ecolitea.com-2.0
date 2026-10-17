import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { formatFilesize } from 'payload/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
let file: File | undefined
let title = ''
const setValue = vi.fn((value: string) => {
  title = value
})
vi.mock('@payloadcms/ui', () => ({
  useDocumentInfo: () => ({ id: 'doc-1' }),
  useConfig: () => ({ config: { routes: { api: '/api' } } }),
  TextField: (props: { validate?: () => boolean }) => (
    <output data-validation={String(props.validate?.())} />
  ),
  useField: () => ({ value: title, setValue }),
  useFormFields: (selector: (state: unknown[]) => unknown) => selector([{ file: { value: file } }]),
}))
import { UsedInPanel } from '@/collections/Documents/admin/UsedInPanel'
import { Documents } from '@/collections/Documents'
import { TitlePrefill } from '@/collections/Documents/admin/TitlePrefill'
import { FilesizeCell } from '@/collections/Documents/admin/FilesizeCell'
const field = () => <TitlePrefill path="title" field={{ name: 'title', type: 'text' }} />
afterEach(() => {
  cleanup()
  file = undefined
  title = ''
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
describe('Documents Admin fields', () => {
  it('prefills basename without rewriting punctuation and keeps server validation authoritative', () => {
    file = new File(['x'], 'tea.certification.2026.pdf')
    render(field())
    expect(setValue).toHaveBeenCalledWith('tea.certification.2026')
    expect(document.querySelector('output')?.dataset.validation).toBe('true')
  })
  it('preserves existing editor text', () => {
    title = 'Organic certification'
    file = new File(['x'], 'scan_001.pdf')
    render(field())
    expect(setValue).not.toHaveBeenCalled()
  })
  it('allows clearing until a different File identity is selected', () => {
    file = new File(['x'], 'first.pdf')
    const view = render(field())
    title = ''
    setValue.mockClear()
    view.rerender(field())
    expect(setValue).not.toHaveBeenCalled()
    file = new File(['x'], 'first.pdf')
    view.rerender(field())
    expect(setValue).toHaveBeenCalledWith('first')
  })
  it('prefills each batch form independently', () => {
    for (const name of ['Organic certificate.pdf', '茶叶检测报告.docx']) {
      file = new File(['x'], name)
      title = ''
      const view = render(field())
      expect(setValue).toHaveBeenLastCalledWith(name.replace(/\.[^.]+$/, ''))
      view.unmount()
    }
  })
  it('uses Payload filesize formatting and handles missing metadata', () => {
    render(
      <>
        <FilesizeCell cellData={10000000} />
        <FilesizeCell />
      </>,
    )
    expect(screen.getByText(formatFilesize(10000000))).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
  })
})

describe('Documents Used in sidebar', () => {
  it('registers a native sidebar UI field', () => {
    expect(Documents.fields).toContainEqual(
      expect.objectContaining({
        name: 'usedIn',
        type: 'ui',
        admin: {
          position: 'sidebar',
          components: { Field: '@/collections/Documents/admin/UsedInPanel#UsedInPanel' },
        },
      }),
    )
  })
  it('shows current owner links and nonblocking historical count from the authenticated endpoint', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        current: [
          {
            documentID: 'doc-1',
            ownerDocumentID: 'blog-1',
            kind: 'current',
            ownerType: 'collection',
            ownerSlug: 'blogs',
            title: 'Tea certification',
            path: 'certificate',
            editURL: '/admin/collections/blogs/blog-1',
          },
        ],
        historicalCount: 3,
      }),
    }))
    vi.stubGlobal('fetch', fetch)
    render(<UsedInPanel />)
    const link = await screen.findByRole('link', { name: /Tea certification.*certificate/ })
    expect(link.getAttribute('href')).toBe('/admin/collections/blogs/blog-1')
    expect(screen.getByText(/3 historical references/)).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith(
      '/api/documents/doc-1/references',
      expect.objectContaining({ credentials: 'same-origin', signal: expect.any(AbortSignal) }),
    )
  })
  it('reports inspection errors without presenting documents as unused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false })),
    )
    render(<UsedInPanel />)
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Unable to load document references.',
    )
    expect(screen.queryByText('No current references.')).toBeNull()
  })
})
