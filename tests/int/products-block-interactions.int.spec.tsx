import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Accordion } from '@/collections/Products/blocks/MediaAccordion/Accordion'
import { Tabs } from '@/collections/Products/blocks/MediaTabs/Tabs'
import { Carousel } from '@/collections/Products/blocks/MediaCarousel/Carousel'
import { Entrance } from '@/collections/Products/blocks/shared/Entrance'
import type { Media } from '@/payload-types'

vi.mock('@/components/Media', () => ({
  Media: ({ resource }: { resource: Media }) =>
    resource?.mimeType?.startsWith('video/') ? (
      <video data-testid="slide-video" />
    ) : (
      <span>{resource?.alt}</span>
    ),
}))
const image = { id: 'i', mimeType: 'image/jpeg', alt: 'First image' } as Media
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('shows entrance content immediately without IntersectionObserver', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const { container } = render(<Entrance>Feature</Entrance>)
  expect(container.firstElementChild?.getAttribute('data-entrance-state')).toBe('complete')
  expect(document.documentElement.dataset.motion).toBeUndefined()
})

it('enables motion only after observing the entrance', () => {
  const observe = vi.fn()
  vi.stubGlobal('IntersectionObserver', class {
    observe = observe
    disconnect() {}
  })
  try {
    render(<Entrance>Feature</Entrance>)
    expect(observe).toHaveBeenCalled()
    expect(document.documentElement.dataset.motion).toBe('ready')
  } finally {
    delete document.documentElement.dataset.motion
  }
})

it('places tabs below lazy media and loops in both directions', () => {
  const { container } = render(
    <Tabs
      label="Views"
      aspectRatio="16:9"
      tabs={[
        { title: 'Front', media: image, playback: 'ambient', description: 'Front detail' },
        { title: 'Back', media: { ...image, alt: 'Second image' }, playback: 'ambient' },
      ]}
    />,
  )
  expect(screen.queryByText('Second image')).toBeNull()
  const list = screen.getByRole('tablist')
  const panel = screen.getByRole('tabpanel')
  expect(panel.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Previous tab' }))
  expect(screen.getAllByRole('tab')[1].getAttribute('aria-selected')).toBe('true')
  expect(screen.getByText('Second image')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Next tab' }).hasAttribute('disabled')).toBe(false)
  expect(container.querySelector('[data-tab-description]')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Next tab' }))
  expect(screen.getAllByRole('tab')[0].getAttribute('aria-selected')).toBe('true')
})
it('omits the description row when all tabs leave it empty', () => {
  const { container } = render(
    <Tabs
      label="Views"
      aspectRatio="16:9"
      tabs={[
        { title: 'Front', media: image, playback: 'ambient' },
        { title: 'Back', media: image, playback: 'ambient' },
      ]}
    />,
  )
  expect(container.querySelector('[data-tab-description]')).toBeNull()
})
it('keeps a remaining tab and its lazy media active after live preview removes the selected tab', () => {
  const tabs = ['Front', 'Side', 'Back'].map((title) => ({
    id: title,
    title,
    media: { ...image, alt: `${title} image` },
    playback: 'ambient' as const,
  }))
  const { rerender } = render(<Tabs label="Views" aspectRatio="16:9" tabs={tabs} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Back' }))
  expect(screen.getByRole('tabpanel').textContent).toContain('Back image')

  rerender(<Tabs label="Views" aspectRatio="16:9" tabs={tabs.slice(0, 2)} />)

  expect(screen.getByRole('tab', { name: 'Side', selected: true })).toBeTruthy()
  expect(screen.getByRole('tabpanel').textContent).toContain('Side image')
  fireEvent.click(screen.getByRole('button', { name: 'Next tab' }))
  expect(screen.getByRole('tab', { name: 'Front', selected: true })).toBeTruthy()
})
it('advances visible images after five seconds and stops after user interaction', () => {
  vi.useFakeTimers()
  const callbacks: IntersectionObserverCallback[] = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback)
      }
      observe() {}
      disconnect() {}
    },
  )
  render(
    <Carousel
      label="Details"
      aspectRatio="16:9"
      slides={[
        { media: image, playback: 'ambient' as const, caption: 'First caption' },
        { media: image, playback: 'ambient' as const, caption: 'Second caption' },
      ]}
    />,
  )
  act(() =>
    callbacks.forEach((callback) =>
      callback(
        [{ isIntersecting: true }] as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      ),
    ),
  )
  act(() => {
    vi.advanceTimersByTime(5000)
  })
  expect(screen.getByRole('status').textContent).toContain('Slide 2 of 2')
  fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }))
  act(() => {
    vi.advanceTimersByTime(10000)
  })
  expect(screen.getByRole('status').textContent).toContain('Slide 1 of 2')
  expect(screen.getByRole('button', { name: 'Play slideshow' })).toBeTruthy()
})

