import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { HeaderNavigationBlockData } from '@/Header/Nav/types'

vi.mock('@/components/Media', () => ({
  Media: ({ resource, presentation, size }: { resource: unknown; presentation?: unknown; size?: string }) => (
    <div data-media={resource ? 'loaded' : 'reserved'} data-presentation={JSON.stringify(presentation)} data-size={size} />
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
    expect(screen.getByRole('link', { name: /Rich title/ }).querySelector('[data-media]')?.getAttribute('data-size')).toContain('50vw')
  })

  it('uses composition tracks based on block density without reordering blocks', () => {
    const blocks: HeaderNavigationBlockData[] = [
      { cards: [card('one', 'One'), card('two', 'Two')], cta: null, heading: null, id: 'cards', type: 'cardGroup' },
      { heading: null, id: 'links', links: [{ id: 'link', link: { href: '/link', label: 'Link', newTab: false, type: 'custom' } }], type: 'linkGroup' },
      { card: card('rich', 'Rich'), description: null, id: 'rich', type: 'richCard' },
    ]
    const { container } = render(<NavigationBlocks blocks={blocks} />)
    expect(container.querySelector('[data-block-layout="cardGroup-two"]')).toBeTruthy()
    expect(container.querySelector('[data-block-layout="linkGroup-one"]')).toBeTruthy()
    expect(container.querySelector('[data-block-layout="richCard-two"]')).toBeTruthy()
    expect([...container.querySelectorAll('[data-navigation-block]')].map((node) => node.getAttribute('data-navigation-block'))).toEqual(['cardGroup', 'linkGroup', 'richCard'])
  })

  it('exposes accessible desktop category controls with stable panel relationships', () => {
    const block: HeaderNavigationBlockData = {
      categories: [{ cards: [card('one', 'One')], cta: null, id: 'cat-one', label: 'Category One' }],
      cta: null,
      id: 'categories',
      type: 'categoryTabs',
    }
    render(<NavigationBlocks blocks={[block]} />)
    const tab = screen.getByRole('tab', { name: 'Category One' })
    expect(tab.getAttribute('aria-controls')).toBe('categories-panel-cat-one')
    expect(tab.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById('categories-panel-cat-one')).toBeTruthy()
  })
})
