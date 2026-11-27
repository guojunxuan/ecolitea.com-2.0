import { describe, expect, it } from 'vitest'

import {
  buildCloudflareImageURL,
  buildCloudflareVideoURL,
  buildCloudflareVideoPosterURL,
} from '@/components/Media/cloudflare'
import { MEDIA_PRESENTATION } from '@/components/Media/config'
import type {
  ImagePresentation,
  MediaPresentation,
  VideoPresentation,
} from '@/components/Media/types'

const original = 'https://media-dev.ecolitea.com/photos/card image.jpg?version=7'

describe('Media presentation configuration', () => {
  it('declares provider-neutral named presets', () => {
    expect(MEDIA_PRESENTATION.card).toEqual({
      image: {
        aspectRatio: { width: 4, height: 3 },
        fit: 'cover',
        quality: 85,
      },
    })
    expect(MEDIA_PRESENTATION.body).toEqual({
      image: { fit: 'scale-down', quality: 85 },
    })
    expect(MEDIA_PRESENTATION.hero).toEqual({
      image: { fit: 'scale-down', quality: 85 },
      video: { playback: 'ambient' },
    })

    const image: ImagePresentation = MEDIA_PRESENTATION.card.image
    const video: VideoPresentation = { fit: 'contain', width: 1280 }
    const presentation: MediaPresentation = { image, video }

    expect(presentation).toEqual({ image, video })
  })
})

describe('Cloudflare image delivery adapter', () => {
  it('builds deterministic same-origin options with a pathname-only source', () => {
    expect(
      buildCloudflareImageURL({
        source: original,
        width: 640,
        presentation: MEDIA_PRESENTATION.card.image,
      }),
    ).toBe(
      'https://media-dev.ecolitea.com/cdn-cgi/image/width=640,height=480,fit=cover,quality=85,format=auto/photos/card%20image.jpg?version=7',
    )
  })

  it('does not double-encode escaped path segments and preserves the query', () => {
    expect(
      buildCloudflareImageURL({
        source: 'https://media-dev.ecolitea.com/a%20b/already%2520encoded.jpg?v=a%20b',
        width: 320,
        presentation: MEDIA_PRESENTATION.body.image,
      }),
    ).toBe(
      'https://media-dev.ecolitea.com/cdn-cgi/image/width=320,fit=scale-down,quality=85,format=auto/a%20b/already%2520encoded.jpg?v=a%20b',
    )
  })

  it('uses requested quality first and clamps it to the supported range', () => {
    expect(
      buildCloudflareImageURL({ source: original, width: 640, quality: 101.4, presentation: {} }),
    ).toContain('width=640,fit=scale-down,quality=100,format=auto')
    expect(
      buildCloudflareImageURL({ source: original, width: 640, quality: -2, presentation: {} }),
    ).toContain('width=640,fit=scale-down,quality=1,format=auto')
  })

  it('uses configured default quality and omits height without a ratio', () => {
    expect(buildCloudflareImageURL({ source: original, width: 640, presentation: {} })).toContain(
      '/width=640,fit=scale-down,quality=85,format=auto/',
    )
  })

  it.each([
    ['relative source', '/photos/image.jpg', 640, {}],
    ['non-http source', 'ftp://media-dev.ecolitea.com/image.jpg', 640, {}],
    [
      'already transformed source',
      'https://media-dev.ecolitea.com/cdn-cgi/image/width=20/image.jpg',
      640,
      {},
    ],
    ['non-finite width', original, Number.POSITIVE_INFINITY, {}],
    ['non-positive width', original, 0, {}],
    ['invalid ratio', original, 640, { aspectRatio: { width: Number.NaN, height: 3 } }],
  ])('returns the original URL for %s', (_name, source, width, presentation) => {
    expect(
      buildCloudflareImageURL({
        source: source as string,
        width: width as number,
        presentation: presentation as ImagePresentation,
      }),
    ).toBe(source)
  })
})

