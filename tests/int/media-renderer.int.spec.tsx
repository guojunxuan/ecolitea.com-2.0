import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Media as MediaResource } from '@/payload-types'

vi.mock('next/image', () => ({
  default: ({
    alt,
    className,
    'data-media-kind': mediaKind,
    height,
    fill,
    loader,
    quality,
    sizes,
    src,
    width,
  }: {
    alt: string
    className?: string
    'data-media-kind'?: string
    height?: number
    fill?: boolean
    loader?: (args: { quality?: number; src: string; width: number }) => string
    quality?: number
    sizes?: string
    src: { src: string } | string
    width?: number
  }) => {
    const originalSource = typeof src === 'string' ? src : src.src
    const renderedSource = loader
      ? loader({ quality, src: originalSource, width: 640 })
      : originalSource

    return (
      // The test double exposes the URL selected by Next Image's loader contract.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={alt}
        className={className}
        data-has-loader={loader ? 'true' : 'false'}
        data-fill={fill ? 'true' : 'false'}
        data-media-kind={mediaKind}
        data-sizes={sizes}
        height={height}
        src={renderedSource}
        width={width}
      />
    )
  },
}))

import { Media } from '@/components/Media'
import { MEDIA_PRESENTATION } from '@/components/Media/config'
import imageStyles from '@/components/Media/ImageMedia/index.module.css'
import videoStyles from '@/components/Media/VideoMedia/index.module.css'

