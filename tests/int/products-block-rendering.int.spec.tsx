import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Accordion as InteractiveAccordion } from '@/collections/Products/blocks/MediaAccordion/Accordion'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RenderProductBlocks } from '@/collections/Products/blocks/RenderProductBlocks'
import { Component as Banner } from '@/collections/Products/blocks/MediaBanner/Component'
import { Component as Carousel } from '@/collections/Products/blocks/MediaCarousel/Component'
import { Component as Tabs } from '@/collections/Products/blocks/MediaTabs/Component'
import { Component as Accordion } from '@/collections/Products/blocks/MediaAccordion/Component'
import { Component as MediaText } from '@/collections/Products/blocks/MediaText/Component'
import { ActiveMedia } from '@/collections/Products/blocks/shared/ActiveMedia'
import type { Media } from '@/payload-types'

vi.mock('@/components/Media', () => ({
  Media: ({
    resource,
    presentation,
    paused,
  }: {
    resource: Media
    presentation?: { video?: { playback?: string } }
    paused?: boolean
  }) =>
    resource?.mimeType === 'video/mp4' ? (
      <video
        data-testid="video"
        autoPlay={!paused && presentation?.video?.playback === 'ambient'}
      />
    ) : (
      <div data-testid="media" data-playback={presentation?.video?.playback}>
        {resource?.alt}
      </div>
    ),
}))

const image = {
  id: 'media-1',
  alt: 'Product detail',
  mimeType: 'image/jpeg',
  url: '/detail.jpg',
  width: 800,
  height: 600,
} as Media
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Product Blocks', () => {
  it('renders banner copy and media while inheriting the Section theme', () => {
    const { container } = render(
      <section data-website-theme="inverse">
        <Banner
          blockType="productMediaBanner"
          title="Built to last"
          body="A closer look."
          media={image}
          playback="ambient"
          aspectRatio="16:9"
        />
      </section>,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Built to last' })).toBeTruthy()
    expect(screen.getByText('A closer look.')).toBeTruthy()
    expect(container.querySelector('section[data-website-theme="inverse"]')).toBeTruthy()
    expect(container.querySelector('section [data-website-theme]')).toBeNull()
    expect(screen.getByTestId('media').getAttribute('data-playback')).toBe('ambient')
    expect(container.querySelector('[data-aspect-ratio="16:9"]')).toBeTruthy()
  })

  it('loops carousel navigation and makes only the current slide interactive', () => {
    const { container } = render(
      <Carousel
        blockType="productMediaCarousel"
        title="Details"
        aspectRatio="16:9"
        slides={[
          { media: image, playback: 'ambient', caption: 'First' },
          { media: image, playback: 'player', caption: 'Second' },
        ]}
      />,
    )
    expect(container.querySelectorAll('figure[data-active="true"]')).toHaveLength(1)
    expect(
      container.querySelectorAll('figure:not([data-active="true"]):not([inert])'),
    ).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }))
    expect(
      container.querySelector('figure[data-active="true"]')?.getAttribute('aria-describedby'),
    ).toBe(screen.getByText('Second').id)
    fireEvent.keyDown(screen.getByRole('region', { name: 'Details' }), { key: 'ArrowRight' })
    expect(
      container.querySelector('figure[data-active="true"]')?.getAttribute('aria-describedby'),
    ).toBe(screen.getByText('First').id)
  })

  it('exposes linked tabs and panels with looping keyboard and arrow navigation', () => {
    render(
      <Tabs
        blockType="productMediaTabs"
        title="Views"
        aspectRatio="4:3"
        tabs={[
          { title: 'Front', media: image, playback: 'ambient' },
          { title: 'Back', media: image, playback: 'player' },
        ]}
      />,
    )
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tabs[1])
    expect(screen.getByRole('tabpanel').id).toBe(tabs[1].getAttribute('aria-controls'))
    expect(screen.getByRole('button', { name: 'Next tab' }).hasAttribute('disabled')).toBe(false)
    fireEvent.keyDown(tabs[1], { key: 'ArrowRight' })
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Previous tab' }))
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(tabs[1], { key: 'Home' })
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
  })

  it('starts only active ambient media and pauses media when it becomes inactive', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    const video = { ...image, mimeType: 'video/mp4' }
    const { rerender } = render(<ActiveMedia resource={video} playback="ambient" active={false} />)
    expect(screen.getByTestId('video').hasAttribute('autoplay')).toBe(false)
    expect(play).not.toHaveBeenCalled()
    expect(pause).toHaveBeenCalledTimes(1)
    rerender(<ActiveMedia resource={video} playback="ambient" active />)
    expect(play).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('video').hasAttribute('autoplay')).toBe(true)
    rerender(<ActiveMedia resource={video} playback="ambient" active={false} />)
    expect(pause).toHaveBeenCalledTimes(2)
    play.mockRestore()
    pause.mockRestore()
  })

  it('pauses all ambient video for reduced motion and follows preference changes', () => {
    let reduced = true
    const listeners = new Set<() => void>()
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return reduced
      },
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }))
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    render(
      <Banner
        blockType="productMediaBanner"
        title="Film"
        media={{ ...image, mimeType: 'video/mp4' }}
        playback="ambient"
        aspectRatio="16:9"
      />,
    )
    expect(screen.getByTestId('video').hasAttribute('autoplay')).toBe(false)
    expect(play).not.toHaveBeenCalled()
    expect(pause).toHaveBeenCalled()
    act(() => {
      reduced = false
      listeners.forEach((listener) => listener())
    })
    expect(screen.getByTestId('video').hasAttribute('autoplay')).toBe(true)
    expect(play).toHaveBeenCalled()
    const paused = pause.mock.calls.length
    act(() => {
      reduced = true
      listeners.forEach((listener) => listener())
    })
    expect(pause.mock.calls.length).toBeGreaterThan(paused)
    expect(screen.getByTestId('video').hasAttribute('autoplay')).toBe(false)
  })

  it('keeps one accordion item open and renders each item’s required media', () => {
    render(
      <Accordion
        blockType="productMediaAccordion"
        title="Features"
        aspectRatio="1:1"
        mediaPosition="left"
        items={[
          { title: 'Strong', media: { ...image, alt: 'Strong detail' }, playback: 'ambient' },
          { title: 'Simple', media: image, playback: 'player' },
        ]}
      />,
    )
    const first = screen.getByRole('button', { name: 'Strong' })
    const second = screen.getByRole('button', { name: 'Simple' })
    expect(first.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(second)
    expect(second.getAttribute('aria-expanded')).toBe('true')
    expect(first.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById(second.getAttribute('aria-controls')!)).toBeTruthy()
    expect(
      screen
        .getAllByTestId('media')
        .some((media) => media.textContent === 'Product detail' && !media.closest('[inert]')),
    ).toBe(true)
    fireEvent.click(second)
    expect(second.getAttribute('aria-expanded')).toBe('true')
    expect(first.getAttribute('aria-expanded')).toBe('false')
    fireEvent.keyDown(second, { key: 'Home' })
    expect(document.activeElement).toBe(first)
  })

  it('renders text block heading without introducing action buttons', () => {
    render(
      <MediaText
        blockType="productMediaText"
        title="Carefully made"
        media={image}
        playback="player"
        aspectRatio="4:3"
        mediaPosition="right"
      />,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Carefully made' })).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('ignores unknown block types and empty block lists', () => {
    const { container } = render(
      <RenderProductBlocks blocks={[{ blockType: 'futureBlock' }] as never} />,
    )
    expect(container.innerHTML).toBe('')
  })
})

