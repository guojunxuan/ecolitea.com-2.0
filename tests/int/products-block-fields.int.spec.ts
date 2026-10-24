import { describe, expect, it } from 'vitest'

import {
  mediaAspectRatioOptions,
  mediaAspectRatios,
  resolveMediaAspectRatio,
} from '@/components/Media/aspectRatio'
import { getProductAspectRatioOptions } from '@/collections/Products/blocks/shared/aspectRatioOptions'
import {
  playbackField,
  videoPlaybackCondition,
} from '@/collections/Products/blocks/shared/playbackCondition'
import { themeField } from '@/collections/Products/blocks/shared/themeField'

describe('Products block shared fields', () => {
  it('adds 21:9 to the shared media ratios without changing existing ratios', () => {
    expect(mediaAspectRatios).toEqual({
      '1:1': { width: 1, height: 1 },
      '4:3': { width: 4, height: 3 },
      '3:2': { width: 3, height: 2 },
      '16:9': { width: 16, height: 9 },
      '2:1': { width: 2, height: 1 },
      '21:9': { width: 21, height: 9 },
    })
    expect(resolveMediaAspectRatio('21:9')).toEqual({ width: 21, height: 9 })
    expect(resolveMediaAspectRatio('16:9')).toEqual({ width: 16, height: 9 })
    expect(mediaAspectRatioOptions).toContainEqual({ label: '21:9', value: '21:9' })
  })

  it('selects precisely the requested Product ratios in caller order', () => {
    expect(getProductAspectRatioOptions(['21:9', '16:9', '4:3'])).toEqual([
      { label: '21:9', value: '21:9' },
      { label: '16:9', value: '16:9' },
      { label: '4:3', value: '4:3' },
    ])
    expect(getProductAspectRatioOptions(['1:1', '4:5', 'original'])).toEqual([
      { label: '1:1', value: '1:1' },
      { label: '4:5', value: '4:5' },
      { label: 'Original', value: 'original' },
    ])
    expect(getProductAspectRatioOptions([])).toEqual([])
    expect(() => getProductAspectRatioOptions(['full-screen'])).toThrow(/full-screen/)
    expect(() => getProductAspectRatioOptions(['unsupported'])).toThrow(/unsupported/)
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['string ID', 'media-id'],
    ['number ID', 42],
    ['empty document', {}],
    ['image', { mimeType: 'image/jpeg' }],
    ['GIF', { mimeType: 'image/gif' }],
    ['non-string MIME type', { mimeType: 7 }],
  ])('hides video playback for %s', (_case, media) => {
    expect(videoPlaybackCondition({}, { media })).toBe(false)
  })

  it('handles missing sibling data and shows playback for a video document', () => {
    expect(videoPlaybackCondition({}, undefined as unknown as Record<string, unknown>)).toBe(false)
    expect(videoPlaybackCondition({}, null as unknown as Record<string, unknown>)).toBe(false)
    expect(videoPlaybackCondition({}, { media: { mimeType: 'video/mp4' } })).toBe(true)
  })

  it('declares the complete playback select field', () => {
    expect(playbackField).toEqual({
      name: 'playback',
      label: 'Playback',
      type: 'select',
      options: [
        { label: 'Ambient', value: 'ambient' },
        { label: 'Player', value: 'player' },
      ],
      defaultValue: 'ambient',
      admin: { condition: videoPlaybackCondition },
    })
  })

  it('declares the clearable inherited theme field without a default', () => {
    expect(themeField).toEqual({
      name: 'theme',
      type: 'select',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Inverse', value: 'inverse' },
      ],
      admin: { isClearable: true, placeholder: 'Inherit surrounding theme' },
    })
  })
})
