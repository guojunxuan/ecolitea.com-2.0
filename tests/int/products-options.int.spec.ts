import { describe, expect, it } from 'vitest'
import { optionKey } from '@/utilities/products/keys'
import { resolveOptionSelection, selectionForImage } from '@/utilities/products/options'
import type { ProductGalleryItem, ProductOptionValue } from '@/utilities/products/models'
const media = (id: string) => ({ id }) as ProductGalleryItem['media']
const value = (
  key: string,
  image: string | null = null,
  specifications: { label: string; value: string }[] = [],
): ProductOptionValue => ({
  key,
  label: key,
  swatch: null,
  image: image ? media(image) : null,
  specifications,
})
const item = (id: string, values: ProductGalleryItem['values'] = []): ProductGalleryItem => ({
  media: media(id),
  values,
})
const product = {
  gallery: [
    item('base'),
    item('red', [{ optionKey: 'color', valueKey: 'red' }]),
    item('shared', [
      { optionKey: 'color', valueKey: 'blue' },
      { optionKey: 'size', valueKey: 'small' },
    ]),
  ],
  specifications: [
    { label: ' Origin ', value: 'China' },
    { label: 'Weight', value: '10g' },
  ],
  options: [
    {
      key: 'color',
      name: 'Color',
      display: 'text' as const,
      values: [
        value('red', 'red', [
          { label: 'origin', value: 'Japan' },
          { label: 'Finish', value: 'Matt' },
        ]),
        value('blue', 'shared'),
      ],
    },
    {
      key: 'size',
      name: 'Size',
      display: 'image' as const,
      values: [value('small', 'shared', [{ label: ' ORIGIN ', value: 'India' }]), value('large')],
    },
  ],
}
describe('option selection and gallery synchronization', () => {
  it('generates stable normalized Unicode keys', () => {
    expect(optionKey(' Ｔｅａ Bag ')).toBe('tea-bag')
    expect(optionKey('茶叶 / 绿色')).toBe('茶叶-绿色')
    expect(optionKey('!!!')).toBe('')
  })
  it('uses the first selected image on first render and unknown selections fall back', () => {
    expect(resolveOptionSelection(product, {}).activeImageIndex).toBe(1)
    expect(
      resolveOptionSelection(product, { color: 'missing', unknown: 'red' }).activeImageIndex,
    ).toBe(1)
    expect(resolveOptionSelection(product, { color: 'blue' }).activeImageIndex).toBe(2)
  })
  it('targets only the changed group, preserving the current image when its value has no image', () => {
    expect(resolveOptionSelection(product, { size: 'small' }, 'size').activeImageIndex).toBe(2)
    expect(resolveOptionSelection(product, { size: 'large' }, 'size').activeImageIndex).toBeNull()
    expect(resolveOptionSelection(product, {}, 'unknown').activeImageIndex).toBeNull()
    expect(resolveOptionSelection({ ...product, gallery: [] }, {}).activeImageIndex).toBeNull()
    expect(resolveOptionSelection({ ...product, options: [] }, {}).activeImageIndex).toBeNull()
  })
  it('overrides labels ignoring whitespace/case, later groups win, appends without group and does not mutate inputs', () => {
    const before = structuredClone(product)
    expect(resolveOptionSelection(product, {}).specifications).toEqual([
      { label: ' Origin ', value: 'India' },
      { label: 'Weight', value: '10g' },
      { label: 'Finish', value: 'Matt' },
    ])
    expect(product).toEqual(before)
  })
  it('updates every duplicate label in place without introducing group', () => {
    expect(
      resolveOptionSelection(
        {
          ...product,
          specifications: [
            { label: 'Origin', value: 'A' },
            { label: ' origin ', value: 'B' },
          ],
        },
        {},
      ).specifications,
    ).toEqual([
      { label: 'Origin', value: 'India' },
      { label: ' origin ', value: 'India' },
      { label: 'Finish', value: 'Matt' },
    ])
  })
  it('maps an option image back to its selection and merges deduplicated sources', () => {
    expect(selectionForImage(product, 1)).toEqual({ color: 'red' })
    expect(selectionForImage(product, 2)).toEqual({ color: 'blue', size: 'small' })
  })
  it('returns no changes for product images or invalid indexes', () => {
    for (const i of [0, -1, 99, NaN, 1.5]) expect(selectionForImage(product, i)).toEqual({})
  })
})