it('starts server-rendered Carousel at the first real slide without clone slots or JS-only controls', () => {
  const markup = renderToStaticMarkup(
    <Carousel
      blockType="productMediaCarousel"
      title="No JS"
      aspectRatio="16:9"
      slides={[
        { media: image, playback: 'ambient', caption: 'Real first' },
        { media: image, playback: 'ambient', caption: 'Real last' },
      ]}
    />,
  )
  const parsed = new DOMParser().parseFromString(markup, 'text/html')
  const figures = parsed.querySelectorAll('figure')
  expect(figures).toHaveLength(2)
  expect(figures[0].textContent).toContain('Real first')
  expect(figures[0].getAttribute('aria-hidden')).toBe('false')
  expect(
    parsed.getElementById(figures[0].getAttribute('aria-describedby')!)?.textContent,
  ).toContain('Real first')
  expect(parsed.querySelector('button')).toBeNull()
})

it('moves accordion focus only between triggers and keeps the active item open when clicked', () => {
  render(
    <InteractiveAccordion
      aspectRatio="1:1"
      mediaPosition="right"
      items={[
        {
          title: 'First trigger',
          body: <button>Body action</button>,
          media: { ...image, alt: 'First image' },
          playback: 'ambient',
        },
        {
          title: 'Second trigger',
          body: null,
          media: { ...image, alt: 'Second image' },
          playback: 'ambient',
        },
      ]}
    />,
  )
  const first = screen.getByRole('button', { name: 'First trigger' })
  const second = screen.getByRole('button', { name: 'Second trigger' })
  expect(
    screen.getByText('First image').closest('[data-active]')?.getAttribute('data-active'),
  ).toBe('true')
  first.focus()
  fireEvent.keyDown(first, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(second)
  fireEvent.keyDown(second, { key: 'Home' })
  expect(document.activeElement).toBe(first)
  fireEvent.click(first)
  expect(first.getAttribute('aria-expanded')).toBe('true')
  expect(screen.getByText('First image').closest('[data-active]')?.hasAttribute('inert')).toBe(
    false,
  )
  fireEvent.click(second)
  expect(second.getAttribute('aria-expanded')).toBe('true')
  expect(first.getAttribute('aria-expanded')).toBe('false')
  expect(screen.getByText('First image').closest('[data-active]')?.hasAttribute('inert')).toBe(true)
})