it('keeps one accordion item open and gives each item a level-four heading', () => {
  render(
    <Accordion
      aspectRatio="1:1"
      mediaPosition="left"
      items={[
        { title: 'Strong', media: image, playback: 'ambient', body: <p>Details</p> },
        { title: 'Simple', media: image, playback: 'ambient', body: null },
      ]}
    />,
  )
  const first = screen.getByRole('button', { name: 'Strong' })
  fireEvent.click(first)
  expect(first.getAttribute('aria-expanded')).toBe('true')
  expect(screen.getByRole('heading', { level: 4, name: 'Strong' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Simple' }))
  expect(first.getAttribute('aria-expanded')).toBe('false')
})
it('keeps a remaining accordion item open after live preview removes the selected item', () => {
  const items = ['Strong', 'Simple', 'Light'].map((title) => ({
    id: title,
    title,
    media: image,
    playback: 'ambient' as const,
    body: <p>{title} details</p>,
  }))
  const { rerender } = render(<Accordion aspectRatio="1:1" mediaPosition="right" items={items} />)
  fireEvent.click(screen.getByRole('button', { name: 'Light' }))
  expect(screen.getByRole('region', { name: 'Light' }).textContent).toContain('Light details')

  rerender(<Accordion aspectRatio="1:1" mediaPosition="right" items={items.slice(0, 2)} />)

  expect(screen.getByRole('button', { name: 'Simple', expanded: true })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Simple' }).textContent).toContain('Simple details')
  fireEvent.click(screen.getByRole('button', { name: 'Strong' }))
  expect(screen.getByRole('button', { name: 'Strong', expanded: true })).toBeTruthy()
})
it('places mobile accordion media inside its expanded content after the body', () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('width'),
    addEventListener() {},
    removeEventListener() {},
  }))
  render(
    <Accordion
      aspectRatio="1:1"
      mediaPosition="right"
      items={[
        { title: 'Strong', media: image, playback: 'ambient', body: <p>Details</p> },
        { title: 'Simple', media: image, playback: 'ambient', body: null },
      ]}
    />,
  )
  expect(screen.getByRole('region', { name: 'Strong' }).textContent).toContain('First image')
  expect(screen.getAllByText('First image')).toHaveLength(1)
})

function enableVisibleCarousel() {
  vi.useFakeTimers()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      callback: IntersectionObserverCallback
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
      }
      observe(target: Element) {
        this.callback(
          [{ isIntersecting: true, target }] as IntersectionObserverEntry[],
          {} as IntersectionObserver,
        )
      }
      disconnect() {}
    },
  )
}
it('stops autoplay after a horizontal trackpad gesture', () => {
  enableVisibleCarousel()
  render(
    <Carousel
      label="Wheel"
      aspectRatio="16:9"
      slides={[
        { media: image, playback: 'ambient' },
        { media: image, playback: 'ambient' },
      ]}
    />,
  )
  fireEvent.wheel(screen.getByRole('region', { name: 'Wheel' }), { deltaX: 100 })
  act(() => {
    vi.advanceTimersByTime(10000)
  })
  expect(screen.getByRole('status').textContent).toContain('Slide 1 of 2')
  expect(screen.getByRole('button', { name: 'Play slideshow' })).toBeTruthy()
})
it('preserves remaining image time across hover and page visibility pauses', () => {
  enableVisibleCarousel()
  const { container } = render(
    <Carousel
      label="Timing"
      aspectRatio="16:9"
      slides={[
        { media: image, playback: 'ambient' },
        { media: image, playback: 'ambient' },
      ]}
    />,
  )
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  fireEvent.mouseEnter(container.firstElementChild!)
  act(() => {
    vi.advanceTimersByTime(10000)
  })
  expect(screen.getByRole('status').textContent).toContain('Slide 1 of 2')
  fireEvent.mouseLeave(container.firstElementChild!)
  const visible = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  fireEvent(document, new Event('visibilitychange'))
  act(() => {
    vi.advanceTimersByTime(10000)
  })
  visible.mockReturnValue('visible')
  fireEvent(document, new Event('visibilitychange'))
  act(() => {
    vi.advanceTimersByTime(3000)
  })
  expect(screen.getByRole('status').textContent).toContain('Slide 2 of 2')
})
it('waits for video completion instead of using the image timer', () => {
  enableVisibleCarousel()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const { container } = render(
    <Carousel
      label="Video"
      aspectRatio="16:9"
      slides={[
        { media: { ...image, mimeType: 'video/mp4' }, playback: 'ambient' },
        { media: image, playback: 'ambient' },
      ]}
    />,
  )
  act(() => {
    vi.advanceTimersByTime(10000)
  })
  expect(screen.getByRole('status').textContent).toContain('Slide 1 of 2')
  const video = container.querySelector('figure[data-active="true"] video') as HTMLVideoElement
  expect(video.loop).toBe(false)
  fireEvent.ended(video)
  expect(screen.getByRole('status').textContent).toContain('Slide 2 of 2')
})

