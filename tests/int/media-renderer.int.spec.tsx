import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Media as MediaResource } from '@/payload-types'

vi.mock('next/image', () => ({
  default: ({
    alt,
    height,
    loader,
    quality,
    sizes,
    src,
    width,
  }: {
    alt: string
    height?: number
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
        data-has-loader={loader ? 'true' : 'false'}
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

const media = (overrides: Partial<MediaResource>): MediaResource => ({
  id: 'media-id',
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T01:02:03.000Z',
  ...overrides,
})

afterEach(cleanup)

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
    expect(image.getAttribute('data-sizes')).toBe('(max-width: 768px) 100vw, 33vw')
    expect(image.getAttribute('src')).toBe(
      'https://assets.example.com/cdn-cgi/image/width=640,height=480,fit=cover,quality=73,format=auto/photos/tea.jpg?2026-09-12T01%3A02%3A03.000Z',
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
      expect(source?.getAttribute('src')).toContain(
        'https://assets.example.com/cdn-cgi/media/mode=video,width=1280,fit=contain/',
      )
      expect(source?.getAttribute('src')).toContain(
        encodeURIComponent(
          'https://assets.example.com/uploads/stored-clip.mp4?2026-09-12T01%3A02%3A03.000Z',
        ),
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

  it('renders documents as a semantic link to the original URL', () => {
    render(
      <Media
        resource={media({
          alt: 'Tea specification',
          filename: 'tea-spec.pdf',
          mimeType: 'application/pdf',
          url: 'https://assets.example.com/docs/tea-spec.pdf',
        })}
      />,
    )

    const link = screen.getByRole('link', { name: 'Tea specification' })
    expect(link.getAttribute('href')).toBe(
      'https://assets.example.com/docs/tea-spec.pdf?2026-09-12T01%3A02%3A03.000Z',
    )
    expect(link.getAttribute('href')).not.toContain('/cdn-cgi/')
  })

  it.each([
    'application/octet-stream',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ])('keeps other uploaded file type %s accessible at its original URL', (mimeType) => {
    render(
      <Media
        resource={media({
          filename: 'download.bin',
          mimeType,
          url: 'https://assets.example.com/files/download.bin',
        })}
      />,
    )

    const link = screen.getByRole('link', { name: 'download.bin' })
    expect(link.getAttribute('href')).toBe(
      'https://assets.example.com/files/download.bin?2026-09-12T01%3A02%3A03.000Z',
    )
    expect(link.getAttribute('href')).not.toContain('/cdn-cgi/')
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
