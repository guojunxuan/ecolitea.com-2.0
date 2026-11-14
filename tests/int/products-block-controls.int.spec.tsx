import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Component as MediaText } from '@/collections/Products/blocks/MediaText/Component'
import { ProductBlockHeader } from '@/components/Products/ProductBlockHeader'
import { SegmentIndicator } from '@/components/Products/SegmentIndicator'
import { MediaArrow } from '@/collections/Products/blocks/shared/MediaArrow'
import { ProductMedia } from '@/collections/Products/blocks/shared/ProductMedia'
import type { Media } from '@/payload-types'

vi.mock('@/components/Media', () => ({
  Media: ({ presentation }: { presentation?: { image?: { fit?: string } } }) => (
    <video data-testid="video" data-fit={presentation?.image?.fit} loop />
  ),
}))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('uses h3 centered by default and keeps an explicit h2 heading option', () => {
  const { container } = render(
    <>
      <ProductBlockHeader title="Feature" />
      <ProductBlockHeader title="Related" headingLevel={2} alignment="left" />
    </>,
  )
  expect(screen.getByRole('heading', { level: 3, name: 'Feature' })).toBeTruthy()
  expect(screen.getByRole('heading', { level: 2, name: 'Related' })).toBeTruthy()
  expect(container.querySelector('[data-alignment="center"]')).toBeTruthy()
})
it('shares an accessible circular SVG arrow with native disabled behavior', () => {
  const click = vi.fn()
  render(<MediaArrow direction="next" aria-label="Next slide" onClick={click} disabled />)
  const button = screen.getByRole('button', { name: 'Next slide' })
  expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  fireEvent.click(button)
  expect(click).not.toHaveBeenCalled()
})
it('supports contain and completion events without exposing delivery details', () => {
  const ended = vi.fn()
  const progress = vi.fn()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  render(
    <ProductMedia
      resource={{ id: 'v' } as Media}
      fit="contain"
      loop={false}
      onEnded={ended}
      onProgress={progress}
    />,
  )
  const video = screen.getByTestId('video') as HTMLVideoElement
  expect(video.loop).toBe(false)
  expect(video.dataset.fit).toBe('contain')
  fireEvent.ended(video)
  expect(ended).toHaveBeenCalledOnce()
  fireEvent.timeUpdate(video)
  expect(progress).toHaveBeenCalled()
})

it('provides named interactive segments and bounded timing progress', () => {
  const select = vi.fn()
  const { container } = render(
    <SegmentIndicator count={3} active={1} progress={2} onSelect={select} />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Go to slide 3' }))
  expect(select).toHaveBeenCalledWith(2)
  expect(screen.getByRole('button', { name: 'Go to slide 2' }).getAttribute('aria-current')).toBe(
    'true',
  )
  expect(container.querySelector('[data-progress]')?.getAttribute('style')).toContain('scaleX(1)')
})

it('contains transparent-capable GIF product media in its fixed-ratio text block', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  render(
    <MediaText
      blockType="productMediaText"
      title="Cutout"
      aspectRatio="4:3"
      mediaPosition="right"
      media={{ id: 'gif', mimeType: 'image/gif' } as Media}
      playback="ambient"
    />,
  )
  expect(screen.getByTestId('video').dataset.fit).toBe('contain')
})
