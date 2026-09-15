import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { HeaderNavigationBlockData } from '@/Header/Nav/types'

vi.mock('@/components/Media', () => ({
  Media: ({ resource, presentation }: { resource: unknown; presentation?: unknown }) => (
    <div data-media={resource ? 'loaded' : 'reserved'} data-presentation={JSON.stringify(presentation)} />
  ),
}))

import { NavigationBlocks } from '@/Header/Nav/NavigationBlocks'

const card = (id: string, title: string) => ({
  id,
  image: null,
  link: { href: `/products/${id}`, label: title, newTab: false, type: 'custom' as const },
  title,
})

afterEach(cleanup)

describe('Header navigation block rendering', () => {
  it('keeps each visual card as one anchor with reserved media and puts CTA outside cards', () => {
    const block: HeaderNavigationBlockData = {
      cards: [card('one', 'First card'), card('two', 'Second card')],
      cta: { href: '/all', label: 'View all', newTab: false, type: 'custom' },
      heading: 'Featured',
      id: 'featured',
      type: 'cardGroup',
    }

    render(<NavigationBlocks blocks={[block]} />)

    const cardLinks = screen.getAllByRole('link', { name: /card$/i })
    expect(cardLinks).toHaveLength(2)
    expect(cardLinks[0].querySelector('[data-media="reserved"]')).toBeTruthy()
    expect(cardLinks[0].textContent).toContain('First card')
    expect(screen.getByRole('link', { name: 'View all' }).closest('a')).not.toBe(cardLinks[0])
  })

  it('renders rich card descriptions only when nonblank and uses contained 4:3 media', () => {
    const block: HeaderNavigationBlockData = {
      card: card('rich', 'Rich title'),
      description: 'Helpful description',
      id: 'rich-block',
      type: 'richCard',
    }

    render(<NavigationBlocks blocks={[block]} />)

    expect(screen.getByText('Helpful description')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Rich title/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Rich title/ }).querySelector('[data-media]')?.getAttribute('data-presentation')).toBe(
      JSON.stringify({ image: { aspectRatio: { width: 4, height: 3 }, fit: 'contain' } }),
    )
  })
})
