import { describe, expect, it } from 'vitest'
import * as keys from '@/utilities/products/keys'
import * as options from '@/utilities/products/options'
import type { ProductDetail } from '@/utilities/products/models'
const media = (id: string) => ({ id })
const value = (key: string, gallery: unknown[] = [], specifications: unknown[] = []) => ({
  key,
  label: key,
  gallery,
  specifications,
})
const group = (key: string, values: unknown[]) => ({ key, name: key, display: 'text', values })
const resolve = (product: unknown, selection = {}) =>
  options.resolveOptionSelection(product as ProductDetail, selection)
describe('option keys and selection resolution', () => {
  it('generates deterministic Unicode NFKC keys without inventing suffixes', () => {
    expect(keys.optionKey('  Ｔｅａ Bag ')).toBe('tea-bag')
    expect(keys.optionKey('Tea-Bag')).toBe('tea-bag')
    expect(keys.optionKey(' 茶叶 / 绿色 ')).toBe('茶叶-绿色')
    expect(keys.optionKey('!!!')).toBe('')
  })
  it('uses the first selected gallery and falls back for unknown selections', () => {
    const product = {
      gallery: [media('base')],
      specifications: [],
      options: [
        group('color', [value('red'), value('blue', [media('blue')])]),
        group('size', [value('small', [media('small')])]),
      ],
    }
    expect(resolve(product, { color: 'blue' }).gallery).toEqual([media('blue')])
    expect(resolve(product, { color: 'missing', unknown: 'blue' }).gallery).toEqual([
      media('small'),
    ])
    expect(resolve({ ...product, options: [] }).gallery).toEqual([media('base')])
  })
  it('overrides normalized labels in place preserving groups and lets later groups win', () => {
    const product = {
      gallery: [],
      specifications: [
        { group: 'Base', label: ' Origin ', value: 'China' },
        { label: 'Weight', value: '10g' },
      ],
      options: [
        group('color', [
          value(
            'red',
            [],
            [
              { label: 'origin', value: 'Japan' },
              { label: 'Finish', value: 'Matt' },
            ],
          ),
        ]),
        group('size', [value('small', [], [{ label: ' ORIGIN ', value: 'India' }])]),
      ],
    }
    Object.freeze(product)
    Object.freeze(product.specifications)
    product.specifications.forEach(Object.freeze)
    expect(resolve(product).specifications).toEqual([
      { group: 'Base', label: ' Origin ', value: 'India' },
      { label: 'Weight', value: '10g' },
      { group: '', label: 'Finish', value: 'Matt' },
    ])
    expect(product.specifications[0].value).toBe('China')
  })
})

it('keeps duplicate base labels across groups and applies overrides to every matching row', () => {
  const product = {
    gallery: [],
    specifications: [
      { group: 'A', label: 'Weight', value: '10g' },
      { group: 'B', label: ' weight ', value: '20g' },
    ],
    options: [group('size', [value('large', [], [{ label: 'WEIGHT', value: '30g' }])])],
  }
  expect(resolve(product).specifications).toEqual([
    { group: 'A', label: 'Weight', value: '30g' },
    { group: 'B', label: ' weight ', value: '30g' },
  ])
})
