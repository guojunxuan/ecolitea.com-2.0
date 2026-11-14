import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ImageMedia } from '@/components/Media/ImageMedia'
import { BannerMedia } from '@/collections/Products/blocks/MediaBanner/BannerMedia'
import { Carousel } from '@/collections/Products/blocks/MediaCarousel/Carousel'
import { Tabs } from '@/collections/Products/blocks/MediaTabs/Tabs'
import { ProductMedia } from '@/collections/Products/blocks/shared/ProductMedia'
import type { Media } from '@/payload-types'

const image: Media = {
  id: 'product-image',
  alt: 'Product detail',
  mimeType: 'image/jpeg',
  url: 'https://assets.example.com/product-detail.jpg',
  width: 2100,
  height: 900,
  focalX: 25,
  focalY: 75,
  createdAt: '2026-11-14T00:00:00.000Z',
  updatedAt: '2026-11-14T00:00:00.000Z',
}
const mobileImage: Media = {
  ...image,
  id: 'mobile-image',
  url: 'https://assets.example.com/mobile-detail.jpg',
  focalX: 0,
  focalY: 100,
}
const renderServer = (element: React.ReactElement) =>
  new DOMParser().parseFromString(renderToStaticMarkup(element), 'text/html')
const blocks = [
  {
    name: 'Tabs',
    render: (aspectRatio: string) => (
      <Tabs
        label="Product views"
        aspectRatio={aspectRatio}
        tabs={[
          { title: 'Front', media: image, playback: 'ambient' },
          { title: 'Back', media: image, playback: 'ambient' },
        ]}
      />
    ),
  },
  {
    name: 'Carousel',
    render: (aspectRatio: string) => (
      <Carousel
        label="Product views"
        aspectRatio={aspectRatio}
        slides={[
          { media: image, playback: 'ambient' },
          { media: image, playback: 'ambient' },
        ]}
      />
    ),
  },
]