describe('Cloudflare video delivery adapter', () => {
  it.each([undefined, {}])(
    'includes the required video mode for an empty presentation (%j)',
    (presentation) => {
      expect(
        buildCloudflareVideoURL({
          source: 'https://media-dev.ecolitea.com/videos/clip.mp4',
          presentation,
        }),
      ).toBe(
        'https://media-dev.ecolitea.com/cdn-cgi/media/mode=video/https://media-dev.ecolitea.com/videos/clip.mp4',
      )
    },
  )

  it('uses deterministic options and an absolute source URL with its path encoding preserved', () => {
    expect(
      buildCloudflareVideoURL({
        source: original,
        presentation: { width: 1280, height: 720, fit: 'cover' },
      }),
    ).toBe(
      'https://media-dev.ecolitea.com/cdn-cgi/media/mode=video,width=1280,height=720,fit=cover/https://media-dev.ecolitea.com/photos/card%20image.jpg?version=7',
    )
  })

  it('clamps dimensions to Cloudflare video limits', () => {
    expect(
      buildCloudflareVideoURL({
        source: original,
        presentation: { width: 1, height: 5000 },
      }),
    ).toContain('/mode=video,width=10,height=2000/')
  })

  it.each([
    ['relative source', '/video.mp4', { width: 640 }],
    ['non-http source', 'data:video/mp4;base64,AAAA', { width: 640 }],
    [
      'already transformed source',
      'https://media-dev.ecolitea.com/cdn-cgi/media/width=640/video.mp4',
      { width: 640 },
    ],
    ['invalid width', original, { width: Number.NaN }],
    ['invalid height', original, { height: Number.POSITIVE_INFINITY }],
  ])('returns the original URL for %s', (_name, source, presentation) => {
    expect(
      buildCloudflareVideoURL({
        source: source as string,
        presentation: presentation as VideoPresentation,
      }),
    ).toBe(source)
  })
})

describe('Cloudflare image focal point', () => {
  it.each([
    [0, 100, '0x1'],
    [100, 0, '1x0'],
    [25, 75, '0.25x0.75'],
  ])('converts %s/%s percent to coordinates', (x, y, coordinates) => {
    expect(
      buildCloudflareImageURL({ source: original, width: 640, focalPoint: { x, y } }),
    ).toContain(`gravity=${coordinates}`)
  })
  it('defaults absent or invalid focus to center', () => {
    expect(buildCloudflareImageURL({ source: original, width: 640 })).not.toContain('gravity=')
    expect(
      buildCloudflareImageURL({ source: original, width: 640, focalPoint: { x: NaN, y: 20 } }),
    ).not.toContain('gravity=')
  })
})

describe('Cloudflare video frame adapter', () => {
  it('builds a frame at one second with shared dimension and fit normalization', () => {
    expect(
      buildCloudflareVideoPosterURL({
        source: original,
        presentation: { width: 1280, height: 720, fit: 'cover' },
      }),
    ).toBe(
      'https://media-dev.ecolitea.com/cdn-cgi/media/mode=frame,time=1s,width=1280,height=720,fit=cover/https://media-dev.ecolitea.com/photos/card%20image.jpg?version=7',
    )
    expect(
      buildCloudflareVideoPosterURL({ source: original, presentation: { width: 1, height: 5000 } }),
    ).toContain('/mode=frame,time=1s,width=10,height=2000/')
  })
  it('supports an absent presentation', () => {
    expect(buildCloudflareVideoPosterURL({ source: original })).toContain('/mode=frame,time=1s/')
  })
  it.each([
    ['/api/media/file/tea.mp4', undefined],
    ['data:video/mp4;base64,AAAA', undefined],
    ['https://assets.example.com/cdn-cgi/media/mode=video/tea.mp4', undefined],
    [original, { width: Number.NaN }],
    [original, { height: Number.POSITIVE_INFINITY }],
  ])('omits the poster for an ineligible source or presentation %s %j', (source, presentation) => {
    expect(buildCloudflareVideoPosterURL({ source, presentation })).toBeUndefined()
  })
})
