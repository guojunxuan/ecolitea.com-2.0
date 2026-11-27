import { describe, expect, it } from 'vitest'
import { mediaAspectRatioOptions, mediaAspectRatios } from '@/components/Media/aspectRatio'
import {
  productAspectRatios,
  productAspectRatioField,
  resolveProductAspectRatio,
} from '@/collections/Products/blocks/shared/aspectRatio'
import { playbackField } from '@/collections/Products/blocks/shared/playbackField'
import { productBlocks } from '@/collections/Products/blocks'

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
        values: ['full-screen', '21:9', '16:9'],
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
        { label: '16:9', value: '16:9' },
      ],
    })
    expect(() =>
      productAspectRatioField({ values: ['unsupported'] as never, defaultValue: '1:1' }),
    ).toThrow(/unsupported/)
    expect(() =>
      productAspectRatioField({ values: ['1:1'], defaultValue: 'unsupported' as never }),
    ).toThrow(/unsupported/)
    expect(() =>
      productAspectRatioField({ values: ['original'] as never, defaultValue: '1:1' }),
    ).toThrow(/original/)
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
  it('inherits Section themes without exposing a Block theme field', () => {
    for (const block of productBlocks) {
      const fields = block.fields.flatMap((field) => ('fields' in field ? field.fields : [field]))
      expect(fields.some((field) => 'name' in field && field.name === 'theme')).toBe(false)
    }
  })
})