it('keeps a wrap clone visually active while leaving it inert and hidden to assistive tech', () => {
  const { container } = render(
    <Carousel
      label="Wrap"
      aspectRatio="16:9"
      slides={[
        { media: image, playback: 'ambient' },
        { media: image, playback: 'ambient' },
      ]}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }))
  const clone = container.querySelector('figure[data-clone="true"]')!
  expect(clone.getAttribute('data-visual-active')).toBe('true')
  expect(clone.getAttribute('aria-hidden')).toBe('true')
  expect(clone.hasAttribute('inert')).toBe(true)
  expect(container.querySelectorAll('figure[data-active="true"]')).toHaveLength(1)
})

it('keeps a remaining carousel slide active after live preview removes the selected slide', () => {
  const slides = ['First', 'Second', 'Third'].map((caption) => ({
    id: caption,
    caption,
    media: { ...image, alt: `${caption} image` },
    playback: 'ambient' as const,
  }))
  const { rerender } = render(<Carousel label="Details" aspectRatio="16:9" slides={slides} />)
  fireEvent.click(screen.getByRole('button', { name: 'Go to slide 3' }))
  expect(screen.getByRole('status').textContent).toContain('Slide 3 of 3')

  rerender(<Carousel label="Details" aspectRatio="16:9" slides={slides.slice(0, 2)} />)

  expect(screen.getByRole('status').textContent).toContain('Slide 2 of 2')
  expect(screen.getByRole('group', { name: '2 of 2' }).textContent).toContain('Second image')
  fireEvent.click(screen.getByRole('button', { name: 'Next slide' }))
  expect(screen.getByRole('status').textContent).toContain('Slide 1 of 2')
})

it.each(['21:9', '4:3', '1:1'])(
  'keeps the desktop Tabs ratio and declares the wide default mobile override: %s',
  (aspectRatio) => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('width'),
      addEventListener() {},
      removeEventListener() {},
    }))
    const { container } = render(
      <Tabs
        label="Sizes"
        aspectRatio={aspectRatio}
        tabs={[
          { title: 'One', media: image, playback: 'ambient' },
          { title: 'Two', media: image, playback: 'ambient' },
        ]}
      />,
    )
    const media = container.querySelector('[data-aspect-ratio]')
    expect(media?.getAttribute('data-aspect-ratio')).toBe(aspectRatio)
    expect(media?.getAttribute('data-mobile-aspect-ratio')).toBe(
      aspectRatio === '21:9' ? '16:9' : null,
    )
    expect(
      screen.getAllByRole('tab').every((tab) => tab.classList.contains('website-type-button')),
    ).toBe(true)
  },
)
it.each(['21:9', '4:3'])(
  'keeps the desktop Carousel ratio and declares the wide default mobile override: %s',
  (aspectRatio) => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('width'),
      addEventListener() {},
      removeEventListener() {},
    }))
    const { container } = render(
      <Carousel
        label="Sizes"
        aspectRatio={aspectRatio}
        slides={[
          { media: image, playback: 'ambient' },
          { media: image, playback: 'ambient' },
        ]}
      />,
    )
    const media = container.querySelector('figure[data-active="true"] [data-aspect-ratio]')
    expect(media?.getAttribute('data-aspect-ratio')).toBe(aspectRatio)
    expect(media?.getAttribute('data-mobile-aspect-ratio')).toBe(
      aspectRatio === '21:9' ? '16:9' : null,
    )
  },
)
