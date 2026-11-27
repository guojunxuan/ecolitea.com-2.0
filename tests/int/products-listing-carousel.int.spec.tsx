import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Props as MediaProps } from '@/components/Media/types'
import { ProductListingHero } from '@/heros/ProductListingHero'
import type { ProductHeroSlide } from '@/utilities/products/getProductListingHero'

vi.mock('@/heros/HeaderThemeSync', () => ({
  HeaderThemeSync: ({ theme }: { theme: string }) => <span data-testid="theme">{theme}</span>,
}))
vi.mock('@/components/Media', () => ({
  Media: ({ resource, paused, videoSourceMedia }: MediaProps) => (
    <span data-testid="media" data-paused={String(paused)} data-source-media={videoSourceMedia}>
      {typeof resource === 'object' ? resource?.id : ''}
    </span>
  ),
}))
const slides: ProductHeroSlide[] = [
  {
    id: 'one',
    media: { id: 'image', url: '/hero.jpg', mimeType: 'image/jpeg' } as never,
    title: 'First range',
    description: 'First copy',
    showText: false,
    theme: 'dark',
    mobileMedia: null,
    cta: { type: 'custom', url: '/contact', label: 'Explore' },
  },
  {
    id: 'two',
    media: { id: 'video', url: '/hero.mp4', mimeType: 'video/mp4' } as never,
    title: 'Second range',
    description: null,
    showText: false,
    theme: 'light',
    mobileMedia: null,
    cta: null,
  },
]
let reduced = false
beforeEach(() => {
  vi.useFakeTimers()
  reduced = false
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
const activeSlide = () => screen.getByRole('group').getAttribute('aria-label')
const dragHero = (
  target: Element,
  from: { x: number; y: number },
  to: { x: number; y: number },
  pointerType = 'touch',
) => {
  const pointer = { pointerId: 1, pointerType, isPrimary: true, button: 0 }
  fireEvent.pointerDown(target, { ...pointer, clientX: from.x, clientY: from.y })
  fireEvent.pointerMove(target, { ...pointer, clientX: to.x, clientY: to.y })
  fireEvent.pointerUp(target, { ...pointer, clientX: to.x, clientY: to.y })
}
it('SSR starts on the first slide with a whole-slide CTA and no visible copy', () => {
  const html = renderToStaticMarkup(<ProductListingHero slides={slides} />)
  expect(html).toContain('href="/contact"')
  expect(html).not.toContain('First range')
  expect(html).not.toContain('First copy')
  const host = document.createElement('div')
  host.innerHTML = html
  const items = host.querySelectorAll('[aria-roledescription="slide"]')
  expect(items).toHaveLength(2)
  expect(items[0].getAttribute('aria-hidden')).toBe('false')
  expect(items[1].getAttribute('inert')).not.toBeNull()
  expect(items[0].querySelector('a')?.textContent).toBe('Explore')
  expect(items[0].querySelector('a .visually-hidden')).not.toBeNull()
})
it.each(['image/jpeg', 'video/mp4'])(
  'SSR includes breakpoint-selected media when desktop is video and mobile is %s',
  (mobileMime) => {
    const html = renderToStaticMarkup(
      <ProductListingHero
        slides={[
          {
            ...slides[1],
            mobileMedia: { id: 'mobile-preview', url: '/mobile', mimeType: mobileMime } as never,
          },
        ]}
      />,
    )
    const host = document.createElement('div')
    host.innerHTML = html
    expect(host.querySelector('[data-source-media="(width >= 48rem)"]')?.textContent).toBe('video')
    expect(host.textContent).toContain('mobile-preview')
    if (mobileMime === 'video/mp4')
      expect(host.querySelector('[data-source-media="(width < 48rem)"]')).not.toBeNull()
  },
)
it('SSR retains the desktop image when the mobile alternative is a video', () => {
  const html = renderToStaticMarkup(
    <ProductListingHero slides={[{ ...slides[0], mobileMedia: slides[1].media }]} />,
  )
  const host = document.createElement('div')
  host.innerHTML = html
  expect(host.textContent).toContain('image')
  expect(host.querySelector('[data-source-media="(width < 48rem)"]')?.textContent).toBe('video')
})
it('does not duplicate the server video when mobile selects the same Media ID', () => {
  const html = renderToStaticMarkup(
    <ProductListingHero slides={[{ ...slides[1], mobileMedia: { ...slides[1].media! } }]} />,
  )
  const host = document.createElement('div')
  host.innerHTML = html
  expect(host.querySelectorAll('[data-testid="media"]')).toHaveLength(1)
})
it('keeps the page h1 without rendering internal slide titles', () => {
  render(
    <>
      <h1>Products SEO title</h1>
      <ProductListingHero slides={slides} />
    </>,
  )
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Next slide' }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Products SEO title')
  expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
})
it('keeps media-only slide notes private', () => {
  const { container } = render(<ProductListingHero slides={[slides[0]]} />)
  expect(container.querySelector('[data-hero-copy-scrim]')).toBeNull()
  expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
  expect(screen.queryByText('First copy')).toBeNull()
  expect(screen.getByRole('link', { name: 'Explore' }).getAttribute('href')).toBe('/contact')
})
it('restarts progress and timer together after hover pause', () => {
  render(<ProductListingHero slides={slides} />)
  const hero = screen.getByRole('region', { name: 'Featured products' })
  const progress = hero.querySelector('[data-hero-progress]')
  act(() => vi.advanceTimersByTime(2000))
  fireEvent.pointerEnter(hero, { pointerType: 'mouse' })
  act(() => vi.advanceTimersByTime(10000))
  fireEvent.pointerLeave(hero, { pointerType: 'mouse' })
  expect(hero.querySelector('[data-hero-progress]')).not.toBe(progress)
  expect((hero as HTMLElement).style.getPropertyValue('--hero-autoplay')).toBe('4000ms')
  act(() => vi.advanceTimersByTime(3999))
  expect(activeSlide()).toBe('1 / 2')
  act(() => vi.advanceTimersByTime(1))
  expect(activeSlide()).toBe('2 / 2')
})
it('mounts video media only for current and next slides and uses the mobile breakpoint asset', () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('width'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
  const videos = Array.from({ length: 4 }, (_, i) => ({
    ...slides[0],
    id: String(i),
    media: { id: `video-${i}`, url: `/video-${i}.mp4`, mimeType: 'video/mp4' } as never,
    mobileMedia: { id: `mobile-${i}`, url: `/mobile-${i}.mp4`, mimeType: 'video/mp4' } as never,
  }))
  render(<ProductListingHero slides={videos} />)
  expect(screen.getAllByTestId('media').map((n) => n.textContent)).toEqual(['mobile-0', 'mobile-1'])
  fireEvent.click(screen.getByRole('button', { name: 'Next slide' }))
  expect(screen.getAllByTestId('media').map((n) => n.textContent)).toEqual(['mobile-1', 'mobile-2'])
})
it('loops both ways, updates the theme and pauses inactive media', () => {
  render(<ProductListingHero slides={slides} />)
  expect(screen.getAllByTestId('media').map((node) => node.dataset.paused)).toEqual([
    'false',
    'true',
  ])
  fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }))
  expect(activeSlide()).toBe('2 / 2')
  expect(screen.getByTestId('theme').textContent).toBe('light')
  expect(screen.getAllByTestId('media').map((node) => node.dataset.paused)).toEqual([
    'true',
    'false',
  ])
  fireEvent.click(screen.getByRole('button', { name: 'Next slide' }))
  expect(activeSlide()).toBe('1 / 2')
})
it('keeps navigation controls outside the whole-slide CTA without visible text overlays', () => {
  render(<ProductListingHero slides={[{ ...slides[0], title: 'New range' }, slides[1]]} />)
  expect(screen.queryByText('New range')).toBeNull()
  expect(screen.getByRole('link', { name: 'Explore' }).textContent).toBe('Explore')
  expect(screen.getAllByRole('button').every((button) => !button.closest('a'))).toBe(true)
  expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
    'Previous slide',
    'Next slide',
    'Go to slide 1',
    'Go to slide 2',
  ])
})
it('only exposes the active slide link and honors opening an external CTA in a new tab', () => {
  render(
    <ProductListingHero
      slides={[
        slides[0],
        {
          ...slides[1],
          cta: {
            type: 'custom',
            url: 'https://example.com/range',
            label: 'View range',
            newTab: true,
          },
        },
      ]}
    />,
  )
  expect(screen.queryByRole('link', { name: 'View range' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Next slide' }))
  expect(screen.queryByRole('link', { name: 'Explore' })).toBeNull()
  const link = screen.getByRole('link', { name: 'View range' })
  expect(link.getAttribute('href')).toBe('https://example.com/range')
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
})
it('does not render a link for slides without a configured CTA', () => {
  render(<ProductListingHero slides={[slides[1]]} />)
  expect(screen.queryByRole('link')).toBeNull()
})
it('prevents a swipe from activating the slide link while leaving pagination usable', () => {
  render(<ProductListingHero slides={slides} />)
  const hero = screen.getByRole('region', { name: 'Featured products' })
  const link = screen.getByRole('link', { name: 'Explore' })
  dragHero(link, { x: 280, y: 100 }, { x: 80, y: 105 })
  expect(activeSlide()).toBe('2 / 2')
  expect(fireEvent.click(link)).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Go to slide 1' }))
  expect(activeSlide()).toBe('1 / 2')
  fireEvent.keyDown(hero, { key: 'Tab' })
  fireEvent.focus(screen.getByRole('link', { name: 'Explore' }))
  expect(hero.hasAttribute('data-keyboard-focus')).toBe(true)
  act(() => vi.advanceTimersByTime(4000))
  expect(activeSlide()).toBe('1 / 2')
})
it('rotates every four seconds without separate playback controls', () => {
  render(<ProductListingHero slides={slides} />)
  act(() => vi.advanceTimersByTime(4000))
  expect(activeSlide()).toBe('2 / 2')
  act(() => vi.advanceTimersByTime(4000))
  expect(activeSlide()).toBe('1 / 2')
})
it('stays paused as focus moves within Hero and restarts only after focus leaves', () => {
  render(<ProductListingHero slides={slides} />)
  const hero = screen.getByRole('region', { name: 'Featured products' })
  const cta = screen.getByRole('button', { name: 'Next slide' })
  const dot = screen.getByRole('button', { name: 'Go to slide 1' })
  fireEvent.focus(cta)
  act(() => vi.advanceTimersByTime(4000))
  expect(activeSlide()).toBe('1 / 2')
  fireEvent.blur(cta, { relatedTarget: dot })
  fireEvent.focus(dot, { relatedTarget: cta })
  act(() => vi.advanceTimersByTime(4000))
  expect(activeSlide()).toBe('1 / 2')
  const progress = hero.querySelector('[data-hero-progress]')
  fireEvent.blur(dot, { relatedTarget: document.body })
  expect(hero.querySelector('[data-hero-progress]')).not.toBe(progress)
  act(() => vi.advanceTimersByTime(3999))
  expect(activeSlide()).toBe('1 / 2')
  act(() => vi.advanceTimersByTime(1))
  expect(activeSlide()).toBe('2 / 2')
})
it('resumes after a pointer click and mouse leave even when the arrow keeps focus', () => {
  render(<ProductListingHero slides={slides} />)
  const hero = screen.getByRole('region', { name: 'Featured products' })
  const next = screen.getByRole('button', { name: 'Next slide' })
  fireEvent.pointerEnter(hero, { pointerType: 'mouse' })
  fireEvent.pointerDown(next, { pointerType: 'mouse' })
  fireEvent.focus(next)
  fireEvent.click(next)
  expect(activeSlide()).toBe('2 / 2')
  fireEvent.pointerLeave(hero, { pointerType: 'mouse' })
  act(() => vi.advanceTimersByTime(3999))
  expect(activeSlide()).toBe('2 / 2')
  act(() => vi.advanceTimersByTime(1))
  expect(activeSlide()).toBe('1 / 2')
})
it('pauses again when keyboard navigation follows a pointer-focused control', () => {
  render(<ProductListingHero slides={slides} />)
  const hero = screen.getByRole('region', { name: 'Featured products' })
  const next = screen.getByRole('button', { name: 'Next slide' })
  fireEvent.pointerDown(next, { pointerType: 'mouse' })
  fireEvent.focus(next)
  fireEvent.keyDown(next, { key: 'Tab', shiftKey: true })
  expect(hero.hasAttribute('data-keyboard-focus')).toBe(true)
  act(() => vi.advanceTimersByTime(8000))
  expect(activeSlide()).toBe('1 / 2')
  fireEvent.blur(next, { relatedTarget: document.body })
  expect(hero.hasAttribute('data-keyboard-focus')).toBe(false)
  act(() => vi.advanceTimersByTime(4000))
  expect(activeSlide()).toBe('2 / 2')
})
it('recognizes keyboard focus when returning after a pointer-focused control loses focus', () => {
  render(<ProductListingHero slides={slides} />)
  const hero = screen.getByRole('region', { name: 'Featured products' })
  const next = screen.getByRole('button', { name: 'Next slide' })
  fireEvent.pointerDown(next, { pointerType: 'mouse' })
  fireEvent.focus(next)
  fireEvent.blur(next, { relatedTarget: document.body })
  fireEvent.focus(hero)
  act(() => vi.advanceTimersByTime(4000))
  expect(activeSlide()).toBe('1 / 2')
  expect(hero.hasAttribute('data-keyboard-focus')).toBe(true)
})
it('switches with root arrow keys and leaves focused control keys alone', () => {
  render(<ProductListingHero slides={slides} />)
  const hero = screen.getByRole('region', { name: 'Featured products' })
  fireEvent.keyDown(hero, { key: 'ArrowRight' })
  expect(activeSlide()).toBe('2 / 2')
  fireEvent.keyDown(hero, { key: 'ArrowLeft' })
  expect(activeSlide()).toBe('1 / 2')
  fireEvent.keyDown(screen.getByRole('button', { name: 'Next slide' }), { key: 'ArrowRight' })
  expect(activeSlide()).toBe('1 / 2')
})
it('pauses rotation during hover, focus and hidden page', () => {
  render(<ProductListingHero slides={slides} />)
  const hero = screen.getByRole('region', { name: 'Featured products' })
  fireEvent.pointerEnter(hero, { pointerType: 'mouse' })
  act(() => vi.advanceTimersByTime(4000))
  expect(activeSlide()).toBe('1 / 2')
  fireEvent.pointerLeave(hero, { pointerType: 'mouse' })
  fireEvent.focus(screen.getByRole('button', { name: 'Next slide' }))
  act(() => vi.advanceTimersByTime(4000))
  expect(activeSlide()).toBe('1 / 2')
  fireEvent.blur(screen.getByRole('button', { name: 'Next slide' }), {
    relatedTarget: document.body,
  })
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  act(() => vi.advanceTimersByTime(4000))
  expect(activeSlide()).toBe('1 / 2')
  expect(screen.getAllByTestId('media').every((node) => node.dataset.paused === 'true')).toBe(true)
  hidden.mockRestore()
})
it('uses manual controls with reduced motion and supports horizontal swipes', () => {
  reduced = true
  render(<ProductListingHero slides={slides} />)
  act(() => vi.advanceTimersByTime(12000))
  expect(activeSlide()).toBe('1 / 2')
  const hero = screen.getByRole('region', { name: 'Featured products' })
  dragHero(hero, { x: 280, y: 100 }, { x: 80, y: 105 })
  expect(activeSlide()).toBe('2 / 2')
})
it.each(['touch', 'mouse'])('switches both ways and wraps using %s pointer gestures', (type) => {
  render(<ProductListingHero slides={[...slides, { ...slides[1], id: 'third' }]} />)
  const hero = screen.getByRole('region', { name: 'Featured products' })
  dragHero(hero, { x: 280, y: 100 }, { x: 80, y: 105 }, type)
  expect(activeSlide()).toBe('2 / 3')
  dragHero(hero, { x: 80, y: 100 }, { x: 280, y: 105 }, type)
  expect(activeSlide()).toBe('1 / 3')
  dragHero(hero, { x: 80, y: 100 }, { x: 280, y: 105 }, type)
  expect(activeSlide()).toBe('3 / 3')
})
it('pauses autoplay while a finger is down and restarts after release', () => {
  render(<ProductListingHero slides={slides} />)
  const hero = screen.getByRole('region', { name: 'Featured products' })
  const pointer = {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    clientX: 180,
    clientY: 100,
  }
  fireEvent.pointerDown(hero, pointer)
  act(() => vi.advanceTimersByTime(8000))
  expect(activeSlide()).toBe('1 / 2')
  fireEvent.pointerUp(hero, pointer)
  act(() => vi.advanceTimersByTime(3999))
  expect(activeSlide()).toBe('1 / 2')
  act(() => vi.advanceTimersByTime(1))
  expect(activeSlide()).toBe('2 / 2')
})
it('ignores vertical movement and cancels interrupted pointer gestures', () => {
  render(<ProductListingHero slides={slides} />)
  const hero = screen.getByRole('region', { name: 'Featured products' })
  dragHero(hero, { x: 280, y: 100 }, { x: 260, y: 300 })
  expect(activeSlide()).toBe('1 / 2')
  const pointer = {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    clientX: 280,
    clientY: 100,
  }
  fireEvent.pointerDown(hero, pointer)
  fireEvent.pointerMove(hero, { ...pointer, clientX: 80 })
  fireEvent.pointerCancel(hero, pointer)
  fireEvent.pointerUp(hero, { ...pointer, clientX: 80 })
  expect(activeSlide()).toBe('1 / 2')
  expect(hero.querySelector('[data-hero-progress]')?.hasAttribute('data-running')).toBe(true)
})
it('keeps a short tap on a CTA as a native link activation', () => {
  render(
    <ProductListingHero
      slides={[
        {
          ...slides[0],
          cta: { type: 'custom', url: 'https://example.com/range', label: 'Explore', newTab: true },
        },
      ]}
    />,
  )
  const link = screen.getByRole('link', { name: 'Explore' })
  dragHero(link, { x: 180, y: 100 }, { x: 183, y: 102 })
  expect(fireEvent.click(link)).toBe(true)
})
it('hides controls for one slide and renders text slides without media', () => {
  render(<ProductListingHero slides={[{ ...slides[0], showText: true, media: null }]} />)
  expect(screen.queryByRole('button', { name: 'Next slide' })).toBeNull()
  expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('First range')
})

it('uses a mobile picture source without preloading the desktop image', async () => {
  const { ImageMedia } = await import('@/components/Media/ImageMedia')
  const resource = {
    id: 'desktop-image',
    url: '/desktop.jpg',
    mimeType: 'image/jpeg',
    alt: 'Hero',
    width: 1600,
    height: 900,
    createdAt: '2026-11-01T00:00:00.000Z',
  }
  const mobile = { ...resource, id: 'mobile-image', url: '/mobile.jpg', width: 800, height: 1000 }
  const { container } = render(
    <ImageMedia fill priority size="100vw" resource={resource} mobileResource={mobile} />,
  )
  expect(container.querySelector('source')?.getAttribute('srcset')).toContain('/mobile.jpg')
  expect(container.querySelector('source')?.getAttribute('media')).toBe('(width < 48rem)')
  expect(container.querySelector('img')?.getAttribute('loading')).toBe('eager')
  expect(document.querySelector('link[rel="preload"]')).toBeNull()
})
