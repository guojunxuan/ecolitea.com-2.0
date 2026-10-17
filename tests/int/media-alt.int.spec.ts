import { describe, expect, it } from 'vitest'
import { validateMediaAlt } from '@/collections/mediaAlt'

const run = async (data: Record<string, unknown>, extra = {}) =>
  validateMediaAlt({
    data,
    operation: 'create',
    req: {},
    ...extra,
  } as never)

describe('Media alt integrity', () => {
  it.each([undefined, '', '  '])('requires alt on create: %s', async (alt) => {
    await expect(run({ alt })).rejects.toMatchObject({
      data: { errors: [{ path: 'alt', message: 'Alt text is required.' }] },
    })
  })
  it.each(['abcd', 'x'.repeat(126)])('bounds trimmed length', async (alt) => {
    await expect(run({ alt })).rejects.toMatchObject({
      data: { errors: [{ message: 'Alt text should be 5–125 characters.' }] },
    })
  })
  it.each([
    'IMG_1234',
    'DSC0021',
    'Screenshot 2026-08-06',
    '截屏2026-08-06 14.03.23',
    '20260806',
    '2026-08-06',
    'tea garden.jpg',
  ])('rejects filenames: %s', async (alt) => {
    await expect(run({ alt })).rejects.toMatchObject({
      data: {
        errors: [{ message: 'Alt text should describe the image, not repeat the filename.' }],
      },
    })
  })
  it.each(['image', 'photo', 'picture', 'video', 'image2'])(
    'rejects generic alt: %s',
    async (alt) => {
      await expect(run({ alt })).rejects.toMatchObject({
        data: { errors: [{ message: 'Alt text is too generic. Describe what is shown.' }] },
      })
    },
  )
  it.each(['Screenshot showing the tea analytics dashboard', '截屏展示茶叶分布地图'])(
    'accepts descriptive screenshot alt: %s',
    async (alt) => {
      await expect(run({ alt })).resolves.toEqual({ alt })
    },
  )
  it('accepts Chinese and trims whitespace', async () => {
    await expect(run({ alt: '  山间茶园的清晨  ' })).resolves.toEqual({ alt: '山间茶园的清晨' })
  })
  it('allows untouched legacy alt during system updates', async () => {
    const data = { folder: null, alt: 'IMG_1234' }
    await expect(
      run(data, { operation: 'update', originalDoc: { alt: 'IMG_1234' } }),
    ).resolves.toEqual(data)
    await expect(
      run({ caption: null }, { operation: 'update', originalDoc: { alt: '' } }),
    ).resolves.toEqual({ caption: null })
  })
  it('rejects an explicitly cleared nullable alt', async () => {
    await expect(
      run({ alt: null }, { operation: 'update', originalDoc: { alt: 'Tea garden' } }),
    ).rejects.toMatchObject({ data: { errors: [{ message: 'Alt text is required.' }] } })
  })
  it('validates replacement files and changed alt', async () => {
    await expect(
      run({}, { operation: 'update', originalDoc: { alt: 'IMG_1234' }, req: { file: {} } }),
    ).rejects.toMatchObject({
      data: {
        errors: [{ message: 'Alt text should describe the image, not repeat the filename.' }],
      },
    })
    await expect(
      run({ alt: '' }, { operation: 'update', originalDoc: { alt: 'Tea plantation' } }),
    ).rejects.toMatchObject({ data: { errors: [{ message: 'Alt text is required.' }] } })
  })
})
