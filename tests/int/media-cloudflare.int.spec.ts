import { describe, expect, it } from 'vitest'

import { buildCloudflareImageURL, buildCloudflareVideoURL } from '@/components/Media/cloudflare'
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
        'https://media-dev.ecolitea.com/cdn-cgi/media/mode=video/https%3A%2F%2Fmedia-dev.ecolitea.com%2Fvideos%2Fclip.mp4',
      )
    },
  )

  it('uses deterministic options and a fully encoded absolute source URL', () => {
    expect(
      buildCloudflareVideoURL({
        source: original,
        presentation: { width: 1280, height: 720, fit: 'cover' },
      }),
    ).toBe(
      'https://media-dev.ecolitea.com/cdn-cgi/media/mode=video,width=1280,height=720,fit=cover/https%3A%2F%2Fmedia-dev.ecolitea.com%2Fphotos%2Fcard%2520image.jpg%3Fversion%3D7',
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
