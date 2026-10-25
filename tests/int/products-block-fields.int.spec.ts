import { describe, expect, it } from 'vitest'
import { mediaAspectRatioOptions, mediaAspectRatios } from '@/components/Media/aspectRatio'
import {
  productAspectRatios,
  productAspectRatioField,
  resolveProductAspectRatio,
} from '@/collections/Products/blocks/shared/aspectRatio'
import { playbackField } from '@/collections/Products/blocks/shared/playbackField'
import { themeField } from '@/collections/Products/blocks/shared/themeField'

describe('Products block shared fields', () => {
  it('keeps shared media ratios at the pre-Products baseline', () => {
    expect(mediaAspectRatios).toEqual({
      '1:1': { width: 1, height: 1 },
      '4:3': { width: 4, height: 3 },
      '3:2': { width: 3, height: 2 },
      '16:9': { width: 16, height: 9 },
      '2:1': { width: 2, height: 1 },
    })
    expect(mediaAspectRatioOptions.map(({ value }) => value)).not.toContain('21:9')
  })
  it('resolves exactly the five product ratios', () => {
    const ratios = {
      '21:9': { width: 21, height: 9 },
      '16:9': { width: 16, height: 9 },
      '4:3': { width: 4, height: 3 },
      '1:1': { width: 1, height: 1 },
      '4:5': { width: 4, height: 5 },
    }
    expect(productAspectRatios).toEqual(ratios)
    for (const [value, ratio] of Object.entries(ratios))
      expect(resolveProductAspectRatio(value)).toEqual(ratio)
    for (const value of [
      undefined,
      null,
      '',
      'original',
      'full-screen',
      'unknown',
      'toString',
      '__proto__',
    ])
      expect(resolveProductAspectRatio(value)).toBeUndefined()
  })
  it('creates required select fields in caller order and rejects unknown values eagerly', () => {
    expect(
      productAspectRatioField({
        values: ['full-screen', '21:9', 'original'],
        defaultValue: '21:9',
      }),
    ).toEqual({
      name: 'aspectRatio',
      label: 'Aspect Ratio',
      type: 'select',
      required: true,
      defaultValue: '21:9',
      options: [
        { label: 'Full Screen', value: 'full-screen' },
        { label: '21:9', value: '21:9' },
        { label: 'Original', value: 'original' },
      ],
    })
    expect(() =>
      productAspectRatioField({ values: ['unsupported'] as never, defaultValue: '1:1' }),
    ).toThrow(/unsupported/)
    expect(() =>
      productAspectRatioField({ values: ['1:1'], defaultValue: 'unsupported' as never }),
    ).toThrow(/unsupported/)
  })
  it('always exposes required playback even for upload IDs', () => {
    expect(playbackField).toEqual({
      name: 'playback',
      label: 'Playback',
      type: 'select',
      required: true,
      defaultValue: 'ambient',
      options: [
        { label: 'Ambient', value: 'ambient' },
        { label: 'Player', value: 'player' },
      ],
      admin: {
        description:
          'Video only. Ambient plays muted on loop; Player shows controls. Ignored for images and GIFs.',
      },
    })
    expect(playbackField.admin).not.toHaveProperty('condition')
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
