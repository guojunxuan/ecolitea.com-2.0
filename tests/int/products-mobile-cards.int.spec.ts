import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { auditCss } from '../helpers/cssAudit'

const cardStyles = auditCss(
  readFileSync('src/components/Products/ProductCard/index.module.css', 'utf8'),
).declarations
const rowStyles = auditCss(
  readFileSync('src/components/Products/OverflowCarousel/productRow.module.css', 'utf8'),
).declarations
const listingStyles = auditCss(
  readFileSync('src/app/(frontend)/products/[category]/listing.module.css', 'utf8'),
).declarations

const mobileValue = (declarations: typeof cardStyles, selector: string, property: string) =>
  declarations
    .filter(
      ({ header, prop, ancestors }) =>
        header === selector &&
        prop === property &&
        ancestors.every(
          (ancestor) =>
            !ancestor.startsWith('@') ||
            ancestor === '@media (width < 64rem)' ||
            ancestor === '@media (width < 48rem)',
        ),
    )
    .at(-1)?.value

describe('mobile product-card layout shared with the overview', () => {
  it('gives category products one full-width Site column', () => {
    expect(mobileValue(listingStyles, '.grid', 'grid-template-columns')).toBe('minmax(0, 1fr)')
  })

  it('gives each Related rail card the same content width as the overview', () => {
    expect(mobileValue(rowStyles, '.root', '--product-row-card')).toBe('var(--product-row-content)')
    expect(mobileValue(rowStyles, '.root', '--product-row-gap')).toBe('var(--website-space-3)')
  })

  it('defaults mobile product covers to the overview 5:4 shape', () => {
    const ratio = mobileValue(cardStyles, '.cover', 'aspect-ratio')!
    const value = ratio.replace(/^var\(--product-card-media-ratio,\s*(.+)\)$/, '$1')
    const [width, height = 1] = value.split('/').map(Number)
    expect(width / height).toBe(5 / 4)
  })

  it('keeps the existing desktop and tablet column rules outside the mobile override', () => {
    expect(
      listingStyles.find(
        ({ header, prop, ancestors }) =>
          header === '.grid' && prop === 'grid-template-columns' && ancestors.length === 1,
      )?.value,
    ).toBe('repeat(3, minmax(0, 1fr))')
    expect(
      listingStyles.find(
        ({ header, prop, ancestors }) =>
          header === '.grid' &&
          prop === 'grid-template-columns' &&
          ancestors.includes('@media (48rem <= width < 64rem)'),
      )?.value,
    ).toBe('repeat(auto-fill, minmax(16.25rem, 1fr))')
  })
})
