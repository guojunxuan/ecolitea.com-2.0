import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BannerMedia } from '@/collections/Products/blocks/MediaBanner/BannerMedia'
import type { Media } from '@/payload-types'
vi.mock('@/components/Media', () => ({
  Media: ({
    presentation,
    paused,
  }: {
    presentation?: { video?: { playback?: string } }
    paused?: boolean
  }) => (
    <video
      data-testid="video"
      autoPlay={presentation?.video?.playback === 'ambient' && !paused}
      muted={presentation?.video?.playback === 'ambient'}
      controls={presentation?.video?.playback === 'player'}
    />
  ),
}))
const video = { id: 'video', mimeType: 'video/mp4' } as Media
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }))
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    },
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it('opens a controlled unmuted player and restores trigger focus on Escape', () => {
  render(<BannerMedia media={video} playback="player" aspectRatio="16:9" title="Film" />)
  const trigger = screen.getByRole('button', { name: 'Watch Now' })
  trigger.focus()
  fireEvent.click(trigger)
  const modal = screen.getByRole('dialog', { name: 'Film' })
  const player = modal.querySelector('video')!
  expect(player.controls).toBe(true)
  expect(player.muted).toBe(false)
  fireEvent(modal, new Event('cancel', { cancelable: true }))
  expect(document.activeElement).toBe(trigger)
  expect(screen.queryByRole('dialog')).toBeNull()
})
it('keeps ambient video inline without a watch control', () => {
  render(<BannerMedia media={video} playback="ambient" aspectRatio="16:9" />)
  expect(screen.queryByRole('button', { name: 'Watch Now' })).toBeNull()
})

it('replaces the native video when responsive art direction selects a different source', () => {
  let mobile = false
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('width') && mobile,
    addEventListener() {},
    removeEventListener() {},
  }))
  const props = {
    media: video,
    mobileMedia: { ...video, id: 'mobile' },
    playback: 'ambient' as const,
    aspectRatio: '16:9' as const,
  }
  const { rerender } = render(<BannerMedia {...props} />)
  const desktopVideo = screen.getByTestId('video')
  mobile = true
  rerender(<BannerMedia {...props} />)
  expect(screen.getByTestId('video')).not.toBe(desktopVideo)
})

it('requests the actual mobile crop ratio through the shared media renderer', () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('width'),
    addEventListener() {},
    removeEventListener() {},
  }))
  const { container } = render(
    <BannerMedia
      media={{ ...video, mimeType: 'image/jpeg' }}
      playback="ambient"
      aspectRatio="21:9"
    />,
  )
  expect(
    container.querySelector('[data-aspect-ratio]')?.getAttribute('data-mobile-aspect-ratio'),
  ).toBe('4:5')
  expect(container.querySelector('[data-aspect-ratio]')?.getAttribute('data-aspect-ratio')).toBe(
    '21:9',
  )
})

it.each([
  { mobile: false, expected: '21:9' },
  { mobile: true, expected: '21:9' },
])(
  'uses compressed video previews and uncropped modal when mobile=$mobile',
  ({ mobile, expected }) => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('width') && mobile,
      addEventListener() {},
      removeEventListener() {},
    }))
    const { container } = render(
      <BannerMedia media={video} playback="player" aspectRatio="16:9" title="Film" />,
    )
    expect(container.querySelector('[data-aspect-ratio]')?.getAttribute('data-aspect-ratio')).toBe(
      expected,
    )
    expect(
      container.querySelector('[data-aspect-ratio]')?.getAttribute('data-mobile-aspect-ratio'),
    ).toBe('16:9')
    fireEvent.click(screen.getByRole('button', { name: 'Watch Now' }))
    expect(
      screen
        .getByRole('dialog')
        .querySelector('[data-aspect-ratio]')
        ?.getAttribute('data-aspect-ratio'),
    ).toBe('original')
  },
)
it('preserves full-screen preview sizing for video', () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('width'),
    addEventListener() {},
    removeEventListener() {},
  }))
  const { container } = render(
    <BannerMedia media={video} playback="ambient" aspectRatio="full-screen" />,
  )
  expect(container.querySelector('[data-aspect-ratio]')?.getAttribute('data-aspect-ratio')).toBe(
    'full-screen',
  )
})

it.each([
  { desktopType: 'video/mp4', mobileType: 'image/jpeg', expected: false },
  { desktopType: 'image/jpeg', mobileType: 'video/mp4', expected: true },
])(
  'declares mobile preview kind before hydration for $desktopType / $mobileType',
  async ({ desktopType, mobileType, expected }) => {
    const { renderToStaticMarkup } = await import('react-dom/server')
    const html = renderToStaticMarkup(
      <BannerMedia
        media={{ ...video, mimeType: desktopType }}
        mobileMedia={{ ...video, id: 'mobile', mimeType: mobileType }}
        playback="ambient"
        aspectRatio="21:9"
      />,
    )
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    expect(parsed.querySelector('[data-mobile-video="true"]') !== null).toBe(expected)
  },
)
