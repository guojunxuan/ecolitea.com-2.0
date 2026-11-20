import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Where } from 'payload'

const { find } = vi.hoisted(() => ({ find: vi.fn() }))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: async () => ({ find }),
}))
vi.mock('@/search/Component', () => ({ Search: () => <input aria-label="Search" /> }))
vi.mock('@/components/Media', () => ({ Media: () => <div /> }))
vi.mock('@/utilities/useClickableCard', () => ({
  default: () => ({ cardRef: { current: null }, linkRef: { current: null } }),
}))

import SearchPage from '@/app/(frontend)/[lang]/search/page'

afterEach(cleanup)

describe('site search results', () => {
  it('links Blog results and searches their excerpt', async () => {
    find.mockResolvedValue({
      totalDocs: 1,
      docs: [
        {
          title: 'Tea Notes',
          slug: 'tea-notes',
          excerpt: 'An oolong guide',
          heroImage: 'image-1',
          meta: { description: 'Custom SEO summary without the excerpt term' },
          category: { title: 'Brewing', slug: 'brewing' },
          doc: { relationTo: 'blogs', value: 'blog-1' },
        },
      ],
    })

    render(await SearchPage({ searchParams: Promise.resolve({ q: 'oolong' }) }))

    expect(screen.getByRole('link', { name: 'Tea Notes' }).getAttribute('href')).toBe(
      '/blogs/tea-notes',
    )
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'search',
        overrideAccess: false,
        select: expect.objectContaining({
          doc: true,
          excerpt: true,
          category: true,
          heroImage: true,
        }),
        where: expect.objectContaining({
          and: expect.arrayContaining([
            expect.objectContaining({
              or: expect.arrayContaining([{ excerpt: { like: 'oolong' } }]),
            }),
          ]),
        }),
      }),
    )
  })

  it.each([true, false])(
    'uses current categories by ID after rename or deletion (exists=%s)',
    async (exists) => {
      find.mockImplementation(async ({ collection }) =>
        collection === 'search'
          ? {
              docs: [
                {
                  title: 'Tea Notes',
                  slug: 'tea-notes',
                  excerpt: 'Tea guide',
                  category: { categoryID: 'cat-1', title: 'Old title', slug: 'old-slug' },
                  doc: { relationTo: 'blogs', value: 'blog-1' },
                },
              ],
            }
          : { docs: exists ? [{ id: 'cat-1', title: 'New title', slug: 'new-slug' }] : [] },
      )
      render(await SearchPage({ searchParams: Promise.resolve({ q: 'tea' }) }))
      expect(screen.queryByRole('link', { name: 'Old title' })).toBeNull()
      if (exists)
        expect(screen.getByRole('link', { name: 'New title' }).getAttribute('href')).toBe(
          '/blogs/category/new-slug',
        )
      else expect(screen.queryByRole('link', { name: 'New title' })).toBeNull()
      expect(screen.getByRole('link', { name: 'Tea Notes' }).getAttribute('href')).toBe(
        '/blogs/tea-notes',
      )
    },
  )

  it.each(['tea', ''])(
    'filters products and future articles before the result limit (q=%s)',
    async (q) => {
      const fixtures = [
        ...Array.from({ length: 13 }, (_, index) => ({
          title: `Tea product ${index}`,
          slug: `tea-product-${index}`,
          publishedAt: '2020-01-01T00:00:00.000Z',
          doc: { relationTo: 'products', value: `product-${index}` },
        })),
        {
          title: 'Tea article',
          slug: 'tea-article',
          excerpt: 'Tea guide',
          publishedAt: '2020-01-01T00:00:00.000Z',
          doc: { relationTo: 'blogs', value: 'blog-article' },
        },
        {
          title: 'Future tea article',
          slug: 'future-tea-article',
          publishedAt: '2999-01-01T00:00:00.000Z',
          doc: { relationTo: 'blogs', value: 'blog-future' },
        },
      ]
      // Apply the actual consumer's predicate BEFORE limit, like the database.
      const matches = (row: (typeof fixtures)[number], where: Where): boolean =>
        Object.entries(where).every(([field, condition]) => {
          if (field === 'and') return (condition as Where[]).every((clause) => matches(row, clause))
          if (field === 'or') return (condition as Where[]).some((clause) => matches(row, clause))
          const value = field
            .split('.')
            .reduce<unknown>(
              (item, key) =>
                item && typeof item === 'object'
                  ? (item as Record<string, unknown>)[key]
                  : undefined,
              row,
            )
          return Object.entries(condition as Record<string, unknown>).every(
            ([operator, expected]) => {
              if (operator === 'equals') return value === expected
              if (operator === 'in') return (expected as unknown[]).includes(value)
              if (operator === 'less_than_equal')
                return typeof value === 'string' && value <= String(expected)
              if (operator === 'like')
                return (
                  typeof value === 'string' &&
                  value.toLowerCase().includes(String(expected).toLowerCase())
                )
              throw new Error(`Unsupported fixture operator: ${operator}`)
            },
          )
        })
      find.mockImplementation(async ({ collection, where, limit }) => {
        expect(collection).toBe('search')
        return { docs: fixtures.filter((row) => matches(row, where)).slice(0, limit) }
      })
      render(await SearchPage({ searchParams: Promise.resolve({ q }) }))
      expect(screen.getByRole('link', { name: 'Tea article' }).getAttribute('href')).toBe(
        '/blogs/tea-article',
      )
      expect(screen.queryByRole('link', { name: 'Future tea article' })).toBeNull()
      expect(screen.queryByRole('link', { name: /Tea product/ })).toBeNull()
      expect(screen.queryByText('No results found.')).toBeNull()
    },
  )

  it('shows the empty message when there are no matching blogs', async () => {
    find.mockResolvedValue({ totalDocs: 0, docs: [] })
    render(await SearchPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByText('No results found.')).toBeTruthy()
  })
})