describe('Product media responsive delivery', () => {
  it.each([
    {
      name: 'the same image',
      mobileMedia: undefined,
      file: 'product-detail.jpg',
      gravity: '0.25x0.75',
    },
    {
      name: 'a mobile image override',
      mobileMedia: mobileImage,
      file: 'mobile-detail.jpg',
      gravity: '0x1',
    },
  ])(
    'renders Banner mobile 4:5 crops before hydration for $name',
    ({ mobileMedia, file, gravity }) => {
      const document = renderServer(
        <BannerMedia
          media={image}
          mobileMedia={mobileMedia}
          aspectRatio="21:9"
          playback="ambient"
        />,
      )
      const frame = document.querySelector('[data-aspect-ratio]')!
      expect(frame.getAttribute('data-aspect-ratio')).toBe('21:9')
      expect(frame.getAttribute('data-mobile-aspect-ratio')).toBe('4:5')
      expect(frame.querySelector('picture source')?.getAttribute('srcset')).toContain(
        'width=640,height=800,fit=cover',
      )
      expect(frame.querySelector('picture source')?.getAttribute('srcset')).toContain(
        `gravity=${gravity}/${file}`,
      )
      expect(frame.querySelector('picture img')?.getAttribute('srcset')).toContain(
        'width=640,height=274,fit=cover',
      )
    },
  )

  it.each(blocks)(
    '$name emits the mobile crop before hydration with a desktop fallback',
    (block) => {
      const document = renderServer(block.render('21:9'))
      const frame = document.querySelector<HTMLElement>('[data-aspect-ratio]')!
      const source = frame.querySelector('picture source')
      const fallback = frame.querySelector('picture img')

      expect(source).not.toBeNull()
      expect(source?.getAttribute('media')).toBe('(width < 48rem)')
      expect(source?.getAttribute('srcset')).toContain('width=640,height=360,fit=cover')
      expect(source?.getAttribute('srcset')).toContain('gravity=0.25x0.75/product-detail.jpg')
      expect(fallback?.getAttribute('srcset')).toContain('width=640,height=274,fit=cover')
      expect(frame.getAttribute('data-aspect-ratio')).toBe('21:9')
      expect(frame.getAttribute('data-mobile-aspect-ratio')).toBe('16:9')
      expect(frame.style.getPropertyValue('--product-aspect-ratio')).toBe('21 / 9')
      expect(frame.style.getPropertyValue('--product-mobile-aspect-ratio')).toBe('16 / 9')
    },
  )

  it.each([
    { block: blocks[0], aspectRatio: '4:3', height: 480 },
    { block: blocks[0], aspectRatio: '1:1', height: 640 },
    { block: blocks[1], aspectRatio: '4:3', height: 480 },
  ])('retains the explicit $aspectRatio crop for $block.name', ({ block, aspectRatio, height }) => {
    const document = renderServer(block.render(aspectRatio))
    const frame = document.querySelector<HTMLElement>('[data-aspect-ratio]')!
    expect(frame.querySelector('picture source')).toBeNull()
    expect(frame.querySelector('picture img')?.getAttribute('srcset')).toContain(
      `width=640,height=${height},fit=cover`,
    )
    expect(frame.getAttribute('data-aspect-ratio')).toBe(aspectRatio)
    expect(frame.hasAttribute('data-mobile-aspect-ratio')).toBe(false)
  })

  it('uses the mobile ratio and mobile resource focal point independently of the fallback', () => {
    const document = renderServer(
      <ImageMedia
        resource={image}
        mobileResource={mobileImage}
        presentation={{
          image: {
            aspectRatio: { width: 21, height: 9 },
            mobileAspectRatio: { width: 16, height: 9 },
            fit: 'cover',
          },
        }}
      />,
    )
    const source = document.querySelector('picture source')?.getAttribute('srcset')
    const fallback = document.querySelector('picture img')?.getAttribute('srcset')
    expect(source).toContain('width=640,height=360,fit=cover')
    expect(source).toContain('gravity=0x1/mobile-detail.jpg')
    expect(fallback).toContain('width=640,height=274,fit=cover')
    expect(fallback).toContain('gravity=0.25x0.75/product-detail.jpg')
  })

  it('preserves existing art direction when no mobile ratio override is requested', () => {
    const document = renderServer(
      <ImageMedia
        resource={image}
        mobileResource={mobileImage}
        presentation={{ image: { aspectRatio: { width: 4, height: 3 }, fit: 'cover' } }}
      />,
    )
    const source = document.querySelector('picture source')
    expect(source?.getAttribute('media')).toBe('(width < 48rem)')
    expect(source?.getAttribute('srcset')).toContain('width=640,height=480,fit=cover')
    expect(source?.getAttribute('srcset')).toContain('gravity=0x1/mobile-detail.jpg')
    expect(document.querySelector('picture img')?.getAttribute('srcset')).toContain(
      'width=640,height=480,fit=cover',
    )
  })

  it.each([
    {
      name: 'a populated mobile image',
      mobileResource: mobileImage,
      file: 'mobile-detail.jpg',
      gravity: '0x1',
    },
    {
      name: 'an unpopulated mobile image',
      mobileResource: 'mobile-image',
      file: 'product-detail.jpg',
      gravity: '0.25x0.75',
    },
  ])('uses the matching crop and focal point for $name', ({ mobileResource, file, gravity }) => {
    const document = renderServer(
      <ProductMedia
        resource={image}
        mobileResource={mobileResource}
        aspectRatio="21:9"
        mobileAspectRatio="4:5"
      />,
    )
    const source = document.querySelector('picture source')?.getAttribute('srcset')
    const fallback = document.querySelector('picture img')?.getAttribute('srcset')
    expect(source).toContain('width=640,height=800,fit=cover')
    expect(source).toContain(`gravity=${gravity}/${file}`)
    expect(fallback).toContain('width=640,height=274,fit=cover')
    expect(fallback).toContain('gravity=0.25x0.75/product-detail.jpg')
  })

  it('keeps video source dimensions native while declaring the responsive cover frame', () => {
    const document = renderServer(
      <ProductMedia
        resource={{ ...image, mimeType: 'video/mp4', durationSeconds: 61, url: '/detail.mp4' }}
        aspectRatio="21:9"
        mobileAspectRatio="16:9"
      />,
    )
    const frame = document.querySelector<HTMLElement>('[data-aspect-ratio]')!
    const video = frame.querySelector('video')
    expect(video?.querySelector('source')?.getAttribute('src')).toBe(
      '/detail.mp4?2026-11-14T00%3A00%3A00.000Z',
    )
    expect(video?.hasAttribute('width')).toBe(false)
    expect(video?.hasAttribute('height')).toBe(false)
    expect(frame.getAttribute('data-aspect-ratio')).toBe('21:9')
    expect(frame.getAttribute('data-mobile-aspect-ratio')).toBe('16:9')
    expect(frame.querySelector('picture')).toBeNull()
  })
})