const media = (overrides: Partial<MediaResource>): MediaResource => ({
  id: 'media-id',
  alt: 'Example media content',
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T01:02:03.000Z',
  ...overrides,
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('Media renderer', () => {
  it('renders Payload raster images through the Cloudflare loader with requested presentation', () => {
    render(
      <Media
        presentation={{ image: { ...MEDIA_PRESENTATION.card.image, quality: 73 } }}
        resource={media({
          alt: 'Tea card',
          height: 800,
          mimeType: 'image/jpeg',
          url: 'https://assets.example.com/photos/tea.jpg',
          width: 1200,
        })}
        size="(max-width: 768px) 100vw, 33vw"
      />,
    )

    const image = screen.getByRole('img', { name: 'Tea card' })
    expect(image.getAttribute('data-has-loader')).toBe('true')
    expect(image.getAttribute('data-media-kind')).toBe('image')
    expect(image.classList).toContain(imageStyles.image)
    expect(image.getAttribute('data-sizes')).toBe('(max-width: 768px) 100vw, 33vw')
    expect(image.getAttribute('src')).toBe(
      'https://assets.example.com/cdn-cgi/image/width=640,height=480,fit=cover,quality=73,format=auto/photos/tea.jpg?2026-09-12T01%3A02%3A03.000Z',
    )
  })

  it('passes stored focal coordinates including zero to Cloudflare', () => {
    render(
      <Media
        presentation={MEDIA_PRESENTATION.card}
        resource={media({
          alt: 'Focused tea',
          mimeType: 'image/jpeg',
          url: 'https://assets.example.com/tea.jpg',
          width: 1200,
          height: 800,
          focalX: 0,
          focalY: 100,
        })}
      />,
    )
    expect(screen.getByRole('img', { name: 'Focused tea' }).getAttribute('src')).toContain(
      'gravity=0x1',
    )
  })

  it('reserves the delivered crop ratio for a non-fill Payload image', () => {
    render(
      <Media
        presentation={MEDIA_PRESENTATION.card}
        resource={media({
          alt: 'Cropped tea',
          height: 800,
          mimeType: 'image/png',
          url: 'https://assets.example.com/tea.png',
          width: 1200,
        })}
      />,
    )

    const image = screen.getByRole('img', { name: 'Cropped tea' })
    expect(image.getAttribute('width')).toBe('1200')
    expect(image.getAttribute('height')).toBe('900')
  })

  it('keeps a local static import on the native Next Image path', () => {
    render(
      <Media
        alt="Local tea"
        src={{ blurDataURL: '', height: 200, src: '/_next/static/media/tea.jpg', width: 300 }}
      />,
    )

    const image = screen.getByRole('img', { name: 'Local tea' })
    expect(image.getAttribute('data-has-loader')).toBe('false')
    expect(image.getAttribute('src')).toBe('/_next/static/media/tea.jpg')
  })

  it.each([30, 60])(
    'transforms a validated %s-second MP4 from its stored URL',
    (durationSeconds) => {
      render(
        <Media
          presentation={{ video: { fit: 'contain', width: 1280 } }}
          resource={media({
            durationSeconds,
            filename: 'wrong-filename.mp4',
            mimeType: 'video/mp4',
            url: 'https://assets.example.com/uploads/stored-clip.mp4',
          })}
        />,
      )

      const source = document.querySelector('video source')
      expect(source?.parentElement?.getAttribute('data-media-kind')).toBe('video')
      expect(source?.parentElement?.classList).toContain(videoStyles.video)
      expect(source?.getAttribute('src')).toContain(
        'https://assets.example.com/cdn-cgi/media/mode=video,width=1280,fit=contain/',
      )
      expect(source?.getAttribute('src')).toContain(
        'https://assets.example.com/uploads/stored-clip.mp4?2026-09-12T01%3A02%3A03.000Z',
      )
      expect(source?.getAttribute('src')).not.toContain('/media/wrong-filename.mp4')
    },
  )

  it.each([61, undefined, Number.NaN, Number.POSITIVE_INFINITY, 0, -1])(
    'uses the original video URL when duration is %s',
    (durationSeconds) => {
      render(
        <Media
          resource={media({
            durationSeconds,
            mimeType: 'video/mp4',
            url: 'https://assets.example.com/uploads/long.mp4?version=2',
          })}
        />,
      )

      expect(document.querySelector('video source')?.getAttribute('src')).toBe(
        'https://assets.example.com/uploads/long.mp4?version=2&2026-09-12T01%3A02%3A03.000Z',
      )
    },
  )

  it.each(['application/pdf', 'application/octet-stream', 'image/svg+xml', 'audio/mpeg'])(
    'does not render downloads for unsupported MIME type %s with a URL',
    (mimeType) => {
      const { container } = render(
        <Media resource={media({ mimeType, url: 'https://assets.example.com/file.pdf' })} />,
      )
      expect(container.querySelector('img, video, a')).toBeNull()
    },
  )

  it.each(['Custom tea description', ''])('respects explicit alt %j over resource alt', (alt) => {
    const { container } = render(
      <Media
        alt={alt}
        resource={media({
          alt: 'Resource tea',
          mimeType: 'image/jpeg',
          url: '/api/media/file/tea.jpg',
          width: 1200,
          height: 800,
        })}
      />,
    )
    expect(container.querySelector('img')?.getAttribute('alt')).toBe(alt)
  })

  it('renders a dimensionless image with explicit fill', () => {
    const { container } = render(
      <Media fill resource={media({ mimeType: 'image/jpeg', url: '/tea.jpg' })} />,
    )
    expect(container.querySelector('img')?.getAttribute('data-fill')).toBe('true')
  })

  it('uses a ratio frame with fill when image dimensions are missing', () => {
    const { container } = render(
      <Media
        presentation={MEDIA_PRESENTATION.card}
        resource={media({ mimeType: 'image/jpeg', url: '/tea.jpg' })}
      />,
    )
    const image = container.querySelector('img')
    expect(image?.getAttribute('data-fill')).toBe('true')
    expect(image?.parentElement?.style.aspectRatio).toBe('4 / 3')
    expect(image?.parentElement?.style.position).toBe('relative')
  })

  it.each(['development', 'production'] as const)(
    'renders an empty placeholder without dimensions or a frame in %s',
    (environment) => {
      vi.stubEnv('NODE_ENV', environment)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { container } = render(
        <Media resource={media({ mimeType: 'image/jpeg', url: '/tea.jpg' })} />,
      )
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('picture')?.childElementCount).toBe(0)
      expect(warn).toHaveBeenCalledTimes(environment === 'development' ? 1 : 0)
    },
  )

  it.each([undefined, 'ambient', 'player'] as const)('applies %s video playback', (playback) => {
    const { container } = render(
      <Media
        presentation={{ video: { playback, width: 640 } }}
        resource={media({
          mimeType: 'video/mp4',
          url: 'https://assets.example.com/tea.mp4',
          durationSeconds: 60,
        })}
      />,
    )
    const video = container.querySelector('video')!
    const isAmbient = playback !== 'player'
    expect(video.autoplay).toBe(isAmbient)
    expect(video.muted).toBe(isAmbient)
    expect(video.loop).toBe(isAmbient)
    expect(video.controls).toBe(!isAmbient)
    expect(video.playsInline).toBe(true)
    expect(video.querySelector('source')?.getAttribute('type')).toBe('video/mp4')
    expect(video.getAttribute('poster')).toContain('/cdn-cgi/media/mode=frame,time=1s,width=640/')
  })

  it.each([
    ['/api/media/file/tea.mp4', 30],
    ['https://assets.example.com/tea.mp4', 60.001],
    ['https://assets.example.com/tea.mp4', undefined],
    ['https://assets.example.com/tea.mp4', 0],
    ['https://assets.example.com/tea.mp4', Number.NaN],
  ])('does not transform or generate a poster for %s (%s seconds)', (url, durationSeconds) => {
    const { container } = render(
      <Media resource={media({ mimeType: 'video/mp4', url, durationSeconds })} />,
    )
    const video = container.querySelector('video')!
    expect(video.getAttribute('poster')).toBeNull()
    expect(video.querySelector('source')?.getAttribute('src')).not.toContain('/cdn-cgi/')
  })

  it.each(['image/svg+xml', 'audio/mpeg', 'application/octet-stream'])(
    'safely renders nothing for unsupported MIME type %s without a URL',
    (mimeType) => {
      const { container } = render(
        <Media
          resource={media({
            mimeType,
            url: null,
          })}
        />,
      )

      expect(container.querySelector('img, video, a')).toBeNull()
    },
  )
})
