import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { UsedInPanel as MediaPanel } from '@/collections/mediaAdmin/UsedInPanel'
import { UsedInPanel as DocumentsPanel } from '@/collections/Documents/admin/UsedInPanel'

let id: string | undefined = 'resource-1'
vi.mock('@payloadcms/ui', () => ({
  useDocumentInfo: () => ({ id }),
  useConfig: () => ({
    config: {
      routes: { api: '/custom-api' },
      collections: [{ slug: 'blogs', labels: { singular: 'Blog' } }],
      globals: [{ slug: 'header', label: 'Header' }],
    },
  }),
  Button: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  FieldLabel: ({ label }: { label: string }) => <span>{label}</span>,
  FieldDescription: ({ description }: { description: string }) => <p>{description}</p>,
  Pill: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Link: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
  ShimmerEffect: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  Banner: ({ children }: { children: React.ReactNode }) => <aside>{children}</aside>,
}))
const reference = (index: number, extra = {}) => ({
  mediaID: 'resource-1',
  documentID: `blog-${index}`,
  ownerDocumentID: `blog-${index}`,
  ownerType: 'collection',
  ownerSlug: 'blogs',
  kind: 'current',
  title: `Tea story ${index}`,
  path: 'heroImage',
  editURL: `/admin/collections/blogs/blog-${index}`,
  ...extra,
})
const response = (current: unknown[] = [], historicalCount = 0) => ({
  ok: true,
  json: async () => ({ current, historicalCount }),
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  id = 'resource-1'
})

describe.each([
  ['media', MediaPanel],
  ['documents', DocumentsPanel],
] as const)('%s Used in panel', (collection, Panel) => {
  it('deduplicates owners, labels their types and hides field paths', async () => {
    const fetch = vi.fn(async () =>
      response(
        [
          reference(1),
          reference(1, { path: 'layout.0.media' }),
          reference(2, {
            ownerType: 'global',
            ownerSlug: 'header',
            title: 'Header',
            editURL: '/admin/globals/header',
          }),
        ],
        3,
      ),
    )
    vi.stubGlobal('fetch', fetch)
    render(<Panel />)
    expect((await screen.findByRole('link', { name: 'Tea story 1' })).getAttribute('href')).toBe(
      '/admin/collections/blogs/blog-1',
    )
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByText('Blog')).toBeTruthy()
    expect(screen.getByText('Global')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.queryByText(/heroImage|layout\.0/)).toBeNull()
    expect(screen.getByText('Remove it from these places before deleting.')).toBeTruthy()
    expect(screen.getByText("Also in 3 older versions — these don't block deletion.")).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith(
      `/custom-api/${collection}/resource-1/references`,
      expect.objectContaining({ credentials: 'same-origin', signal: expect.any(AbortSignal) }),
    )
  })
  it('shows five unique owners initially and expands the remainder', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response([
          reference(1),
          reference(1, { path: 'caption' }),
          ...Array.from({ length: 7 }, (_, i) => reference(i + 2)),
        ]),
      ),
    )
    render(<Panel />)
    const expand = await screen.findByRole('button', { name: 'Show all 8' })
    expect(screen.getAllByRole('link')).toHaveLength(5)
    fireEvent.click(expand)
    expect(screen.getAllByRole('link')).toHaveLength(8)
    expect(screen.queryByRole('button', { name: 'Show all 8' })).toBeNull()
  })
  it.each([0, 2])('treats %i older versions as nonblocking when unused', async (count) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response([], count)),
    )
    render(<Panel />)
    expect(await screen.findByText('Not used anywhere. It can be deleted.')).toBeTruthy()
    expect(screen.queryByText('0')).toBeNull()
    expect(Boolean(screen.queryByText(/Also in/))).toBe(count > 0)
  })
  it('shows a loading state, then offers retry after an error', async () => {
    let reject!: (reason: Error) => void
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((_, fail) => {
              reject = fail
            }),
        )
        .mockResolvedValueOnce(response()),
    )
    render(<Panel />)
    expect(screen.getByRole('status', { name: 'Loading usage' })).toBeTruthy()
    expect(screen.queryByText('Not used anywhere. It can be deleted.')).toBeNull()
    reject(new Error('offline'))
    expect(await screen.findByText("Couldn't load where this is used.")).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Not used anywhere. It can be deleted.')).toBeTruthy()
    expect(screen.queryByText("Couldn't load where this is used.")).toBeNull()
  })
  it('renders nothing for an unsaved resource', () => {
    id = undefined
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { container } = render(<Panel />)
    expect(container.childElementCount).toBe(0)
    expect(fetch).not.toHaveBeenCalled()
  })
})
