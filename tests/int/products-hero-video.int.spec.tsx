import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { act, cleanup, render } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { VideoMedia } from '@/components/Media/VideoMedia'
import { SlideMedia } from '@/heros/ProductListingHero/SlideMedia'
import type { ProductHeroSlide } from '@/utilities/products/getProductListingHero'
import type { Media } from '@/payload-types'
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('pauses controlled ambient videos and resumes without replacing the element', () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const media = { id: 'video', url: '/hero.mp4', mimeType: 'video/mp4' } as Media
  const { container, rerender } = render(<VideoMedia resource={media} paused />)
  const video = container.querySelector('video')!
  expect(video.autoplay).toBe(false)
  expect(pause).toHaveBeenCalled()
  rerender(<VideoMedia resource={media} paused={false} />)
  expect(container.querySelector('video')).toBe(video)
  expect(play).toHaveBeenCalledOnce()
  rerender(<VideoMedia resource={media} paused />)
  expect(pause).toHaveBeenCalledTimes(2)
})
it('lets the browser select only the matching breakpoint video source in server HTML', () => {
  const resource = { id: 'desktop', url: '/desktop.mp4', mimeType: 'video/mp4' } as Media
  const html = renderToStaticMarkup(
    <VideoMedia resource={resource} videoSourceMedia="(width >= 48rem)" />,
  )
  const host = document.createElement('div')
  host.innerHTML = html
  expect(host.querySelector('video')).not.toBeNull()
  expect(host.querySelector('source')?.getAttribute('media')).toBe('(width >= 48rem)')
  expect(host.querySelector('source')?.getAttribute('src')).toContain('/desktop.mp4')
})
it('serves video posters and breakpoint sources before hydration, then retains only the mobile video', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
  const desktop = {
    id: 'desktop',
    url: 'https://media.example.invalid/desktop.mp4',
    mimeType: 'video/mp4',
    durationSeconds: 10,
  } as Media
  const slide = {
    media: desktop,
    mobileMedia: { ...desktop, id: 'mobile', url: 'https://media.example.invalid/mobile.mp4' },
  } as ProductHeroSlide
  const content = <SlideMedia slide={slide} priority allowVideo paused />
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(content)
  document.body.append(host)
  const videos = host.querySelectorAll('video')
  expect(videos).toHaveLength(2)
  expect([...videos].every((video) => video.poster.includes('mode=frame'))).toBe(true)
  expect([...host.querySelectorAll('source')].map((source) => source.media)).toEqual([
    '(width >= 48rem)',
    '(width < 48rem)',
  ])
  const onRecoverableError = vi.fn()
  let root: ReturnType<typeof hydrateRoot>
  await act(async () => {
    root = hydrateRoot(host, content, { onRecoverableError })
  })
  try {
    expect(host.querySelectorAll('video')).toHaveLength(1)
    expect(host.querySelector('source')?.src).toContain('mobile.mp4')
    expect(host.querySelector('source')?.src).not.toContain('desktop.mp4')
    expect(onRecoverableError).not.toHaveBeenCalled()
  } finally {
    act(() => root.unmount())
    host.remove()
  }
})
